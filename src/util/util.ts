import * as ts from "typescript";
import { get } from "http";
import { Tree, FileEntry, MergeStrategy } from "@angular-devkit/schematics/src/tree/interface";
import {
  SchematicsException,
  SchematicContext,
  apply,
  url,
  move,
  forEach,
  mergeWith,
  template,
  Rule,
  noop
} from "@angular-devkit/schematics";
import {
  addSymbolToNgModuleMetadata
} from "@schematics/angular/utility/ast-utils";
import { InsertChange } from "@schematics/angular/utility/change";
import {
  JsonParseMode,
  parseJsonAst,
  JsonAstObject,
  normalize,
  join,
} from "@angular-devkit/core";

import {
  findPropertyInAstObject,
  appendPropertyInAstObject,
  insertPropertyInAstObjectInOrder
} from "@schematics/angular/utility/json-utils";
import { getWorkspace, updateWorkspace } from "@schematics/angular/utility/config";
import { getPackageJsonDependency } from "@schematics/angular/utility/dependencies";
import { BrowserBuilderOptions, BuilderTarget, Builders } from "@schematics/angular/utility/workspace-models";

export enum pkgJson {
  Path = "/package.json"
}

export enum Configs {
  JsonIndentLevel = 4
}

export interface NodePackage {
  name: string;
  version: string;
}

export function addAssets(host: Tree, assetsToAdd: string[]): Rule {

  const workspace = getWorkspace(host);

  if (workspace.defaultProject === undefined) {
    throw new SchematicsException('Could not find project');
  }

  const project = workspace.projects[workspace.defaultProject];

  if (project.architect != undefined && project.architect.build != null) {
    const build = project.architect.build as {} as BuilderTarget<Builders.Browser, BrowserBuilderOptions>;

    assetsToAdd.forEach(i => {
      if (build.options.assets == null) { build.options.assets = []; }
      build.options.assets.push(i as Object);
    });

    return updateWorkspace(workspace);
  }

  return noop();
}

/**
 * Attempt to retrieve the latest package version from NPM
 * Return an optional "latest" version in case of error
 * @param packageName
 */
export function getLatestNodeVersion(
  packageName: string,
  majorVersion: string | null = null
): Promise<NodePackage> {
  const DEFAULT_VERSION = majorVersion == null ? 'latest' : majorVersion === '7' ? '7.0.0-beta.24' : 'latest';

  return new Promise(resolve => {
    return get(`http://registry.npmjs.org/${packageName}`, res => {
      let rawData = "";
      res.on("data", chunk => (rawData += chunk));
      res.on("end", () => {
        try {
          const response = JSON.parse(rawData);
          const version = (response && response["dist-tags"]) || {};

          if (majorVersion != null) {
            let versionList = Object.keys(response['versions']);

            const foundVersionNumber = versionList.filter(i => i.indexOf(majorVersion) === 0).reverse()[0];
            const foundVersion = response['versions'][foundVersionNumber];
            resolve(buildPackage(foundVersion['name'], foundVersion['version']))
          } else {
            resolve(buildPackage(packageName, version.latest));
          }

        } catch (e) {
          resolve(buildPackage(packageName));
        }
      });
    }).on("error", () => resolve(buildPackage(packageName)));
  });

  function buildPackage(
    name: string,
    version: string = DEFAULT_VERSION
  ): NodePackage {
    return { name, version };
  }
}

export function addImport(tree: Tree, componentPath: string, classifiedName: string, importPath: string | null = null) {

  addSymbol(tree, componentPath, 'imports', classifiedName, importPath)
}

export function addExport(tree: Tree, componentPath: string, classifiedName: string, importPath: string | null = null) {

  addSymbol(tree, componentPath, 'exports', classifiedName, importPath)

}

