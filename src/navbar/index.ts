import {
    Rule, chain, externalSchematic
} from "@angular-devkit/schematics";
import { mergeTemplates } from "../util/util";

export function CreateNavbar(_options: any): Rule {
    return chain([
        externalSchematic("@schematics/angular", "component", { name: "/common/navbar", style: "scss" }),
        mergeTemplates(_options)
    ]);
}

