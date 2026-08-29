declare const process: any;
declare namespace NodeJS { interface ErrnoException extends Error { code?: string } }
declare module "node:child_process" { export const spawnSync: any; }
declare module "node:fs/promises" { export const readdir: any; export const readFile: any; export const writeFile: any; }
declare module "node:url" { export const fileURLToPath: any; }
declare module "node:path" { export const extname: any; export const join: any; export const resolve: any; }
declare module "node:util" { export const parseArgs: any; }
