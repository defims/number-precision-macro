const { createMacro, MacroError } = require('babel-plugin-macros')

// 顶部增加import
const addImport = (defaultImport, babel, key, value) => {
  if (defaultImport.length <= 0) return
  let program = defaultImport[0].parentPath
  while (program.parentPath) {
    program = program.parentPath
  }
  const programBody = program.node.body
  const { types } = babel
  if (!programBody.find(x => x.source && x.source.value === value)) {
    //没有import则import
    // import key from value
    programBody.unshift(
      types.ImportDeclaration(
        [types.importDefaultSpecifier(types.identifier(key))],
        types.stringLiteral(value)
      )
    )
  }
}
const callExpression = (types, object, property, ...args) => {
  return types.callExpression(
    types.memberExpression(
      types.identifier(object),
      types.identifier(property)
    ),
    args
  )
}
const isValidNumber = (types, value) => {
  // !isNaN(value) && value !== ''
  return types.logicalExpression(
    '&&',
    types.unaryExpression(
      '!',
      types.callExpression(types.identifier('isNaN'), [value])
    ),
    types.binaryExpression('!==', value, types.stringLiteral(''))
  )
}
const isExpressionInvalid = (types, expression) => {
  if (expression.type === 'BinaryExpression') {
    return types.logicalExpression(
      '&&',
      isExpressionInvalid(types, expression.left),
      isExpressionInvalid(types, expression.right)
    )
  } else {
    return isValidNumber(types, expression)
  }
}
const toNumber = (types, number) => {
  return types.callExpression(types.identifier('Number'), [number])
}
const NPOperators = (types, operator, _left, _right) => {
  const left = toNumber(types, _left)
  const right = toNumber(types, _right)
  switch (operator) {
    //NP.times(Number(_left), Number(_right))
    case '*':
      return callExpression(types, 'NP', 'times', left, right)
    //NP.divide(Number(_left), Number(_right))
    case '/':
      return callExpression(types, 'NP', 'divide', left, right)
    //Number(_left) % Number(_right)
    case '%':
      return types.binaryExpression('%', left, right)
    //Math.pow(Number(_left), Number(_right))
    case '^':
      return callExpression(types, 'Math', 'pow', left, right)
    //Math.pow(Number(_left), Number(_right))
    case '**':
      return callExpression(types, 'Math', 'pow', left, right)
    //NP.plus(Number(_left), Number(_right))
    case '+':
      return callExpression(types, 'NP', 'plus', left, right)
    //NP.minus(Number(_left), Number(_right))
    case '-':
      return callExpression(types, 'NP', 'minus', left, right)
  }
}
const expression2NP = (types, expression) => {
  if (expression.type === 'BinaryExpression') {
    return NPOperators(
      types,
      expression.operator,
      expression2NP(types, expression.left),
      expression2NP(types, expression.right)
    )
  } else {
    return expression
  }
}
// 结果后处理
const postHandler = (types, result, arg) => {
  if (
    arg &&
    arg.type !== 'NullLiteral' && // null
    !(arg.type === 'Identifier' && arg.name === 'undefined') && // undefined
    !(arg.type === 'StringLiteral' && arg.value === '') // ''
  ) {
    //NP.round(NP.divide(13413.64, 100), 2)
    if (
      arg.type === 'StringLiteral' &&
      (arg.value === 'yuan' || arg.value === '元')
    ) {
      return callExpression(
        types,
        'NP',
        'round',
        callExpression(
          types,
          'NP',
          'divide',
          toNumber(types, result),
          types.numericLiteral(100)
        ),
        types.numericLiteral(2)
      )
    } else if (arg.type === 'StringLiteral' && arg.value === '%') {
      return types.binaryExpression(
        '+',
        callExpression(
          types,
          'NP',
          'round',
          callExpression(
            types,
            'NP',
            'divide',
            toNumber(types, result),
            types.numericLiteral(100)
          ),
          types.numericLiteral(2)
        ),
        types.stringLiteral('%')
      )
    } else {
      return types.callExpression(arg, [toNumber(types, result)]) // arg(NP.plus(1, 1 % 2))
    }
  } else {
    return result // NP.plus(1, 1 % 2)
  }
}

