/**
 * Z80 Assembler in Typescript
 *
 * File:        Parse.ts
 * Description: Fonctions uses by the parser to convert strings
 * Author:			Sebastien Andrivet
 * License:			GPLv3
 * Copyrights: 	Copyright (C) 2023 Sebastien Andrivet
 */

import { PosInfo } from './z80';
import { CompilationError } from '../types/Error';
import { parseData } from '../compiler/Compiler';

/**
 * Parse a number.
 * @param pos Position of the number in the source code.
 *            Position du nombre dans le code source.
 * @param str The characters of the number.
 *            Les caractères du nombre.
 * @param base The base of the number.
 *             La base du nombre.
 * @param nbBytes The number of bytes to represent this number (1 or 2)
 *                Le nombre d'octets pour représenter ce nombre (1 ou 2)
 */
export function parseNumber(
  pos: PosInfo,
  str: string,
  base: number,
  nbBytes: number
): number {
  // Convert the string to a number.
  // Conversion de la chaine en nombre.
  let v = parseInt(str, base);
  if (isNaN(v))
    throw new CompilationError(
      { filename: parseData.fileName, pos: pos },
      `Number '${str}' is invalid in base ${base}.`
    );
  switch (nbBytes) {
    case 1:
      // Must be able to fit this number into 8 bits.
      // On doit pouvoir représenter ce nombre sur 8 bits.
      if (v > 255 || v < -256)
        throw new CompilationError(
          { filename: parseData.fileName, pos: pos },
          `Number '${str}' does not fit into a byte.`
        );
      // If negative, take the 2-complement.
      // S'il est négatif, on prend son complément à 2.
      if (v < 0) v = 256 + v;
      break;

    case 2:
      // Must be able to fit this number into 16 bits.
      // On doit pouvoir représenter ce nombre sur 16 bits.
      if (v > 65535 || v < -65536)
        throw new CompilationError(
          { filename: parseData.fileName, pos: pos },
          `Number '${str}' does not fit into a word.`
        );
      // If negative, take the 2-complement.
      // S'il est négatif, on prend son complément à 2.
      if (v < 0) v = 65536 + v;
      break;

    default:
      throw new CompilationError(
        { filename: parseData.fileName, pos: pos },
        `Invalid number of bytes (${nbBytes})`
      );
  }

  return v;
}

/**
 * Parse a simple escape, i.e. a backslash followed by a character.
 * @param pos Position of the character in the source code.
 *            Position du caractère dans le code source.
 * @param c The character after the backslash.
 *          Le caractère après la barre oblique inversée.
 */
export function parseSimpleEscape(pos: PosInfo, c: string): number[] {
  switch (c) {
    case '"':
      return ['"'.charCodeAt(0)];
    default:
      throw new CompilationError(
        { filename: parseData.fileName, pos: pos },
        `Invalid escape: \\${c}`
      );
  }
}

/**
 * Parse an octal value.
 * @param pos Position of the value in the source code.
 *            Position de la valeur dans le code source.
 * @param value The characters representing the value.
 *              Les caractères représentant la valeur.
 */
export function parseOctalEscape(pos: PosInfo, value: string): number[] {
  const v = parseInt(value, 8);
  if (v > 255)
    throw new CompilationError(
      { filename: parseData.fileName, pos: pos },
      `Number '${value}' in octal escape sequence does not fit into a byte.`
    );
  return [v];
}

/**
 * Parse a hexadecimal value.
 * @param pos Position of the value in the source code.
 *            Position de la valeur dans le code source.
 * @param value The characters representing the value.
 *              Les caractères représentant la valeur.
 */
export function parseHexadecimalEscape(pos: PosInfo, value: string): number[] {
  const v = parseInt(value, 16);
  if (v > 255)
    throw new CompilationError(
      { filename: parseData.fileName, pos: pos },
      `Number '${value}' in hexadecimal escape sequence does not fit into a byte.`
    );
  return [v];
}

export function parseCharToAscii(pos: PosInfo, c: string): [number] {
  return [c.charCodeAt(0)];
}
