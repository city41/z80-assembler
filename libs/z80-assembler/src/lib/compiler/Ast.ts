/**
 * Z80 Assembler in Typescript
 *
 * File:        Ast.ts
 * Description: Types for building the Abstract Syntax Tree
 * Author:			Sebastien Andrivet
 * License:			GPLv3
 * Copyrights: 	Copyright (C) 2023 Sebastien Andrivet
 */

/**
 * Assembler Z80 en Typescript
 *
 * Fichier:     Ast.ts
 * Description: Types pour construire un arbre syntaxique abstrait.
 * Author:			Sebastien Andrivet
 * License:			GPLv3
 * Copyrights: 	Copyright (C) 2023 Sebastien Andrivet
 */
import {Address, byte, bytes, Position} from '../types/Types';
import {CompilationError} from "../types/Error";
import {ByteValue, Expression, PosInfo, WordValue} from "../grammar/z80";
import {getLabelValue} from "./Labels";
import {parseData} from "../compiler/Compiler";

/**
 * A function returning a number (if it is known) or null (if it is unknown).
 * Une function qui ne prend pas d'argument et qui retourne un nombre (s'il est connu) ou null (s'il est inconnu).
 */
export type EvalFunc = (pc: Address, mustExist: boolean) => number | null;

/**
 * An abstract element generated by the parser.
 * Un élément abstrait générà par l'analyseur.
 */
export interface AstBase {
  /**
   * The number of bytes that will be generated by this element.
   * Le nombre d'octets générés par cet élément.
   */
  get size(): number;

  /**
   * Generate actual bytes.
   * Génération des octets
   * @param instructionAddress Address of the next byte to generate,
   *                           Adresse du prochain octet à générer.
   */
  generate(instructionAddress: number): bytes;
}

/**
 * An AST element that represents a block of bytes.
 * Un élément de l'AST qui représente un bloc d'octets.
 */
class ByteBlock implements AstBase {
  private readonly position0: Position;
  private readonly position1?: Position;

  /**
   * Constructor.
   * Constructeur.
   * @param pos0 Position of the length of the block.
   *             Position de la taille du block.
   * @param length Length of the block.
   *               Taille du bloc.
   * @param pos1 Position of the value.
   *             Position de la valeur.
   * @param value Value to use to fill the block.
   *              La valeur à utiliser pour remplir le bloc.
   */
  constructor(
    pos0: PosInfo,
    private length: Expression,
    pos1: PosInfo | undefined,
    private value: Expression | undefined) {
    this.position0 = {filename: parseData.fileName, pos: pos0};
    if(pos1) this.position1 = {filename: parseData.fileName, pos: pos1};
  }

  /**
   * The number of bytes that will be generated by this element.
   * Le nombre d'octets générés par cet élément.
   */
  get size(): number {
    // Evaluate the size
    // Evalue la taille.
    const size = this.length.eval(0, true);
    // Is it valid?
    // Est-elle valide ?
    if(size == null) throw new CompilationError(this.position0, "Unknown size for the data block");
    if(size < 0) throw new CompilationError(this.position0, `Invalid size size for the data block: ${size}`);
    return size;
  }

  /**
   * Evaluate the expression for the value used to fill the block.
   * Evalue l'expression pour la valeur utilisée pour remplir le bloc.
   * @private
   */
  private getValue(pc: Address) {
    // Be sure we have valid data.
    // On s'assure d'avoir des données valides.
    if(this.value == null || this.position1 == null) return 0;
    // Evaluate the expression for the value.
    // On évalue l'expression pour la valeur.
    let v =  this.value.eval(pc, true);
    // If the value is null (unknown), we have a compilation error.
    // Si la valeur est nulle (inconnue), nous avons une erreur de compilation.
    if(v == null) throw new CompilationError(this.position1, `Not able to determine a value`);
    // If the value does not fit into 8-bit, we have a compilation error.
    // Si la valeur ne peux pas être représentée sur 8-bit, nous avons une erreur de compilation.
    if(v < -256 || v > 255) throw new CompilationError(this.position1, `Invalid 8-bits value: ${v}`);
    // If the value is negative, take its 2-complement.
    // Si la valeur est négative, on prend son complément à 2.
    if(v < 0) v = 256 + v;
    return v;
  }