function macro({ references, babel }) {
  // 获取默认导出的所有引用
  const defaultImport = references.NPM || references.default
  const { types } = babel

  addImport(defaultImport, babel, 'NP', 'number-precision') //TODO 仅针对有用到NP的import

  // 遍历引用并进行求值
  defaultImport.forEach(referencePath => {
    // 作为函数调用
    if (
      referencePath.key === 'callee' &&
      referencePath.parentPath.type === 'CallExpression'
    ) {
      const node = referencePath.parentPath.node
      const [
        arg0, // 表达式
        arg1, // 表达式结果后处理或单位如'yuan'
        arg2 // 非法时默认值
      ] = node.arguments
      referencePath.parentPath.replaceWith(
        types.conditionalExpression(
          isExpressionInvalid(types, arg0), //!isNaN(1) && 1 !== "" && !isNaN(1) && 1 !== "" && !isNaN(2) && 2 !== ""
          postHandler(types, expression2NP(types, arg0), arg1),
          arg2 || types.stringLiteral('--') //: "--"
        )
      )
    } else {
      // 其他情况连同父节点一并替换为未定义
      referencePath.parentPath.replaceWith(types.identifier('undefined'))
    }
  })
}

/**
 * 使用[babel macro](https://github.com/kentcdodds/babel-plugin-macros)实现的[number-precision](https://github.com/nefe/number-precision)的js表达式语法糖，NPM(expression, postHandler, fallback)
 * @function NPM(expression, postHandler, fallback)
 * @param {Expression} expression - 普通js表达式如 (1 + 1)-3%2，支持 () 及运算符 + - * \/ ^ ** %
 * @param {String | Function | Null | Undefined} postHandler - expression使用NP执行后的后处理，内置有'%'（除以100后四舍五入加百分号），'yuan'（除以100后四舍五入），'元'（除以100后四舍五入），null或''或undefined（无后处理）
 * @param {String} fallback - 任意expression中的操作数isNaN或是空字符串时显示兜底显示内容
 * @return {Number | String} - 返回表达式结果或者错误兜底内容
 * @example NPM((1 + 1) - 3 % 2) // 结果为 2
 * // 编译后等价于 !isNaN(1) && 1 !== "" && !isNaN(1) && 1 !== "" && !isNaN(3) && 3 !== "" && !isNaN(2) && 2 !== "" ? NP.minus(Number(NP.plus(Number(1), Number(1))), Number(Number(3) % Number(2))) : "--"
 * @example NPM(1.341324, (x: number) => NP.round(x, 2)) // 结果为 1.34
 * // 编译后等价于 !isNaN(1.341324) && 1.341324 !== "" ? function (x) { return NP.round(x, 2) }(Number(1.341324)) : "--"
 * @example NPM(13413.64, 'yuan') // 结果为 134.14
 * // 内置的 'yuan' 后处理等价于 NP.round(NP.divide(x, 100), 2)
 * // 编译后等价于 !isNaN(13413.64) && 13413.64 !== "" ? NP.round(NP.divide(Number(13413.64), 100), 2) : "--"
 * @example NPM(13413.64, '元') // 结果为 134.14
 * // 内置的 '元' 后处理等价于 NP.round(NP.divide(x, 100), 2)
 * // 编译后等价于 !isNaN(13413.64) && 13413.64 !== "" ? NP.round(NP.divide(Number(13413.64), 100), 2) : "--"
 * @example NPM(13413.64, '%')) // 结果为 '134.14%'
 * // 内置的 '%' 后处理等价于 NP.round(NP.divide(13413.64, 100), 2) + '%'
 * // 编译后等价于 !isNaN(13413.64) && 13413.64 !== "" ? NP.round(NP.divide(Number(13413.64), 100), 2) + "%" : "--"
 * @example NPM(-1.341324, Math.abs)) // 结果为 1.34
 * // 传入自定义后处理函数 Math.abs
 * // 编译后等价于 !isNaN(-1.341324) && -1.341324 !== "" ? Math.abs(Number(-1.341324)) : "--"
 * @example var a = ''; NPM(1 + a) // 结果为 --
 * // 编译后等价于 !isNaN(1) && 1 !== "" && !isNaN(a) && a !== "" ? NP.plus(Number(1), Number(a)) : "--"
 * @example var a = ''; NPM(1 + a/2 + Math.abs(1), '', '**') // 结果为 **
 * // 编译后等价于 !isNaN(1) && 1 !== "" && !isNaN(a) && a !== "" && !isNaN(2) && 2 !== "" && !isNaN(Math.abs(1)) && Math.abs(1) !== "" ? NP.plus(Number(NP.plus(Number(1), Number(NP.divide(Number(a), Number(2))))), Number(Math.abs(1))) : '**'
 */
const NPM = createMacro(macro)
module.exports = NPM
exports.NPM = NPM