function addSymbol(tree: Tree, componentPath: string, metadataField: string, classifiedName: string, importPath: string | null = null) {
  const text = tree.read(componentPath);

  if (text === null) {
    throw new SchematicsException(`File ${componentPath} does not exist.`);
  }

  const sourceText = text.toString("utf-8");
  const source = ts.createSourceFile(componentPath, sourceText, ts.ScriptTarget.Latest, true);

  const changes = addSymbolToNgModuleMetadata(source, componentPath, metadataField, classifiedName, importPath);

  const changeRecorder = tree.beginUpdate(componentPath);

  for (const change of changes) {
    if (change instanceof InsertChange) {
      changeRecorder.insertLeft(change.pos, change.toAdd);
    }
  }

  tree.commitUpdate(changeRecorder);
}


export function addPropertyToPackageJson(
  tree: Tree,
  context: SchematicContext,
  propertyName: string,
  propertyValue: { [key: string]: string }
) {
  const packageJsonAst = parseJsonAtPath(tree, pkgJson.Path);
  const pkgNode = findPropertyInAstObject(packageJsonAst, propertyName);
  const recorder = tree.beginUpdate(pkgJson.Path);

  if (!pkgNode) {
    // outer node missing, add key/value
    appendPropertyInAstObject(
      recorder,
      packageJsonAst,
      propertyName,
      propertyValue,
      Configs.JsonIndentLevel
    );
  } else if (pkgNode.kind === "object") {
    // property exists, update values
    for (let [key, value] of Object.entries(propertyValue)) {
      const innerNode = findPropertyInAstObject(pkgNode, key);

      if (!innerNode) {
        // script not found, add it
        context.logger.debug(`creating ${key} with ${value}`);

        insertPropertyInAstObjectInOrder(
          recorder,
          pkgNode,
          key,
          value,
          Configs.JsonIndentLevel
        );
      } else {
        // script found, overwrite value
        context.logger.debug(`overwriting ${key} with ${value}`);

        const { end, start } = innerNode;

        recorder.remove(start.offset, end.offset - start.offset);
        recorder.insertRight(start.offset, JSON.stringify(value));
      }
    }
  }

  tree.commitUpdate(recorder);
}

export function hasDependency(tree: Tree, name: string): boolean {

  return getPackageJsonDependency(tree, name) != null;

}

export function getAngularVersion(tree: Tree): string {

  const angularPackage = getPackageJsonDependency(tree, '@angular/core');

  //options.angularVersion = angularPackage == null ? '7' : angularPackage.version;

  return angularPackage == null ? '7' : angularPackage.version.replace('~', '').replace('^', '').substr(0, 1);

}

export function parseJsonAtPath(tree: Tree, path: string): JsonAstObject {
  const buffer = tree.read(path);

  if (buffer === null) {
    throw new SchematicsException("Could not read package.json.");
  }

  const content = buffer.toString();

  const json = parseJsonAst(content, JsonParseMode.Strict);
  if (json.kind != "object") {
    throw new SchematicsException(
      "Invalid package.json. Was expecting an object"
    );
  }

  return json;
}


export function mergeTemplates(options: any, mergeStrategy: MergeStrategy = MergeStrategy.AllowCreationConflict) {
  return (tree: Tree, _context: SchematicContext) => {
    setupOptions(tree, options);

    const movePath = normalize(options.path + "/");
    const templateSource = apply(url("./files/src"), [
      template({ ...options }),
      move(movePath),
      // fix for https://github.com/angular/angular-cli/issues/11337
      forEach((fileEntry: FileEntry) => {
        if (tree.exists(fileEntry.path)) {
          tree.overwrite(fileEntry.path, fileEntry.content);
        }
        return fileEntry;
      })
    ]);
    const rule = mergeWith(templateSource, mergeStrategy);
    return rule(tree, _context);
  };
}

export function setupOptions(host: Tree, options: any): Tree {
  const workspace = getWorkspace(host);
  if (!options.project) {
    options.project = Object.keys(workspace.projects)[0];
  }

  const project = workspace.projects[options.project];

  options.prefix = project.prefix;

  options.path = join(normalize(project.root), "src");



  return host;
}