  /**
   * Generate actual bytes.
   * Génération des octets
   */
  generate(pc: Address): bytes {
    // Prepare an array of the right size and fill it.
    // On prépare un tableau de la bonne taille et on le remplit.
    const array = new Array<byte>(this.size);
    array.fill(this.getValue(pc));
    return array;
  }
}

/**
 * An AST element that represents a 16-byte value.
 * Un élément de l'AST qui représente une valeur sur 16 bits.
 */
class Value16 implements AstBase {
  private readonly position: Position;

  /**
   * Constructor.
   * Constructeur.
   * @param pos Position of the expression for the value.
   *            Position de l'expression pour la valeur.
   * @param expression Expression for the value.
   *                   Expression pour la valeur.
   */
  constructor(pos: PosInfo, private expression: Expression) {
    this.position = {filename: parseData.fileName, pos: pos}
  }

  /**
   * The number of bytes that will be generated by this element.
   * Le nombre d'octets générés par cet élément.
   */
  get size(): number { return 2; }

  /**
   * Generate actual bytes.
   * Génération des octets
   */
  generate(pc: Address): bytes {
    // Evaluate the expression for the value.
    // On évalue l'expression pour la valeur.
    let v = this.expression.eval(pc, true);
    // If the value is null (unknown), we have a compilation error.
    // Si la valeur est nulle (inconnue), nous avons une erreur de compilation.
    if(v == null) throw new CompilationError(this.position, `Not able to determine the 16-bits value`);
    // If the value does not fit into 16-bit, we have a compilation error.
    // Si la valeur ne peut pas être représentée sur 16-bit, nous avons une erreur de compilation.
    if(v < -65536 || v > 65535) throw new CompilationError(this.position, `Invalid 16-bits value: ${v}`);
    // If the value is negative, take its 2-complement.
    // Si la valeur est négative, on prend son complément à 2.
    if(v < 0) v = 65536 + v;
    // Return two bytes. The first one is the low part, the second is the high part (little endian).
    // Retourne deux octets. Le premier est la partie basse, le deuxième la partie haute (petit boutiste)
    return [v & 0x00FF, (v & 0xFF00) >> 8];
  }
}

/**
 * An AST element that represents a 8-byte value.
 * Un élément de l'AST qui représente une valeur sur 8 bits.
 */
class Value8 implements AstBase {
  private readonly position: Position;

  constructor(pos: PosInfo, private expression: Expression) {
    this.position = {filename: parseData.fileName, pos: pos}
  }

  /**
   * The number of bytes that will be generated by this element.
   * Le nombre d'octets générés par cet élément.
   */
  get size(): number { return 1; }

  /**
   * Generate actual bytes.
   * Génération des octets
   */
  generate(pc: Address): bytes {
    // Evaluate the expression for the value.
    // On évalue l'expression pour la valeur.
    let v = this.expression.eval(pc, true);
    // If the value is null (unknown), we have a compilation error.
    // Si la valeur est nulle (inconnue), nous avons une erreur de compilation.
    if(v == null) throw new CompilationError(this.position, `Not able to determine the 8-bits value`);
    // If the value does not fit into 8-bit, we have a compilation error.
    // Si la valeur ne peux pas être représentée sur 8-bit, nous avons une erreur de compilation.
    if(v < -256 || v > 255) throw new CompilationError(this.position, `Invalid 8-bits value: ${v}`);
    // If the value is negative, take its 2-complement.
    // Si la valeur est négative, on prend son complément à 2.
    if(v < 0) v = 256 + v;
    return [v];
  }
}

/**
 * An AST element that represents a negative 8-byte value.
 * Un élément de l'AST qui représente la négation d'une valeur sur 8 bits.
 */
class ValueNeg8 implements AstBase {
  private readonly position: Position;

  constructor(pos: PosInfo, private expression: Expression) {
    this.position = {filename: parseData.fileName, pos: pos}
  }

