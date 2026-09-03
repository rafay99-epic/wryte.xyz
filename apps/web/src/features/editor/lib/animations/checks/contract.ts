import type {
  AnimationDiagnostic,
  AnimationLanguage,
  DiagnosticSeverity,
} from "@wryte/backend/_lib/animationChecks";
import type ts from "typescript";

const SSR_UNSAFE_GLOBALS = new Set([
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
]);

const TIMER_FUNCTIONS = new Set([
  "setInterval",
  "setTimeout",
  "requestAnimationFrame",
  "addEventListener",
]);

const ANIMATION_DRIVERS = new Set(["setInterval", "requestAnimationFrame"]);

const LABELLING_ATTRIBUTES = new Set(["aria-label", "aria-labelledby"]);

type RuleContext = {
  ts: typeof ts;
  sourceFile: ts.SourceFile;
  diagnostics: AnimationDiagnostic[];
};

function report(
  context: RuleContext,
  node: ts.Node,
  rule: string,
  severity: DiagnosticSeverity,
  message: string,
): void {
  const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(
    node.getStart(context.sourceFile),
  );
  context.diagnostics.push({
    rule,
    severity,
    message,
    line: line + 1,
    column: character + 1,
  });
}

function calleeName(tsApi: typeof ts, node: ts.CallExpression): string | null {
  const { expression } = node;
  if (tsApi.isIdentifier(expression)) return expression.text;
  if (tsApi.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

function checkExplicitAny(context: RuleContext, node: ts.Node): void {
  if (node.kind !== context.ts.SyntaxKind.AnyKeyword) return;
  report(
    context,
    node,
    "no-explicit-any",
    "error",
    "`any` switches type checking off. Use `unknown` and narrow it, or name the real shape.",
  );
}

function checkModuleScopeDom(context: RuleContext): void {
  const { ts: tsApi, sourceFile } = context;

  const walk = (node: ts.Node): void => {
    if (tsApi.isFunctionLike(node) || tsApi.isClassLike(node)) return;
    if (tsApi.isTypeOfExpression(node)) return;

    if (tsApi.isIdentifier(node) && SSR_UNSAFE_GLOBALS.has(node.text)) {
      const parent = node.parent as ts.Node | undefined;
      const isPropertyName =
        parent !== undefined &&
        tsApi.isPropertyAccessExpression(parent) &&
        parent.name === node;
      if (!isPropertyName) {
        report(
          context,
          node,
          "no-module-scope-dom",
          "error",
          `\`${node.text}\` is read while the module loads, which crashes during the server build. Move it inside an effect behind a \`typeof ${node.text} === "undefined"\` guard.`,
        );
      }
    }
    node.forEachChild(walk);
  };

  sourceFile.statements.forEach(walk);
}

function returnsCleanup(tsApi: typeof ts, body: ts.ConciseBody): boolean {
  if (!tsApi.isBlock(body)) return true;

  let found = false;
  const walk = (node: ts.Node): void => {
    if (found) return;
    if (tsApi.isFunctionLike(node)) return;
    if (tsApi.isReturnStatement(node) && node.expression !== undefined) {
      const returned = node.expression;
      if (
        tsApi.isArrowFunction(returned) ||
        tsApi.isFunctionExpression(returned) ||
        tsApi.isIdentifier(returned)
      ) {
        found = true;
        return;
      }
    }
    node.forEachChild(walk);
  };
  body.statements.forEach(walk);
  return found;
}

function collectTimerCalls(
  tsApi: typeof ts,
  body: ts.ConciseBody,
): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const walk = (node: ts.Node): void => {
    if (tsApi.isCallExpression(node)) {
      const name = calleeName(tsApi, node);
      if (name !== null && TIMER_FUNCTIONS.has(name)) calls.push(node);
    }
    node.forEachChild(walk);
  };
  walk(body as ts.Node);
  return calls;
}

function checkEffectCleanup(context: RuleContext, node: ts.Node): void {
  const { ts: tsApi } = context;
  if (!tsApi.isCallExpression(node)) return;
  if (calleeName(tsApi, node) !== "useEffect") return;

  const [callback] = node.arguments;
  if (
    callback === undefined ||
    (!tsApi.isArrowFunction(callback) && !tsApi.isFunctionExpression(callback))
  ) {
    return;
  }

  const timers = collectTimerCalls(tsApi, callback.body);
  const firstTimer = timers[0];
  if (firstTimer === undefined) return;
  if (returnsCleanup(tsApi, callback.body)) return;

  report(
    context,
    firstTimer,
    "effect-needs-cleanup",
    "error",
    "This effect starts a timer or listener but returns no cleanup, so it leaks on every re-render and under Strict Mode.",
  );
}

function checkReducedMotion(context: RuleContext): void {
  const { ts: tsApi, sourceFile } = context;
  if (sourceFile.text.includes("prefers-reduced-motion")) return;

  let driver: ts.CallExpression | null = null;
  const walk = (node: ts.Node): void => {
    if (driver !== null) return;
    if (tsApi.isCallExpression(node)) {
      const name = calleeName(tsApi, node);
      if (name !== null && ANIMATION_DRIVERS.has(name)) {
        driver = node;
        return;
      }
    }
    node.forEachChild(walk);
  };
  walk(sourceFile);

  if (driver === null) return;
  report(
    context,
    driver,
    "respect-reduced-motion",
    "warning",
    'This animation runs unconditionally. Bail out when `matchMedia("(prefers-reduced-motion: reduce)").matches` is true.',
  );
}

function hasTitleChild(tsApi: typeof ts, element: ts.JsxElement): boolean {
  return element.children.some((child) => {
    if (tsApi.isJsxElement(child)) {
      return child.openingElement.tagName.getText() === "title";
    }
    return false;
  });
}

function hasLabellingAttribute(
  tsApi: typeof ts,
  attributes: ts.JsxAttributes,
): boolean {
  return attributes.properties.some((property) => {
    if (!tsApi.isJsxAttribute(property)) return false;
    return LABELLING_ATTRIBUTES.has(property.name.getText());
  });
}

function checkSvgAccessibleName(context: RuleContext, node: ts.Node): void {
  const { ts: tsApi } = context;

  if (tsApi.isJsxSelfClosingElement(node) && node.tagName.getText() === "svg") {
    if (!hasLabellingAttribute(tsApi, node.attributes)) {
      report(
        context,
        node,
        "svg-needs-accessible-name",
        "warning",
        'This `<svg>` has no accessible name. Add `role="img"` with `aria-label`, or a `<title>` child.',
      );
    }
    return;
  }

  if (!tsApi.isJsxElement(node)) return;
  if (node.openingElement.tagName.getText() !== "svg") return;
  if (hasLabellingAttribute(tsApi, node.openingElement.attributes)) return;
  if (hasTitleChild(tsApi, node)) return;

  report(
    context,
    node.openingElement,
    "svg-needs-accessible-name",
    "warning",
    'This `<svg>` has no accessible name. Add `role="img"` with `aria-label`, or a `<title>` child.',
  );
}

function checkTypeScriptInJavaScript(
  context: RuleContext,
  node: ts.Node,
): void {
  const { ts: tsApi } = context;

  const isTypeOnlyDeclaration =
    tsApi.isInterfaceDeclaration(node) ||
    tsApi.isTypeAliasDeclaration(node) ||
    tsApi.isEnumDeclaration(node) ||
    tsApi.isAsExpression(node) ||
    tsApi.isSatisfiesExpression(node) ||
    tsApi.isTypeAssertionExpression(node);

  const hasAnnotation =
    (tsApi.isParameter(node) ||
      tsApi.isVariableDeclaration(node) ||
      tsApi.isPropertyDeclaration(node) ||
      tsApi.isFunctionDeclaration(node) ||
      tsApi.isMethodDeclaration(node) ||
      tsApi.isArrowFunction(node) ||
      tsApi.isFunctionExpression(node)) &&
    node.type !== undefined;

  if (!isTypeOnlyDeclaration && !hasAnnotation) return;

  report(
    context,
    node,
    "no-typescript-in-javascript",
    "error",
    "TypeScript syntax in a JavaScript animation. This publishes as .jsx and will not build. Remove the annotation, or switch the project to TypeScript in settings.",
  );
}

export function runContractChecks(
  tsApi: typeof ts,
  sourceFile: ts.SourceFile,
  language: AnimationLanguage,
): AnimationDiagnostic[] {
  const context: RuleContext = { ts: tsApi, sourceFile, diagnostics: [] };

  const walk = (node: ts.Node): void => {
    checkExplicitAny(context, node);
    checkEffectCleanup(context, node);
    checkSvgAccessibleName(context, node);
    if (language === "jsx") checkTypeScriptInJavaScript(context, node);
    node.forEachChild(walk);
  };
  walk(sourceFile);

  checkModuleScopeDom(context);
  checkReducedMotion(context);

  const seen = new Set<string>();
  return context.diagnostics
    .filter((d) => {
      const key = `${d.rule}:${String(d.line)}:${String(d.column)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.line - b.line || a.column - b.column);
}
