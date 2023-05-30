import {Expression, PosInfo} from "../grammar/z80";

export type Label = {
  expression: Expression | null;
  value: number;
  known: boolean;
  used: boolean;
};

export type Labels = Map<string, Label>;

const labels: Labels = new Map<string, Label>();

export function resetLabels() {
  labels.clear();
}

export function addLabel(_: PosInfo, name: string, value: number | null) {
  const label = labels.get(name);
  if(!label) {
    labels.set(name, {expression: null, value: value ?? 0, known: value != null, used: false});
    return;
  }

  if(label.known) {
   label.value = value ?? 0;
   label.known = value != null;
   return;
  }

  label.value = value ?? 0;
  label.known = value != null;
}

export function addLabelExpression(_: PosInfo, name: string, expression: Expression) {
  const label = labels.get(name);
  if(!label) {
    labels.set(name, {expression: expression, value: 0, known: false, used: false});
    return;
  }

  if(label.known) return;
  label.expression = expression;
}

export function getLabelValue(name: string): number | null {
  const label = labels.get(name);
  if(!label) {
    labels.set(name, {expression: null, value: 0, known: false, used: true});
    return null;
  }

  label.used = true;
  if(label.known) return label.value;
  if(label.expression == null) return null;

  const value = label.expression.eval();
  if(value == null) return null;

  label.value = value;
  label.known = true;
  return value;
}

export function getLabel(name: string) {
  return labels.get(name);
}

export function getUnknownLabels(): string[] {
  return [...labels.entries()]
    .filter(([, label]) => !label.known && label.value == null)
    .map(([name]) => name);
}