  /**
   * The number of bytes that will be generated by this element.
   * Le nombre d'octets générés par cet élément.
   */
  get size(): number { return 1; }

  /**
   * Generate actual bytes.
   * Génération des octets
   */
  generate(pc: Address): bytes {
    // Evaluate the expression for the value.
    // On évalue l'expression pour la valeur.
    let v = this.expression.eval(pc, true);
    // If the value is null (unknown), we have a compilation error.
    // Si la valeur est nulle (inconnue), nous avons une erreur de compilation.
    if(v == null) throw new CompilationError(this.position, `Not able to determine the 8-bits value`);
    // Take the opposite.
    // On prend l'opposé.
    v = -v;
    // If the value does not fit into 8-bit, we have a compilation error.
    // Si la valeur ne peux pas être représentée sur 8-bit, nous avons une erreur de compilation.
    if(v < -256 || v > 255) throw new CompilationError(this.position, `Invalid 8-bits value: ${v}`);
    // If the value is negative, take its 2-complement.
    // Si la valeur est négative, on prend son complément à 2.
    if(v < 0) v = 256 + v;
    return [v];
  }
}

/**
 * An AST element that represents an absolute offset for a relative jump.
 * Un élément de l'AST qui représente le décalage absolu d'un saut relatif.
 */
class Jr implements AstBase {
  private readonly position: Position;

  constructor(pos: PosInfo, private expression: Expression) {
    this.position = {filename: parseData.fileName, pos: pos}
  }
  /**
   * The number of bytes that will be generated by this element.
   * Le nombre d'octets générés par cet élément.
   */
  get size(): number { return 1; }

  /**
   * Generate actual bytes.
   * Génération des octets
   */
  generate(pc: Address): bytes {
    // Evaluate the expression for the offset.
    // On évalue l'expression pour le décalage.
    let offset = this.expression.eval(pc, true);
    // If the offset is null (unknown), we have a compilation error.
    // Si le décalage est nulle (inconnue), nous avons une erreur de compilation.
    if(offset == null) throw new CompilationError(this.position, `Not able to determine the offset value`);
    // The offset has to be between -126 and 129.
    // Le décalage doit être entre -126 et 129.
    if(offset < -126 || offset > 129) throw new CompilationError(this.position, `Invalid offset for JR instruction: ${offset}`);
    // The actual representation is the offset minus 2.
    // La représentation effective est le décalage moins 2.
    offset -= 2;
    // If the value is offset, take its 2-complement.
    // Si le décalage est négative, on prend son complément à 2.
    if(offset < 0) offset = 256 + offset;
    return [offset];
  }
}

/**
 * An AST element that represents a relative offsez for a relative jump.
 * Un élément de l'AST qui représente le décalage relatif d'un saut relatif.
 */
class JrRelative implements AstBase {
  private readonly position: Position;

  constructor(pos: PosInfo, private label: string) {
    this.position = {filename: parseData.fileName, pos: pos};
  }

  /**
   * The number of bytes that will be generated by this element.
   * Le nombre d'octets générés par cet élément.
   */
  get size(): number { return 1; }

  /**
   * Generate actual bytes.
   * Génération des octets
   * @param pc Address of the next byte to generate,
   *           Adresse du prochain octet à générer.
   */
  generate(pc: Address): bytes {
    if(pc == null) throw new CompilationError(this.position, `Not able to determine PC value`);
    // Get the value of the label.
    // Obtient la valeur de l'étiquette.
    const targetAddress = getLabelValue(pc, this.label, this.position, true, true);
    // If the value is null (unknown), we have a compilation error.
    // Si la valeur est nulle (inconnue), nous avons une erreur de compilation.
    if(targetAddress == null) throw new CompilationError(this.position, `Not able to determine the value of label '${this.label}'`);
    // The offset is between the address hold by the label and the address of the current instruction.
    // Le décalage est entre l'adresse détenue par l'étiquette et l'adresse de l'instruction courante.
    let offset = targetAddress - pc;
    // The offset has to be between -126 and 129.
    // Le décalage doit être entre -126 et 129.
    if(offset < -126 || offset > 129) throw new CompilationError(this.position, `Label ${this.label} is to far from JR instruction: ${offset} bytes`);
    // The actual representation is the offset minus 2.
    // La représentation effective est le décalage moins 2.
    offset -= 2;
    // If the value is offset, take its 2-complement.
    // Si le décalage est négative, on prend son complément à 2.
    if(offset < 0) offset = 256 + offset;
    return [offset];
  }
}

