import {
  Rule,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { addImport } from '../util/util';
import { addPackageJsonDependency, NodeDependencyType } from '@schematics/angular/utility/dependencies';

// You don't have to export the function as default. You can also have more than one rule factory
// per file.
export function AddMFlexLayout(_options: any): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    addPackageJsonDependency(tree, {
      type: NodeDependencyType.Default,
      name:'@angular/flex-layout',
      version:'~10.0.0-beta',
    });

    // Add Flex Layout Module to main App module
    addImport(
      tree,
      'src/app/app.module.ts',
      'FlexLayoutModule',
      '@angular/flex-layout'
    );

    return tree;
  };
}
