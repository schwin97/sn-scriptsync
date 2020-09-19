import {
    window,
    workspace,
    commands,
    Disposable,
    ExtensionContext,
    StatusBarAlignment,
    StatusBarItem,
    TextDocument,
} from "vscode";

import * as path from "path";
import * as vscode from "vscode";
import { open } from "fs";
import { getServers } from "dns";
let idx = 0;

let fs = require("fs");
let mkdirp = require("mkdirp");
let getDirName = require("path").dirname;
const nodePath = require("path");
let instanceSettings = {};

export class ExtensionUtils {

    copyFile(sourcePath: string, path: string, cb: Function) {
        mkdirp(getDirName(path), function (err) {
            if (err) return cb(err);
            fs.copyFile(sourcePath, path, (error) => {});
            return cb();
        });
    }

    copyFileIfNotExists(sourcePath: string, path: string, cb: Function) {
        mkdirp(getDirName(path), function (err) {
            if (err) return cb(err);
            fs.copyFile(sourcePath, path, { flag: "wx" }, (error) => {});
            return cb();
        });
    }

    writeFile(path: string, contents: string, openFile, cb: Function) {
        mkdirp(getDirName(path), function (err) {
            if (err) return cb(err);
            fs.writeFile(path, contents, (error) => {
                /* handle error */
            });
            vscode.workspace.openTextDocument(path).then((doc) => {
                if (openFile) {
                    vscode.window.showTextDocument(doc, { preview: false });
                }
            });
            return cb();
        });
    }

    writeFileIfNotExists(path, contents, openFile, cb) {
        mkdirp(getDirName(path), function (err) {
            if (err) return cb(err);
            fs.writeFile(path, contents, { flag: "wx" }, (error) => {
                /* handle error */
            });
            vscode.workspace.openTextDocument(path).then((doc) => {
                if (openFile) {
                    vscode.window.showTextDocument(doc, { preview: false });
                    vscode.commands.executeCommand(
                        "editor.action.formatDocument"
                    );
                }
            });
            return cb();
        });
    }

    getFileAsJson(path: string) {
        try {
            return JSON.parse(fs.readFileSync(path)) || {};
        } catch (err) {
            return {};
        }
    }

    getFileAsArray(path: string) {
        try {
            return (
                fs.readFileSync(path, { encoding: "utf8" }).split("\n") || []
            );
        } catch {
            return [];
        }
    }

    fileNameToObject(listener: TextDocument) {
        var fileName = listener.fileName;
        var fileNameUse = listener.fileName.replace(workspace.rootPath, "");
        var fileNameArr = fileNameUse.split(/\\|\/|\.|\^/).slice(1); //
        var basePath = workspace.rootPath + nodePath.sep + fileNameArr.slice(0, 2).join(nodePath.sep);
        var meta = this.getFileMetadata(fileName);

        if (meta == null) {
            //TODO: Inform user filename not found and ask for table/field/sys_id
            return true;
        }

        if (fileNameArr[5] === "ts") {
            return true;
        }

        if (fileNameArr.length < 5) return true;
        if (fileNameArr[4].length != 32 && fileNameArr[1] != "sp_widget" && fileNameArr[1] != "background")
            return true; //must be the sys_id
        var scriptObj = <any>{};
        scriptObj.instance = meta.instance;
        scriptObj.tableName = meta.tableName;
        scriptObj.name = meta.name;
        scriptObj.fieldName = meta.fieldName;
        scriptObj.sys_id = meta.sys_id;
        scriptObj.fileName = listener.fileName;
        scriptObj.content = listener.getText();

        if (fileNameArr[1] == "sp_widget") {
            scriptObj.name = fileNameArr[2];
            scriptObj.testUrls = this.getFileAsArray(basePath + nodePath.sep + scriptObj.name + nodePath.sep + "test_urls.txt");

            if (fileNameArr[3] != "sp_ng_template") {
                var nameToField = {
                    "1 HTML Template": "template",
                    "2 SCSS": "css",
                    "3 Client Script": "client_script",
                    "4 Server Script": "script",
                    "5 Link function": "link",
                    "6 Option schema": "option_schema",
                    "7 Demo data": fileNameArr,
                };
                scriptObj.fieldName = nameToField[fileNameArr[3]];
                scriptObj.sys_id = this.getFileAsJson(basePath + nodePath.sep + scriptObj.name + nodePath.sep + "widget.json")["sys_id"];
            } 
        }
        return scriptObj;
    }

    addFileMetadata(record, cb: Function) {
        return this.updateFileMetadata(record, cb);
        // let found: boolean = false;
        // var contentPath = workspace.rootPath + nodePath.sep + record.instance.name + nodePath.sep + "contents.json";
        // var recs = this.getFileAsJson(contentPath);

        // if (Object.keys(recs).length != 0) {
        //     recs.files.forEach((rec) => {
        //         if (rec.sys_id == record.sys_id) found = true;
        //     });
        //     if (!found) {
        //         recs.files.push(record);
        //         fs.writeFile(contentPath, JSON.stringify(recs, null, 4), (error) => {});
        //     }
        // } else {
        //     recs = { files: [] };
        //     recs.files.push(record);
        //     mkdirp(getDirName(contentPath), function (err) {
        //         if (err) return cb(err);
        //         fs.writeFile(contentPath, JSON.stringify(recs, null, 4), (error) => {});
        //     });
        // }
        // return cb();
    }

    updateFileMetadata(record, cb: Function) {
        let found: boolean = false;
        var contentPath = workspace.rootPath + nodePath.sep + record.instance.name + nodePath.sep + "contents.json";
        var recs = this.getFileAsJson(contentPath);

        if (Object.keys(recs).length != 0) {
            for (var i = 0; i < recs.files.length; i++) {
                if (recs.files[i].sys_id == record.sys_id) {
                    found = true;
                    recs.files.splice(i, 1, record);
                }
            }
            if (!found) {
                recs.files.push(record);
            }
            fs.writeFile(contentPath, JSON.stringify(recs, null, 4), (error) => {});
        } else {
            recs = { files: [] };
            recs.files.push(record);
            mkdirp(getDirName(contentPath), function (err) {
                if (err) return cb(err);
                fs.writeFile(contentPath, JSON.stringify(recs, null, 4), (error) => {});
            });
        }
        return cb();
    }

    getFileMetadata(fileName: String) {
        var fileNameUse = fileName.replace(workspace.rootPath, "");
        var fileNameArr = fileNameUse.split(/\\|\/|\.|\^/).slice(1); //
        var contentPath = workspace.rootPath + nodePath.sep + fileNameArr[0] + nodePath.sep + "contents.json";
        var recs = this.getFileAsJson(contentPath);

         if (Object.keys(recs).length != 0) {
             for (var i = 0; i < recs.files.length; i++) {
                if (recs.files[i].filename == fileName) return recs.files[i];
             }
    } 

        return null;
    }

    writeInstanceSettings(instance) {
        var path = workspace.rootPath + nodePath.sep + instance.name + nodePath.sep + "settings.json";
        mkdirp(getDirName(path), function (err) {
            if (err) console.log(err);
            fs.writeFile(path, JSON.stringify(instance, null, 4), (error) => { });
        });
        instanceSettings[instance.name] = instance;
    }

    getInstanceSettings(instanceName: string) {
        if (typeof instanceSettings[instanceName] != "undefined") {
            //from variable if available
            return instanceSettings[instanceName];
        } else {
            var path = workspace.rootPath + nodePath.sep + instanceName + nodePath.sep + "settings.json";
            return this.getFileAsJson(path);
        }
    }

}