/**
 * An AST element is either a number (the raw byte value) or derived from AstBase.
 */
export type AstElement = number | AstBase;

/**
 * Array of AST elements
 */
export type AstElements = AstElement[];

/**
 * Determine if an AST element is a raw byte or derived from AstBase (i.e. abstract)
 * @param element The element to test.
 * @return true if the element is concrete (a raw byte value), false if it is abstract.
 */
export function isAbstract(element: AstElement): element is AstBase {
  return (element as AstBase).generate !== undefined;
}

/**
 * Determine the actual size in byte of an AST element.
 * @param element The AST element.
 * @return The number of bytes that will be generated by this element
 */
export function getByteSize(element: AstElement): number {
  return isAbstract(element) ? element.size : 1;
}

/**
 * Get the low part of a 16-bit little endian value.
 * @param value A 16-bit little endian value.
 */
export function low(value: number) {
  return value & 0x00FF;
}

/**
 * Get the high part of a 16-bit little endian value.
 * @param value A 16-bit little endian value.
 */
export function high(value: number) {
  return (value & 0xFF00) >> 8;
}

/**
 * An Evaluable interface, i.e. that contains an eval function that returns a number or null.
 */
interface Evaluable { eval: EvalFunc; }

/**
 * An Inner Expression i.e. that extends an Evaluable interface.
 */
interface InnerExpression<E extends Evaluable> { e: E; }

/**
 * A Binary operation interface, i.e. a function with two arguments and that returns a number.
 */
type BinaryOperation = (a: number, b: number) => number

/**
 * A Unary operation interface, i.e. a function with one argument and that returns a number.
 */
type UnaryOperation = (a: number) => number

/**
 * A Binary operation such as: 2 * 4.
 * Une expression binaire telle que: 2 * 4.
 * @param left Left side of the binary function.
 *             Le coté gauche de l'opération binaire.
 * @param right Right side of the binary function.
 *              Le coté droit de l'opération binaire
 * @param op Operation to be applied to the left and right side.
 *           L'opération à appliquer aux opérandes
 */
export function binaryOperation<
  Operation extends BinaryOperation,
  Inner extends Evaluable,
  Left extends InnerExpression<Inner>,
  Right extends Evaluable>(left: Left | null, right: Right, op: Operation): EvalFunc {
  return (pc: Address, mustExist: boolean) => {
    // Evaluate the right side
    // Evalue le coté droit
    const rightValue = right.eval(pc, mustExist);
    // If the left side is empty, we return the right side
    // Si le coté gauche est vide, on retourne la valeur du coté droit.
    if(!left) return rightValue;
    // Evaluate the left side
    // Evalue le coté gauche
    const leftValue = left.e.eval(pc, mustExist);
    // If one of the values is null, the result is null. Otherwise, apply the operation.
    // Si l'une des valeurs est nulle, le résultat est nul. Sinon, on applique l'opération.
    return leftValue == null || rightValue == null ? null : op(leftValue, rightValue);
  }
}

/**
 * A map of strings versus binary operations. For example: '*' => operatorMul
 */
type BinaryOperationsMap = { [key: string]: BinaryOperation };

/**
 * A map of strings versus unary operations. For example: '-' => operatorNeg
 */
type UnaryOperationsMap = { [key: string]: UnaryOperation };

/**
 * An Inner Operator i.e. that extends an Inner Expression, itself extending an Evaluable.
 */
interface InnerOp<E extends Evaluable> extends InnerExpression<E>{ op: string; }

