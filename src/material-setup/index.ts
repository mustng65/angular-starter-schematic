import {
  Rule,
  SchematicContext,
  Tree,
  externalSchematic,
  chain,
  noop,
} from '@angular-devkit/schematics';
import { addImport, hasDependency, addExport } from '../util/util';

// You don't have to export the function as default. You can also have more than one rule factory
// per file.
export function AddMaterial(_options: any): Rule {
  const matModuleList = [
    { module: 'MatToolbarModule', path: '@angular/material/toolbar' },
    { module: 'MatButtonModule', path: '@angular/material/button' },
    { module: 'MatInputModule', path: '@angular/material/input' },
    { module: 'MatIconModule', path: '@angular/material/icon' },
  ];
  const matFileName = 'material-components';
  const componentPath = `src/app/core/${matFileName}.module.ts`;

  return chain([addMaterialFramework(), addMaterialModule(), updateFiles()]);

  function addMaterialFramework(): Rule {
    return (tree: Tree, _context: SchematicContext) => {
      return hasDependency(tree, '@angular/material')
        ? noop()
        : externalSchematic('@angular/material', 'material-shell', {
            theme: '',
            typography: false,
            animations: true,
          });
    };
  }

  function addMaterialModule(): Rule {
    return (tree: Tree, _context: SchematicContext) => {
      const text = tree.read(componentPath);

      return text === null
        ? externalSchematic('@schematics/angular', 'module', {
            name: `/core/${matFileName}`,
            skipTests: true,
            flat: true,
          })
        : noop();
    };
  }

  function updateFiles(): Rule {
    return (tree: Tree, _context: SchematicContext) => {
      
      addImport(tree, componentPath, 'FormsModule', '@angular/forms');
      
      // Add Material Modules to Material Components module
      matModuleList.forEach((mat) => {
        addImport(tree, componentPath, mat.module, mat.path);

        addExport(tree, componentPath, mat.module, null);
      });

      // Add Material Components Module to main App module
      addImport(
        tree,
        'src/app/app.module.ts',
        'MaterialComponentsModule',
        './core/material-components.module'
      );

      return tree;
    };
  }
}
