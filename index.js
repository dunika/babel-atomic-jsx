import { parse } from "@babel/parser";
import * as babel from "@babel/core";
import generate from '@babel/generator';
import * as t from '@babel/types'
import fs from 'fs'

const unit = 'rem';

export const toUnit = n => isNumber(n) ? n + unit : n

export const isNumber = n => typeof n === 'number' && !isNaN(n)

const scale = 4

const getValue = value => {
  const number = Number(value)
  if (isNumber(number)) {
    return toUnit(Math.round(number) * scale);
  }
  return value
}

const breakpoints = [
  null,
  { label: 'xs', value: '48rem' },
  { label: 'md', value: '62rem' },
  { label: 'xs', value: '75rem' },
]

const properties = {
  m: {
    prop: 'm',
    getClass: ({ prop, breakpoint, value }) => [prop, breakpoint, value].filter(Boolean).join('-'),
    getCss: (value) => {
      return `margin: ${getValue(value)};`
    }
  },
  ml: {
    prop: 'ml',
    getClass: ({ prop, breakpoint, value }) => [prop, breakpoint, value].filter(Boolean).join('-'),
    getCss: (value) => {
      return `margin-left: ${getValue(value)};`
    }
  },
  // m: true,
  // mt: true,
  // mr: true,
  // mb: true,
  // ml: true,
  // mx: true,
  // my: true,
  // p:  true,
  // pt: true,
  // pr: true,
  // pb: true,
  // pl: true,
  // px: true,
  // py: true
}

const styles = {}

const pushClassName = ({
  prop,
  breakpoint,
  value: { value },
  state: {
    classNames
  }
}) => { 
  const { getClass, getCss } = properties[prop]
  const className = getClass({ prop, breakpoint, value })
  const css = getCss(value)

  const styleBreakpoint = breakpoint || 'default'
  styles[styleBreakpoint] =  styles[styleBreakpoint] || {}
  styles[styleBreakpoint][className] = css;
  classNames.push(className) 
}

const pushInterpolatedClassName = ( {
  prop,
  breakpoint,
  value,
  state: {
    interpolatedClassNames
  }
})  => {
  const { code } = generate(value);
  const className = getClass({ prop, breakpoint, value: `\${${code}}` })
  interpolatedClassNames.push(className)
}

const leafNodeHandlers = {
  StringLiteral: pushClassName,
  NumericLiteral: pushClassName,
  TemplateLiteral: pushInterpolatedClassName,
  Identifier: pushInterpolatedClassName,
  ConditionalExpression: pushInterpolatedClassName,
  LogicalExpression: pushInterpolatedClassName,
}

const expressionNodeHandlers = {
  ...leafNodeHandlers,
  ArrayExpression: ({ prop, value: { elements }, state }) => {
    elements.forEach((element, index) => {
      const { label } = breakpoints[index] || {}
      leafNodeHandlers[element.type]({ prop, breakpoint: label, value: element, state })
    })  
  }
}

const nodeHandlers = {
  ...expressionNodeHandlers,
  JSXExpressionContainer: ({ prop, value: { expression }, state }) => {
    expressionNodeHandlers[expression.type]({ prop, value: expression, state })
  },
}

const attributeVisitor = {
  JSXAttribute(path, state) {
    const { node: { value, name: { name: prop } } } = path
    if (properties[prop]) {
      nodeHandlers[value.type]({ prop, value, state })
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
  Program: {
    exit() {
      const final = Object.entries(styles).map(([key, style]) => {
        const breakpoint = breakpoints.find(breakpoint => breakpoint && breakpoint.label === key)
        const [className, css] = Object.entries(style)[0]
        const definition = `
          .${className} {
            ${css}
          }
        `
        
        if (breakpoint) {
          return `@media (min-width: ${breakpoint.value}) {
            ${definition} 
          }`
        }
        return definition
      })
      fs.writeFile('style.css', final.join('\n').replace(/\s/g,''))
    }
  },
  JSXOpeningElement(path, state = {}) {
    const classNames = []
    const interpolatedClassNames = []
    path.traverse(attributeVisitor, { classNames, interpolatedClassNames })
    if (classNames.length || interpolatedClassNames.length) {
      const result = getExpression(classNames, interpolatedClassNames)
      const id = t.jSXIdentifier('className')
      
      const attribute = t.jSXAttribute(id, result);
      path.node.attributes.push(attribute)
    }
  },
}

const plugin =  () => ({
  visitor,
})

export default plugin

var transformed = babel.transformFileSync('./test.js', {
  plugins: [[plugin]]
}).code

console.log(transformed);