/**
 * A Binary operation such as: 2 * 4.
 * Une expression binaire telle que: 2 * 4.
 * @param left Left side of the binary function.
 *             Le coté gauche de l'opération binaire.
 * @param right Right side of the binary function.
 *              Le coté droit de l'opération binaire
 * @param map Map the operations to be applied to the left and right side.
 *            Une correspondance pour les opérations à appliquer aux opérandes.
 */
export function binaryOperations<
  Inner extends Evaluable,
  Left extends InnerOp<Inner>,
  Right extends Evaluable>(left: Left | null, right: Right, map: BinaryOperationsMap): EvalFunc {
  return (pc: Address, mustExist: boolean) => {
    // Evaluate the right side
    // Evalue le coté droit
    const rightValue = right.eval(pc, mustExist);
    // If the left side is empty, we return the right side value.
    // Si le coté gauche est vide, on retourne la valeur du coté droit.
    if(!left) return rightValue;
    // Evaluate the left side
    // Evalue le coté gauche
    const leftValue = left.e.eval(pc, mustExist);
    // If one of the values is null, the result is null. Otherwise, apply the operation.
    // Si l'une des valeurs est nulle, le résultat est nul. Sinon, on applique l'opération.
    return leftValue == null || rightValue == null ? null : map[left.op](leftValue, rightValue);
  }
}

/**
 * A Unary operation.
 * @param e The argument.
 * @param op The operation to be applied to the argument.
 */
export function unaryOperation<
  Operation extends UnaryOperation,
  E extends Evaluable>(e: E, op: Operation): EvalFunc {
  // Evaluate the argument. If the value is null, the result is null. Otherwise, apply the operation.
  // Evalue l'argument. Si la valeur est nulle, le résultat est nul. Sinon, on applique l'opération.
  return (pc: Address, mustExist: boolean) => {
    const value = e.eval(pc, mustExist);
    return (value == null) ? null : op(value);
  }
}

/**
 * A Unary operation.
 * @param e The argument.
 * @param op The operation to be applied to the argument as a string.
 * @param map Map the operations to be applied to the argument.
 */
export function unaryOperations<
  E extends Evaluable>(e: E, op: string, map: UnaryOperationsMap): EvalFunc {
  return (pc: Address, mustExist: boolean) => {
    const value = e.eval(pc, mustExist);
    return (value == null) ? null : map[op](value);
  }
}

// Note: As far as I know, it is not possible to manipulate in Javascript and Typescript builtin operators.
// So we define a set of functions for this purpose.
// Note: Autant que je sache, il n'est pas possible de manipuler en Javascript et Typescript les opérateurs intégrés.
// Donc on définit un ensemble de fonction pour cela.

export const operatorOr = (a: number, b: number) => a | b;
export const operatorXor = (a: number, b: number) => a ^ b;
export const operatorAnd = (a: number, b: number) => a & b;
export const operatorLeftShift = (a: number, b: number) => a << b;
export const operatorRightShift = (a: number, b: number) => a >> b;
export const operatorAdd = (a: number, b: number) => a + b;
export const operatorSub = (a: number, b: number) => a - b;
export const operatorMul = (a: number, b: number) => a * b;
export const operatorDiv = (a: number, b: number) => Math.trunc(a / b);
export const operatorModulo = (a: number, b: number) => a % b;
export const operatorPlus = (a: number) => +a;
export const operatorNeg = (a: number) => -a;
export const operatorInvert = (a: number) => ~a;
export const operatorIdentity = (a: number) => a;

/**
 * Returns an AST element that represents the low part of a little-endian 16-bit value.
 * Retourne un élément de l'AST qui représente la partie basse d'une valeur 16 bits en petit boutiste.
 * @param pos The position of the element in the source.
 *            La position de l'élément dans le code source.
 * @param e The 16-bit value.
 *          La valeur 16-bit.
 */
export function value16LE(pos: PosInfo, e: Expression): AstElement {
  return new Value16(pos, e);
}

/**
 * Returns an AST element that represents an 8-bit unsigned value.
 * Retourne un élément de l'AST qui représente une valeur 8 bits.
 * @param pos The position of the element in the source.
 *            La position de l'élément dans le code source.
 * @param e The 8-bit unsigned value.
 *          La valeur 8-bit.
 */
