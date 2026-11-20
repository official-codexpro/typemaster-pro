import { readFileSync, writeFileSync } from 'node:fs';

const targetPath = process.argv[2];
if (!targetPath) throw new Error('Pass the generated file path as the first argument.');

const generatedSource = readFileSync(targetPath, 'utf8');
const normalizedSource = generatedSource.replace(/^ +(?=\t)/gm, '').replace(/[\t ]+$/gm, '');
writeFileSync(targetPath, normalizedSource);
