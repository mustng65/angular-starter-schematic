import { Rule, SchematicContext, Tree, schematic, chain } from '@angular-devkit/schematics';
import { mergeTemplates } from '../util/util';


// You don't have to export the function as default. You can also have more than one rule factory
// per file.
export function angularStarterSchematic(_options: any): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    return chain([
      schematic('material', _options),
      schematic('flex-layout', _options),
      schematic('navbar', _options),
      mergeTemplates(_options),
    ]);
    return tree;
  };
}
