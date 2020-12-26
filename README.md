# number-precision-macro

使用[babel macro](https://github.com/kentcdodds/babel-plugin-macros)实现的[number-precision](https://github.com/nefe/number-precision)语法糖，支持类似`NPM((1+1)/2)`这样的js表达式写法，而不用使用`NP.divide(NP.plus(1, 1))`。

## 使用说明

### 安装 babel-plugin-macros 包
```bash
npm install --save-dev babel-plugin-macros
```

### 根据项目情况配置 babel plugin
参考[babel-plugin-macros Usage for users](https://github.com/kentcdodds/babel-plugin-macros/blob/master/other/docs/user.md)

### 引入number-precision.macro.js并调用
```javascript
import NPM from 'number-precision.macro'
NPM(1+1)
```

## API 说明

### @function NPM(expression, postHandler, fallback)
形似普通函数

### @param {Expression} expression 

普通js表达式如 `(1 + 1)-3%2`，支持 `(` `)` 及运算符 `+` `-` `*` `/` `^` `**` `%`

### @param {String | Function | Null | Undefined} postHandler

expression使用NP执行后的后处理，内置有
- `'%'`，除以100后四舍五入加百分号
- `'yuan'`，除以100后四舍五入
- `'元'`，除以100后四舍五入
- `null`或`''`或`undefined`，无后处理

### @param {String} fallback

任意expression中的操作数isNaN或是空字符串时显示兜底显示内容

### @return {Number | String}

返回表达式结果或者错误兜底内容

## 示例
```javascript
import NPM from 'NP.macro' //引入

NPM((1 + 1) - 3 % 2) 
// 结果为 2, 编译后等价于
!isNaN(1) && 1 !== "" && !isNaN(1) && 1 !== "" && !isNaN(3) && 3 !== "" && !isNaN(2) && 2 !== "" 
? NP.minus(Number(NP.plus(Number(1), Number(1))), Number(Number(3) % Number(2))) 
: "--"

NPM(1.341324, (x: number) => NP.round(x, 2)) 
// 结果为 1.34，编译后等价于 
!isNaN(1.341324) && 1.341324 !== "" 
? function (x) { return NP.round(x, 2) }(Number(1.341324)) 
: "--"

NPM(13413.64, 'yuan') 
// 结果为 134.14，内置的 'yuan' 后处理等价于 NP.round(NP.divide(x, 100), 2)，编译后等价于
!isNaN(13413.64) && 13413.64 !== "" 
? NP.round(NP.divide(Number(13413.64), 100), 2) 
: "--"

NPM(13413.64, '元') 
// 结果为 134.14，内置的 '元' 后处理等价于 NP.round(NP.divide(x, 100), 2)，编译后等价于 
!isNaN(13413.64) && 13413.64 !== "" 
? NP.round(NP.divide(Number(13413.64), 100), 2) 
: "--"

NPM(13413.64, '%')) 
// 结果为 '134.14%'，内置的 '%' 后处理等价于 NP.round(NP.divide(13413.64, 100), 2) + '%'，编译后等价于 
!isNaN(13413.64) && 13413.64 !== "" 
? NP.round(NP.divide(Number(13413.64), 100), 2) + "%" 
: "--"

NPM(-1.341324, Math.abs)) 
// 结果为 1.34，传入自定义后处理函数 Math.abs，编译后等价于 
!isNaN(-1.341324) && -1.341324 !== "" 
? Math.abs(Number(-1.341324)) 
: "--"


var a = ''; NPM(1 + a) 
// 结果为 --，编译后等价于
!isNaN(1) && 1 !== "" && !isNaN(a) && a !== "" 
? NP.plus(Number(1), Number(a)) 
: "--"

var a = ''; NPM(1 + a/2 + Math.abs(1), '', '**') 
// 结果为 **，编译后等价于
!isNaN(1) && 1 !== "" && !isNaN(a) && a !== "" && !isNaN(2) && 2 !== "" && !isNaN(Math.abs(1)) && Math.abs(1) !== "" 
? NP.plus(Number(NP.plus(Number(1), Number(NP.divide(Number(a), Number(2))))), Number(Math.abs(1))) 
: '**'
```