export function value8(pos: PosInfo, e: Expression): AstElement {
  return new Value8(pos, e);
}

/**
 * Returns an AST element that represents an 8-bit signed offset for IX or IY.
 * Retourne un élément de l'AST qui représente un décalage 8 bits signé pour IX ou IY.
 * @offset The offset for IX or IY with:
 * pos The position of the element in the source.
 *     La position de l'élément dans le code source.
 * s The sign of the value.
 * e The 8-bit signed décalage
 *   Le décalage 8-bit signée.
 */
export function index(offset: {pos: PosInfo, s: string, d: Expression} | null): AstElement {
  return !offset ? 0 : offset.s === '-' ? new ValueNeg8(offset.pos, offset.d) : new Value8(offset.pos, offset.d);
}

/**
 * Returns an AST element that represents an offset for a JR (jump relative) opcode.
 * Retourne un élément de l'AST qui représente un décalage pour un saut relatif JR.
 * @param pos The position of the element in the source.
 *            La position de l'élément dans le code source.
 * @param e The offset value.
 *          La valeur du décalage.
 */
export function jrOffset(pos: PosInfo, e: Expression): AstElement {
  return new Jr(pos, e);
}

/**
 * Returns an AST element that represents an relative offset for a JR (jump relative) opcode.
 * Retourne un élément de l'AST qui représente un décalage relatif pour un saut relatif JR.
 * @param pos The position of the element in the source.
 *            La position de l'élément dans le code source.
 * @param label The label that will give the offset value
 *              L'étiquette qui va donner la valeur du décalage.
 */
export function jrRelativeOffset(pos: PosInfo, label: string): AstElement {
  return new JrRelative(pos, label);
}

/**
 * An Inner Byte, i.e. it contains an inner field that is a Byte value.
 * Un octet interne, c.-à-d. qui contient un champ inner de type ByteValue.
 */
export interface InnerByte { inner: ByteValue }

/**
 * An Inner Word, i.e. it contains an inner field that is a Word value.
 * Un mot interne, c.-à-d. qui contient un champ inner de type WordValue.
 */
export interface InnerWord { inner: WordValue }

/**
 * The bytes of a Byte directive.
 * Les octets d'une directive Byte.
 * @param _ The position of the bytes in the source code.
 *          La position des octets dans le code source.
 * @param data0 The first byte.
 *              Le premier octet.
 * @param data The other bytes.
 *             Les autres octets.
 */
export function dataBytes(_: PosInfo, data0: ByteValue, data: InnerByte[]): AstElements {
  return data.reduce((r, c) => r.concat(c.inner.elements), data0.elements);
}

/**
 * The words of a Word directive.
 * Les mots d'une directive Word.
 * @param _ The position of the words in the source code.
 *          La position des mots dans le code source.
 * @param data0 The first word.
 *              Le premier mot.
 * @param data The other words.
 *             Les autres mots.
 */
export function dataWords(_: PosInfo, data0: WordValue, data: InnerWord[]): AstElements {
  return data.reduce((r, c) => r.concat(c.inner.elements), data0.elements);
}

/**
 * The parameters of a block of data.
 * Les paramètres d'un bloc de données.
 * @param pos0 The position of the length in the source code.
 *             La position de la taille dans le code source.
 * @param length The length (in bytes) of the block
 *               La taille (en octets) du bloc.
 * @param pos1 The position of the value in the source code.
 *             La position de la valeur dans le code source.
 * @param value The value used to initialize the block.
 *              La valeur utilisée pour initialiser le bloc.
 */
export function dataBlock(pos0: PosInfo, length: Expression, pos1: PosInfo | undefined, value: Expression | undefined): AstElement {
  return new ByteBlock(pos0, length, pos1, value);
}

export function labelValue(pos: PosInfo, name: string) {
  return (pc: Address, mustExist: boolean) =>
    getLabelValue(pc, name, {filename: parseData.fileName, pos: pos}, true, mustExist);
}

export function value(nn: number) {
  return (pc: Address, mustExist: boolean) => nn;
}
