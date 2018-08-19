import { parse } from "@babel/parser";
import * as babel from "@babel/core";
import generate from '@babel/generator';
import * as t from '@babel/types'

const properties = {
  m: true,
  mt: true,
  mr: true,
  mb: true,
  ml: true,
  mx: true,
  my: true,
  p:  true,
  pt: true,
  pr: true,
  pb: true,
  pl: true,
  px: true,
  py: true
}

const breakpoints = [
  null,
  'xs',
  'md',
  'lg'
]

const pushClassName = (name, { value} , { classNames }) => classNames.push(`${name}-${value}`) 

const pushInterpolatedClassName = (name, node, { interpolatedClassNames })  => {
  const { code } = generate(node);
  interpolatedClassNames.push(`${name}-\${${code}}`)
}

const leafNodeHandlers = {
  StringLiteral: pushClassName,
  NumericLiteral: pushClassName,
  Identifier: pushInterpolatedClassName,
  ConditionalExpression: pushInterpolatedClassName,
  LogicalExpression: pushInterpolatedClassName,
}

const expressionNodeHandlers = {
  ...leafNodeHandlers,
  ArrayExpression: (name, { elements }, state) => {
    elements.forEach((element, index) => {
      const breakpoint = breakpoints[index]
      const elementName = `${name}${breakpoint ? `-${breakpoint}` : ''}`
      leafNodeHandlers[element.type](elementName, element, state)
    })  
  }
}

const nodeHandlers = {
  ...expressionNodeHandlers,
  JSXExpressionContainer: (name, { expression }, state) => {
    console.log(expression.type);
    expressionNodeHandlers[expression.type](name, expression, state)
  },
}


const attributeVisitor = {
  JSXAttribute(path, state) {
    const { node: { value, name: { name } } } = path
    if (true || properties[name]) {
      nodeHandlers[value.type](name, value, state)
      path.remove()
    }
  },
};

const getExpression = (classNames, interpolatedClassNames) => {
  if (!interpolatedClassNames.length) {
    return t.stringLiteral(classNames.join(' '));
  }

  const code = `classNames = \`${[...interpolatedClassNames, ...classNames].join(' ')}\``
  const parsed = parse(code, { sourceType: 'script', plugins: ['jsx'] });

  let node = t.cloneDeep(parsed.program.body[0].expression.right);
  
  return !t.isStringLiteral(node) ? t.jSXExpressionContainer(node) : node;
}

const visitor = {
  JSXOpeningElement(path, state = {}) {
    const classNames = []
    const interpolatedClassNames = []
    path.traverse(attributeVisitor, { classNames, interpolatedClassNames })

    const result = getExpression(classNames, interpolatedClassNames)

    const id = t.jSXIdentifier('className')

    const attribute = t.jSXAttribute(id, result);
    path.node.attributes.push(attribute)
  }
}

const plugin =  () => ({
  visitor,
})

export default plugin

var transformed = babel.transformFileSync('./test.js', {
  plugins: [[plugin]]
}).code

console.log(transformed);