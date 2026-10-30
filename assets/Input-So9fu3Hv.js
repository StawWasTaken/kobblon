import{Vu as e,bf as t,xf as n,yf as r}from"./api-jPtI10Wp.js";var i=t((e=>{var t=Symbol.for(`react.transitional.element`),n=Symbol.for(`react.portal`),r=Symbol.for(`react.fragment`),i=Symbol.for(`react.strict_mode`),a=Symbol.for(`react.profiler`),o=Symbol.for(`react.consumer`),s=Symbol.for(`react.context`),c=Symbol.for(`react.forward_ref`),l=Symbol.for(`react.suspense`),u=Symbol.for(`react.memo`),d=Symbol.for(`react.lazy`),f=Symbol.for(`react.activity`),p=Symbol.for(`react.view_transition`),m=Symbol.iterator;function h(e){return typeof e!=`object`||!e?null:(e=m&&e[m]||e[`@@iterator`],typeof e==`function`?e:null)}var g={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},_=Object.assign,v={};function y(e,t,n){this.props=e,this.context=t,this.refs=v,this.updater=n||g}y.prototype.isReactComponent={},y.prototype.setState=function(e,t){if(typeof e!=`object`&&typeof e!=`function`&&e!=null)throw Error(`takes an object of state variables to update or a function which returns an object of state variables.`);this.updater.enqueueSetState(this,e,t,`setState`)},y.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,`forceUpdate`)};function b(){}b.prototype=y.prototype;function x(e,t,n){this.props=e,this.context=t,this.refs=v,this.updater=n||g}var S=x.prototype=new b;S.constructor=x,_(S,y.prototype),S.isPureReactComponent=!0;var C=Array.isArray;function w(){}var T={H:null,A:null,T:null,S:null},E=Object.prototype.hasOwnProperty;function D(e,n,r){var i=r.ref;return{$$typeof:t,type:e,key:n,ref:i===void 0?null:i,props:r}}function ee(e,t){return D(e.type,t,e.props)}function O(e){return typeof e==`object`&&!!e&&e.$$typeof===t}function te(e){var t={"=":`=0`,":":`=2`};return`$`+e.replace(/[=:]/g,function(e){return t[e]})}var ne=/\/+/g;function k(e,t){return typeof e==`object`&&e&&e.key!=null?te(``+e.key):t.toString(36)}function re(e){switch(e.status){case`fulfilled`:return e.value;case`rejected`:throw e.reason;default:switch(typeof e.status==`string`?e.then(w,w):(e.status=`pending`,e.then(function(t){e.status===`pending`&&(e.status=`fulfilled`,e.value=t)},function(t){e.status===`pending`&&(e.status=`rejected`,e.reason=t)})),e.status){case`fulfilled`:return e.value;case`rejected`:throw e.reason}}throw e}function A(e,r,i,a,o){var s=typeof e;(s===`undefined`||s===`boolean`)&&(e=null);var c=!1;if(e===null)c=!0;else switch(s){case`bigint`:case`string`:case`number`:c=!0;break;case`object`:switch(e.$$typeof){case t:case n:c=!0;break;case d:return c=e._init,A(c(e._payload),r,i,a,o)}}if(c)return o=o(e),c=a===``?`.`+k(e,0):a,C(o)?(i=``,c!=null&&(i=c.replace(ne,`$&/`)+`/`),A(o,r,i,``,function(e){return e})):o!=null&&(O(o)&&(o=ee(o,i+(o.key==null||e&&e.key===o.key?``:(``+o.key).replace(ne,`$&/`)+`/`)+c)),r.push(o)),1;c=0;var l=a===``?`.`:a+`:`;if(C(e))for(var u=0;u<e.length;u++)a=e[u],s=l+k(a,u),c+=A(a,r,i,s,o);else if(u=h(e),typeof u==`function`)for(e=u.call(e),u=0;!(a=e.next()).done;)a=a.value,s=l+k(a,u++),c+=A(a,r,i,s,o);else if(s===`object`){if(typeof e.then==`function`)return A(re(e),r,i,a,o);throw r=String(e),Error(`Objects are not valid as a React child (found: `+(r===`[object Object]`?`object with keys {`+Object.keys(e).join(`, `)+`}`:r)+`). If you meant to render a collection of children, use an array instead.`)}return c}function j(e,t,n){if(e==null)return e;var r=[],i=0;return A(e,r,``,``,function(e){return t.call(n,e,i++)}),r}function ie(e){if(e._status===-1){var t=e._result,n=t();n.then(function(t){(e._status===0||e._status===-1)&&(e._status=1,e._result=t,n.status===void 0&&(n.status=`fulfilled`,n.value=t))},function(t){(e._status===0||e._status===-1)&&(e._status=2,e._result=t,n.status===void 0&&(n.status=`rejected`,n.reason=t))}),e._status===-1&&(e._status=0,e._result=n)}if(e._status===1)return e._result.default;throw e._result}var ae=typeof reportError==`function`?reportError:function(e){if(typeof window==`object`&&typeof window.ErrorEvent==`function`){var t=new window.ErrorEvent(`error`,{bubbles:!0,cancelable:!0,message:typeof e==`object`&&e&&typeof e.message==`string`?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process==`object`&&typeof process.emit==`function`){process.emit(`uncaughtException`,e);return}console.error(e)};function M(e){var t=T.T,n={};n.types=t===null?null:t.types,T.T=n;try{var r=e(),i=T.S;i!==null&&i(n,r),typeof r==`object`&&r&&typeof r.then==`function`&&r.then(w,ae)}catch(e){ae(e)}finally{t!==null&&n.types!==null&&(t.types=n.types),T.T=t}}function oe(e){var t=T.T;if(t!==null){var n=t.types;n===null?t.types=[e]:n.indexOf(e)===-1&&n.push(e)}else M(oe.bind(null,e))}var se={map:j,forEach:function(e,t,n){j(e,function(){t.apply(this,arguments)},n)},count:function(e){var t=0;return j(e,function(){t++}),t},toArray:function(e){return j(e,function(e){return e})||[]},only:function(e){if(!O(e))throw Error(`React.Children.only expected to receive a single React element child.`);return e}};e.Activity=f,e.Children=se,e.Component=y,e.Fragment=r,e.Profiler=a,e.PureComponent=x,e.StrictMode=i,e.Suspense=l,e.ViewTransition=p,e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=T,e.__COMPILER_RUNTIME={__proto__:null,c:function(e){return T.H.useMemoCache(e)}},e.addTransitionType=oe,e.cache=function(e){return function(){return e.apply(null,arguments)}},e.cacheSignal=function(){return null},e.cloneElement=function(e,t,n){if(e==null)throw Error(`The argument must be a React element, but you passed `+e+`.`);var r=_({},e.props),i=e.key;if(t!=null)for(a in t.key!==void 0&&(i=``+t.key),t)!E.call(t,a)||a===`key`||a===`__self`||a===`__source`||a===`ref`&&t.ref===void 0||(r[a]=t[a]);var a=arguments.length-2;if(a===1)r.children=n;else if(1<a){for(var o=Array(a),s=0;s<a;s++)o[s]=arguments[s+2];r.children=o}return D(e.type,i,r)},e.createContext=function(e){return e={$$typeof:s,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null},e.Provider=e,e.Consumer={$$typeof:o,_context:e},e},e.createElement=function(e,t,n){var r,i={},a=null;if(t!=null)for(r in t.key!==void 0&&(a=``+t.key),t)E.call(t,r)&&r!==`key`&&r!==`__self`&&r!==`__source`&&(i[r]=t[r]);var o=arguments.length-2;if(o===1)i.children=n;else if(1<o){for(var s=Array(o),c=0;c<o;c++)s[c]=arguments[c+2];i.children=s}if(e&&e.defaultProps)for(r in o=e.defaultProps,o)i[r]===void 0&&(i[r]=o[r]);return D(e,a,i)},e.createRef=function(){return{current:null}},e.forwardRef=function(e){return{$$typeof:c,render:e}},e.isValidElement=O,e.lazy=function(e){return{$$typeof:d,_payload:{_status:-1,_result:e},_init:ie}},e.memo=function(e,t){return{$$typeof:u,type:e,compare:t===void 0?null:t}},e.startTransition=M,e.unstable_useCacheRefresh=function(){return T.H.useCacheRefresh()},e.use=function(e){return T.H.use(e)},e.useActionState=function(e,t,n){return T.H.useActionState(e,t,n)},e.useCallback=function(e,t){return T.H.useCallback(e,t)},e.useContext=function(e){return T.H.useContext(e)},e.useDebugValue=function(){},e.useDeferredValue=function(e,t){return T.H.useDeferredValue(e,t)},e.useEffect=function(e,t){return T.H.useEffect(e,t)},e.useEffectEvent=function(e){return T.H.useEffectEvent(e)},e.useId=function(){return T.H.useId()},e.useImperativeHandle=function(e,t,n){return T.H.useImperativeHandle(e,t,n)},e.useInsertionEffect=function(e,t){return T.H.useInsertionEffect(e,t)},e.useLayoutEffect=function(e,t){return T.H.useLayoutEffect(e,t)},e.useMemo=function(e,t){return T.H.useMemo(e,t)},e.useOptimistic=function(e,t){return T.H.useOptimistic(e,t)},e.useReducer=function(e,t,n){return T.H.useReducer(e,t,n)},e.useRef=function(e){return T.H.useRef(e)},e.useState=function(e){return T.H.useState(e)},e.useSyncExternalStore=function(e,t,n){return T.H.useSyncExternalStore(e,t,n)},e.useTransition=function(){return T.H.useTransition()},e.version=`19.3.0`})),a=t(((e,t)=>{t.exports=i()})),o=n(a(),1);function s(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,r=Array(t);n<t;n++)r[n]=e[n];return r}function c(e){if(Array.isArray(e))return e}function l(e){if(Array.isArray(e))return s(e)}function u(e,t){if(!(e instanceof t))throw TypeError(`Cannot call a class as a function`)}function d(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,`value`in r&&(r.writable=!0),Object.defineProperty(e,w(r.key),r)}}function f(e,t,n){return t&&d(e.prototype,t),n&&d(e,n),Object.defineProperty(e,"prototype",{writable:!1}),e}function p(e,t){var n=typeof Symbol<`u`&&e[Symbol.iterator]||e[`@@iterator`];if(!n){if(Array.isArray(e)||(n=E(e))||t&&e&&typeof e.length==`number`){n&&(e=n);var r=0,i=function(){};return{s:i,n:function(){return r>=e.length?{done:!0}:{done:!1,value:e[r++]}},e:function(e){throw e},f:i}}throw TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}var a,o=!0,s=!1;return{s:function(){n=n.call(e)},n:function(){var e=n.next();return o=e.done,e},e:function(e){s=!0,a=e},f:function(){try{o||n.return==null||n.return()}finally{if(s)throw a}}}}function m(e,t,n){return(t=w(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function h(e){if(typeof Symbol<`u`&&e[Symbol.iterator]!=null||e[`@@iterator`]!=null)return Array.from(e)}function g(e,t){var n=e==null?null:typeof Symbol<`u`&&e[Symbol.iterator]||e[`@@iterator`];if(n!=null){var r,i,a,o,s=[],c=!0,l=!1;try{if(a=(n=n.call(e)).next,t===0){if(Object(n)!==n)return;c=!1}else for(;!(c=(r=a.call(n)).done)&&(s.push(r.value),s.length!==t);c=!0);}catch(e){l=!0,i=e}finally{try{if(!c&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(l)throw i}}return s}}function _(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function v(){throw TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function y(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable})),n.push.apply(n,r)}return n}function b(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]==null?{}:arguments[t];t%2?y(Object(n),!0).forEach(function(t){m(e,t,n[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):y(Object(n)).forEach(function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))})}return e}function x(e,t){return c(e)||g(e,t)||E(e,t)||_()}function S(e){return l(e)||h(e)||E(e)||v()}function C(e,t){if(typeof e!=`object`||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t||`default`);if(typeof r!=`object`)return r;throw TypeError(`@@toPrimitive must return a primitive value.`)}return(t===`string`?String:Number)(e)}function w(e){var t=C(e,`string`);return typeof t==`symbol`?t:t+``}function T(e){"@babel/helpers - typeof";return T=typeof Symbol==`function`&&typeof Symbol.iterator==`symbol`?function(e){return typeof e}:function(e){return e&&typeof Symbol==`function`&&e.constructor===Symbol&&e!==Symbol.prototype?`symbol`:typeof e},T(e)}function E(e,t){if(e){if(typeof e==`string`)return s(e,t);var n={}.toString.call(e).slice(8,-1);return n===`Object`&&e.constructor&&(n=e.constructor.name),n===`Map`||n===`Set`?Array.from(e):n===`Arguments`||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?s(e,t):void 0}}var D=function(){},ee={},O={},te=null,ne={mark:D,measure:D};try{typeof window<`u`&&(ee=window),typeof document<`u`&&(O=document),typeof MutationObserver<`u`&&(te=MutationObserver),typeof performance<`u`&&(ne=performance)}catch{}var k=(ee.navigator||{}).userAgent,re=k===void 0?``:k,A=ee,j=O,ie=te,ae=ne;A.document;var M=!!j.documentElement&&!!j.head&&typeof j.addEventListener==`function`&&typeof j.createElement==`function`,oe=~re.indexOf(`MSIE`)||~re.indexOf(`Trident/`),se,ce=/fa(k|kd|s|r|l|t|d|dr|dl|dt|b|slr|slpr|wsb|tl|ns|nds|es|gt|jr|jfr|jdr|usb|ufsb|udsb|cr|ss|sr|sl|st|sds|sdr|sdl|sdt|sldr|slpdr|pr|ms|vs)?[\-\ ]/,le=/Font ?Awesome ?([567 ]*)(Solid|Regular|Light|Thin|Duotone|Brands|Free|Pro|Sharp Duotone|Sharp|Kit|Notdog Duo|Notdog|Chisel|Etch|Graphite|Thumbprint|Jelly Fill|Jelly Duo|Jelly|Utility|Utility Fill|Utility Duo|Slab Press|Slab|Slab Duo|Slab Press Duo|Pixel|Mosaic|Vellum|Whiteboard)?.*/i,ue={classic:{fa:`solid`,fas:`solid`,"fa-solid":`solid`,far:`regular`,"fa-regular":`regular`,fal:`light`,"fa-light":`light`,fat:`thin`,"fa-thin":`thin`,fab:`brands`,"fa-brands":`brands`},duotone:{fa:`solid`,fad:`solid`,"fa-solid":`solid`,"fa-duotone":`solid`,fadr:`regular`,"fa-regular":`regular`,fadl:`light`,"fa-light":`light`,fadt:`thin`,"fa-thin":`thin`},sharp:{fa:`solid`,fass:`solid`,"fa-solid":`solid`,fasr:`regular`,"fa-regular":`regular`,fasl:`light`,"fa-light":`light`,fast:`thin`,"fa-thin":`thin`},"sharp-duotone":{fa:`solid`,fasds:`solid`,"fa-solid":`solid`,fasdr:`regular`,"fa-regular":`regular`,fasdl:`light`,"fa-light":`light`,fasdt:`thin`,"fa-thin":`thin`},slab:{"fa-regular":`regular`,faslr:`regular`},"slab-press":{"fa-regular":`regular`,faslpr:`regular`},"slab-duo":{"fa-regular":`regular`,fasldr:`regular`},"slab-press-duo":{"fa-regular":`regular`,faslpdr:`regular`},thumbprint:{"fa-light":`light`,fatl:`light`},vellum:{"fa-solid":`solid`,favs:`solid`},pixel:{"fa-regular":`regular`,fapr:`regular`},mosaic:{"fa-solid":`solid`,fams:`solid`},whiteboard:{"fa-semibold":`semibold`,fawsb:`semibold`},notdog:{"fa-solid":`solid`,fans:`solid`},"notdog-duo":{"fa-solid":`solid`,fands:`solid`},etch:{"fa-solid":`solid`,faes:`solid`},graphite:{"fa-thin":`thin`,fagt:`thin`},jelly:{"fa-regular":`regular`,fajr:`regular`},"jelly-fill":{"fa-regular":`regular`,fajfr:`regular`},"jelly-duo":{"fa-regular":`regular`,fajdr:`regular`},chisel:{"fa-regular":`regular`,facr:`regular`},utility:{"fa-semibold":`semibold`,fausb:`semibold`},"utility-duo":{"fa-semibold":`semibold`,faudsb:`semibold`},"utility-fill":{"fa-semibold":`semibold`,faufsb:`semibold`}},de={GROUP:`duotone-group`,SWAP_OPACITY:`swap-opacity`,PRIMARY:`primary`,SECONDARY:`secondary`},fe=[`fa-classic`,`fa-duotone`,`fa-sharp`,`fa-sharp-duotone`,`fa-thumbprint`,`fa-whiteboard`,`fa-notdog`,`fa-notdog-duo`,`fa-chisel`,`fa-etch`,`fa-graphite`,`fa-jelly`,`fa-jelly-fill`,`fa-jelly-duo`,`fa-slab`,`fa-slab-press`,`fa-slab-press-duo`,`fa-slab-duo`,`fa-mosaic`,`fa-pixel`,`fa-vellum`,`fa-utility`,`fa-utility-duo`,`fa-utility-fill`],N=`classic`,pe=`duotone`,me=`sharp`,he=`sharp-duotone`,ge=`chisel`,_e=`etch`,ve=`graphite`,ye=`jelly`,be=`jelly-duo`,xe=`jelly-fill`,Se=`mosaic`,Ce=`notdog`,we=`notdog-duo`,Te=`pixel`,Ee=`slab`,De=`slab-duo`,Oe=`slab-press`,ke=`slab-press-duo`,Ae=`thumbprint`,je=`utility`,Me=`utility-duo`,Ne=`utility-fill`,Pe=`vellum`,Fe=`whiteboard`,Ie=`Classic`,Le=`Duotone`,Re=`Sharp`,ze=`Sharp Duotone`,Be=`Chisel`,Ve=`Etch`,He=`Graphite`,Ue=`Jelly`,We=`Jelly Duo`,Ge=`Jelly Fill`,Ke=`Mosaic`,qe=`Notdog`,Je=`Notdog Duo`,Ye=`Pixel`,Xe=`Slab`,Ze=`Slab Duo`,Qe=`Slab Press`,$e=`Slab Press Duo`,et=`Thumbprint`,tt=`Utility`,nt=`Utility Duo`,rt=`Utility Fill`,it=`Vellum`,at=`Whiteboard`,ot=[N,pe,me,he,ge,_e,ve,ye,be,xe,Se,Ce,we,Te,Ee,De,Oe,ke,Ae,je,Me,Ne,Pe,Fe];se={},m(m(m(m(m(m(m(m(m(m(se,N,Ie),pe,Le),me,Re),he,ze),ge,Be),_e,Ve),ve,He),ye,Ue),be,We),xe,Ge),m(m(m(m(m(m(m(m(m(m(se,Se,Ke),Ce,qe),we,Je),Te,Ye),Ee,Xe),De,Ze),Oe,Qe),ke,$e),Ae,et),je,tt),m(m(m(m(se,Me,nt),Ne,rt),Pe,it),Fe,at);var st={classic:{900:`fas`,400:`far`,normal:`far`,300:`fal`,100:`fat`},duotone:{900:`fad`,400:`fadr`,300:`fadl`,100:`fadt`},sharp:{900:`fass`,400:`fasr`,300:`fasl`,100:`fast`},"sharp-duotone":{900:`fasds`,400:`fasdr`,300:`fasdl`,100:`fasdt`},slab:{400:`faslr`},"slab-press":{400:`faslpr`},"slab-duo":{400:`fasldr`},"slab-press-duo":{400:`faslpdr`},vellum:{900:`favs`},mosaic:{900:`fams`},pixel:{400:`fapr`},whiteboard:{600:`fawsb`},thumbprint:{300:`fatl`},notdog:{900:`fans`},"notdog-duo":{900:`fands`},etch:{900:`faes`},graphite:{100:`fagt`},chisel:{400:`facr`},jelly:{400:`fajr`},"jelly-fill":{400:`fajfr`},"jelly-duo":{400:`fajdr`},utility:{600:`fausb`},"utility-duo":{600:`faudsb`},"utility-fill":{600:`faufsb`}},ct={"Font Awesome 7 Free":{900:`fas`,400:`far`},"Font Awesome 7 Pro":{900:`fas`,400:`far`,normal:`far`,300:`fal`,100:`fat`},"Font Awesome 7 Brands":{400:`fab`,normal:`fab`},"Font Awesome 7 Duotone":{900:`fad`,400:`fadr`,normal:`fadr`,300:`fadl`,100:`fadt`},"Font Awesome 7 Sharp":{900:`fass`,400:`fasr`,normal:`fasr`,300:`fasl`,100:`fast`},"Font Awesome 7 Sharp Duotone":{900:`fasds`,400:`fasdr`,normal:`fasdr`,300:`fasdl`,100:`fasdt`},"Font Awesome 7 Jelly":{400:`fajr`,normal:`fajr`},"Font Awesome 7 Jelly Fill":{400:`fajfr`,normal:`fajfr`},"Font Awesome 7 Jelly Duo":{400:`fajdr`,normal:`fajdr`},"Font Awesome 7 Slab":{400:`faslr`,normal:`faslr`},"Font Awesome 7 Slab Press":{400:`faslpr`,normal:`faslpr`},"Font Awesome 7 Slab Duo":{400:`fasldr`,normal:`fasldr`},"Font Awesome 7 Slab Press Duo":{400:`faslpdr`,normal:`faslpdr`},"Font Awesome 7 Pixel":{400:`fapr`,normal:`fapr`},"Font Awesome 7 Mosaic":{900:`fams`,normal:`fams`},"Font Awesome 7 Vellum":{900:`favs`,normal:`favs`},"Font Awesome 7 Thumbprint":{300:`fatl`,normal:`fatl`},"Font Awesome 7 Notdog":{900:`fans`,normal:`fans`},"Font Awesome 7 Notdog Duo":{900:`fands`,normal:`fands`},"Font Awesome 7 Etch":{900:`faes`,normal:`faes`},"Font Awesome 7 Graphite":{100:`fagt`,normal:`fagt`},"Font Awesome 7 Chisel":{400:`facr`,normal:`facr`},"Font Awesome 7 Whiteboard":{600:`fawsb`,normal:`fawsb`},"Font Awesome 7 Utility":{600:`fausb`,normal:`fausb`},"Font Awesome 7 Utility Duo":{600:`faudsb`,normal:`faudsb`},"Font Awesome 7 Utility Fill":{600:`faufsb`,normal:`faufsb`}},lt=new Map([[`classic`,{defaultShortPrefixId:`fas`,defaultStyleId:`solid`,styleIds:[`solid`,`regular`,`light`,`thin`,`brands`],futureStyleIds:[],defaultFontWeight:900}],[`duotone`,{defaultShortPrefixId:`fad`,defaultStyleId:`solid`,styleIds:[`solid`,`regular`,`light`,`thin`],futureStyleIds:[],defaultFontWeight:900}],[`sharp`,{defaultShortPrefixId:`fass`,defaultStyleId:`solid`,styleIds:[`solid`,`regular`,`light`,`thin`],futureStyleIds:[],defaultFontWeight:900}],[`sharp-duotone`,{defaultShortPrefixId:`fasds`,defaultStyleId:`solid`,styleIds:[`solid`,`regular`,`light`,`thin`],futureStyleIds:[],defaultFontWeight:900}],[`chisel`,{defaultShortPrefixId:`facr`,defaultStyleId:`regular`,styleIds:[`regular`],futureStyleIds:[],defaultFontWeight:400}],[`etch`,{defaultShortPrefixId:`faes`,defaultStyleId:`solid`,styleIds:[`solid`],futureStyleIds:[],defaultFontWeight:900}],[`graphite`,{defaultShortPrefixId:`fagt`,defaultStyleId:`thin`,styleIds:[`thin`],futureStyleIds:[],defaultFontWeight:100}],[`jelly`,{defaultShortPrefixId:`fajr`,defaultStyleId:`regular`,styleIds:[`regular`],futureStyleIds:[],defaultFontWeight:400}],[`jelly-duo`,{defaultShortPrefixId:`fajdr`,defaultStyleId:`regular`,styleIds:[`regular`],futureStyleIds:[],defaultFontWeight:400}],[`jelly-fill`,{defaultShortPrefixId:`fajfr`,defaultStyleId:`regular`,styleIds:[`regular`],futureStyleIds:[],defaultFontWeight:400}],[`mosaic`,{defaultShortPrefixId:`fams`,defaultStyleId:`solid`,styleIds:[`solid`],futureStyleIds:[],defaultFontWeight:900}],[`notdog`,{defaultShortPrefixId:`fans`,defaultStyleId:`solid`,styleIds:[`solid`],futureStyleIds:[],defaultFontWeight:900}],[`notdog-duo`,{defaultShortPrefixId:`fands`,defaultStyleId:`solid`,styleIds:[`solid`],futureStyleIds:[],defaultFontWeight:900}],[`pixel`,{defaultShortPrefixId:`fapr`,defaultStyleId:`regular`,styleIds:[`regular`],futureStyleIds:[],defaultFontWeight:400}],[`slab`,{defaultShortPrefixId:`faslr`,defaultStyleId:`regular`,styleIds:[`regular`],futureStyleIds:[],defaultFontWeight:400}],[`slab-duo`,{defaultShortPrefixId:`fasldr`,defaultStyleId:`regular`,styleIds:[`regular`],futureStyleIds:[],defaultFontWeight:400}],[`slab-press`,{defaultShortPrefixId:`faslpr`,defaultStyleId:`regular`,styleIds:[`regular`],futureStyleIds:[],defaultFontWeight:400}],[`slab-press-duo`,{defaultShortPrefixId:`faslpdr`,defaultStyleId:`regular`,styleIds:[`regular`],futureStyleIds:[],defaultFontWeight:400}],[`thumbprint`,{defaultShortPrefixId:`fatl`,defaultStyleId:`light`,styleIds:[`light`],futureStyleIds:[],defaultFontWeight:300}],[`utility`,{defaultShortPrefixId:`fausb`,defaultStyleId:`semibold`,styleIds:[`semibold`],futureStyleIds:[],defaultFontWeight:600}],[`utility-duo`,{defaultShortPrefixId:`faudsb`,defaultStyleId:`semibold`,styleIds:[`semibold`],futureStyleIds:[],defaultFontWeight:600}],[`utility-fill`,{defaultShortPrefixId:`faufsb`,defaultStyleId:`semibold`,styleIds:[`semibold`],futureStyleIds:[],defaultFontWeight:600}],[`vellum`,{defaultShortPrefixId:`favs`,defaultStyleId:`solid`,styleIds:[`solid`],futureStyleIds:[],defaultFontWeight:900}],[`whiteboard`,{defaultShortPrefixId:`fawsb`,defaultStyleId:`semibold`,styleIds:[`semibold`],futureStyleIds:[],defaultFontWeight:600}]]),ut={chisel:{regular:`facr`},classic:{brands:`fab`,light:`fal`,regular:`far`,solid:`fas`,thin:`fat`},duotone:{light:`fadl`,regular:`fadr`,solid:`fad`,thin:`fadt`},etch:{solid:`faes`},graphite:{thin:`fagt`},jelly:{regular:`fajr`},"jelly-duo":{regular:`fajdr`},"jelly-fill":{regular:`fajfr`},mosaic:{solid:`fams`},notdog:{solid:`fans`},"notdog-duo":{solid:`fands`},pixel:{regular:`fapr`},sharp:{light:`fasl`,regular:`fasr`,solid:`fass`,thin:`fast`},"sharp-duotone":{light:`fasdl`,regular:`fasdr`,solid:`fasds`,thin:`fasdt`},slab:{regular:`faslr`},"slab-duo":{regular:`fasldr`},"slab-press":{regular:`faslpr`},"slab-press-duo":{regular:`faslpdr`},thumbprint:{light:`fatl`},utility:{semibold:`fausb`},"utility-duo":{semibold:`faudsb`},"utility-fill":{semibold:`faufsb`},vellum:{solid:`favs`},whiteboard:{semibold:`fawsb`}},dt=[`fak`,`fa-kit`,`fakd`,`fa-kit-duotone`],ft={kit:{fak:`kit`,"fa-kit":`kit`},"kit-duotone":{fakd:`kit-duotone`,"fa-kit-duotone":`kit-duotone`}},pt=[`kit`];m(m({},`kit`,`Kit`),`kit-duotone`,`Kit Duotone`);var mt={kit:{"fa-kit":`fak`},"kit-duotone":{"fa-kit-duotone":`fakd`}},ht={"Font Awesome Kit":{400:`fak`,normal:`fak`},"Font Awesome Kit Duotone":{400:`fakd`,normal:`fakd`}},gt={kit:{fak:`fa-kit`},"kit-duotone":{fakd:`fa-kit-duotone`}},_t={kit:{kit:`fak`},"kit-duotone":{"kit-duotone":`fakd`}},vt,yt={GROUP:`duotone-group`,SWAP_OPACITY:`swap-opacity`,PRIMARY:`primary`,SECONDARY:`secondary`},bt=[`fa-classic`,`fa-duotone`,`fa-sharp`,`fa-sharp-duotone`,`fa-thumbprint`,`fa-whiteboard`,`fa-notdog`,`fa-notdog-duo`,`fa-chisel`,`fa-etch`,`fa-graphite`,`fa-jelly`,`fa-jelly-fill`,`fa-jelly-duo`,`fa-slab`,`fa-slab-press`,`fa-slab-press-duo`,`fa-slab-duo`,`fa-mosaic`,`fa-pixel`,`fa-vellum`,`fa-utility`,`fa-utility-duo`,`fa-utility-fill`];vt={},m(m(m(m(m(m(m(m(m(m(vt,`classic`,`Classic`),`duotone`,`Duotone`),`sharp`,`Sharp`),`sharp-duotone`,`Sharp Duotone`),`chisel`,`Chisel`),`etch`,`Etch`),`graphite`,`Graphite`),`jelly`,`Jelly`),`jelly-duo`,`Jelly Duo`),`jelly-fill`,`Jelly Fill`),m(m(m(m(m(m(m(m(m(m(vt,`mosaic`,`Mosaic`),`notdog`,`Notdog`),`notdog-duo`,`Notdog Duo`),`pixel`,`Pixel`),`slab`,`Slab`),`slab-duo`,`Slab Duo`),`slab-press`,`Slab Press`),`slab-press-duo`,`Slab Press Duo`),`thumbprint`,`Thumbprint`),`utility`,`Utility`),m(m(m(m(vt,`utility-duo`,`Utility Duo`),`utility-fill`,`Utility Fill`),`vellum`,`Vellum`),`whiteboard`,`Whiteboard`),m(m({},`kit`,`Kit`),`kit-duotone`,`Kit Duotone`);var xt={classic:{"fa-brands":`fab`,"fa-duotone":`fad`,"fa-light":`fal`,"fa-regular":`far`,"fa-solid":`fas`,"fa-thin":`fat`},duotone:{"fa-regular":`fadr`,"fa-light":`fadl`,"fa-thin":`fadt`},sharp:{"fa-solid":`fass`,"fa-regular":`fasr`,"fa-light":`fasl`,"fa-thin":`fast`},"sharp-duotone":{"fa-solid":`fasds`,"fa-regular":`fasdr`,"fa-light":`fasdl`,"fa-thin":`fasdt`},slab:{"fa-regular":`faslr`},"slab-press":{"fa-regular":`faslpr`},"slab-duo":{"fa-regular":`fasldr`},"slab-press-duo":{"fa-regular":`faslpdr`},pixel:{"fa-regular":`fapr`},mosaic:{"fa-solid":`fams`},vellum:{"fa-solid":`favs`},whiteboard:{"fa-semibold":`fawsb`},thumbprint:{"fa-light":`fatl`},notdog:{"fa-solid":`fans`},"notdog-duo":{"fa-solid":`fands`},etch:{"fa-solid":`faes`},graphite:{"fa-thin":`fagt`},jelly:{"fa-regular":`fajr`},"jelly-fill":{"fa-regular":`fajfr`},"jelly-duo":{"fa-regular":`fajdr`},chisel:{"fa-regular":`facr`},utility:{"fa-semibold":`fausb`},"utility-duo":{"fa-semibold":`faudsb`},"utility-fill":{"fa-semibold":`faufsb`}},St={classic:[`fas`,`far`,`fal`,`fat`,`fad`],duotone:[`fadr`,`fadl`,`fadt`],sharp:[`fass`,`fasr`,`fasl`,`fast`],"sharp-duotone":[`fasds`,`fasdr`,`fasdl`,`fasdt`],slab:[`faslr`],"slab-press":[`faslpr`],"slab-duo":[`fasldr`],"slab-press-duo":[`faslpdr`],pixel:[`fapr`],mosaic:[`fams`],vellum:[`favs`],whiteboard:[`fawsb`],thumbprint:[`fatl`],notdog:[`fans`],"notdog-duo":[`fands`],etch:[`faes`],graphite:[`fagt`],jelly:[`fajr`],"jelly-fill":[`fajfr`],"jelly-duo":[`fajdr`],chisel:[`facr`],utility:[`fausb`],"utility-duo":[`faudsb`],"utility-fill":[`faufsb`]},Ct={classic:{fab:`fa-brands`,fad:`fa-duotone`,fal:`fa-light`,far:`fa-regular`,fas:`fa-solid`,fat:`fa-thin`},duotone:{fadr:`fa-regular`,fadl:`fa-light`,fadt:`fa-thin`},sharp:{fass:`fa-solid`,fasr:`fa-regular`,fasl:`fa-light`,fast:`fa-thin`},"sharp-duotone":{fasds:`fa-solid`,fasdr:`fa-regular`,fasdl:`fa-light`,fasdt:`fa-thin`},slab:{faslr:`fa-regular`},"slab-press":{faslpr:`fa-regular`},"slab-duo":{fasldr:`fa-regular`},"slab-press-duo":{faslpdr:`fa-regular`},pixel:{fapr:`fa-regular`},mosaic:{fams:`fa-solid`},vellum:{favs:`fa-solid`},whiteboard:{fawsb:`fa-semibold`},thumbprint:{fatl:`fa-light`},notdog:{fans:`fa-solid`},"notdog-duo":{fands:`fa-solid`},etch:{faes:`fa-solid`},graphite:{fagt:`fa-thin`},jelly:{fajr:`fa-regular`},"jelly-fill":{fajfr:`fa-regular`},"jelly-duo":{fajdr:`fa-regular`},chisel:{facr:`fa-regular`},utility:{fausb:`fa-semibold`},"utility-duo":{faudsb:`fa-semibold`},"utility-fill":{faufsb:`fa-semibold`}},wt=`fa.fas.far.fal.fat.fad.fadr.fadl.fadt.fab.fass.fasr.fasl.fast.fasds.fasdr.fasdl.fasdt.faslr.faslpr.fasldr.faslpdr.fapr.fams.favs.fawsb.fatl.fans.fands.faes.fagt.fajr.fajfr.fajdr.facr.fausb.faudsb.faufsb`.split(`.`).concat(bt,[`fa-solid`,`fa-regular`,`fa-light`,`fa-thin`,`fa-duotone`,`fa-brands`,`fa-semibold`]),Tt=[`solid`,`regular`,`light`,`thin`,`duotone`,`brands`,`semibold`],Et=[1,2,3,4,5,6,7,8,9,10],Dt=Et.concat([11,12,13,14,15,16,17,18,19,20]),Ot=[].concat(S(Object.keys(St)),Tt,[`aw`,`fw`,`pull-left`,`pull-right`],[`2xs`,`xs`,`sm`,`lg`,`xl`,`2xl`,`beat`,`beat-fade`,`border`,`bounce`,`buzz`,`canvas-square`,`canvas-roomy`,`fade`,`flip-360`,`flip-both`,`flip-horizontal`,`flip-vertical`,`flip`,`float`,`inverse`,`jello`,`layers`,`layers-bottom-left`,`layers-bottom-right`,`layers-counter`,`layers-text`,`layers-top-left`,`layers-top-right`,`li`,`pull-end`,`pull-start`,`pulse`,`rotate-180`,`rotate-270`,`rotate-90`,`rotate-by`,`shake`,`spin-pulse`,`spin-reverse`,`spin`,`spin-snap`,`spin-snap-4`,`spin-snap-8`,`stack-1x`,`stack-2x`,`stack`,`swing`,`ul`,`wag`,`width-auto`,`width-fixed`,yt.GROUP,yt.SWAP_OPACITY,yt.PRIMARY,yt.SECONDARY],Et.map(function(e){return`${e}x`}),Dt.map(function(e){return`w-${e}`})),kt={"Font Awesome 5 Free":{900:`fas`,400:`far`},"Font Awesome 5 Pro":{900:`fas`,400:`far`,normal:`far`,300:`fal`},"Font Awesome 5 Brands":{400:`fab`,normal:`fab`},"Font Awesome 5 Duotone":{900:`fad`}},P=`___FONT_AWESOME___`,At=16,jt=`fa`,Mt=`svg-inline--fa`,Nt=`data-fa-i2svg`,Pt=`data-fa-pseudo-element`,Ft=`data-fa-pseudo-element-pending`,It=`data-prefix`,Lt=`data-icon`,Rt=`fontawesome-i2svg`,zt=`async`,Bt=[`HTML`,`HEAD`,`STYLE`,`SCRIPT`],Vt=[`::before`,`::after`,`:before`,`:after`],Ht=function(){try{return!0}catch{return!1}}();function Ut(e){return new Proxy(e,{get:function(e,t){return t in e?e[t]:e[N]}})}var Wt=b({},ue);Wt[N]=b(b(b(b({},{"fa-duotone":`duotone`}),ue[N]),ft.kit),ft[`kit-duotone`]);var Gt=Ut(Wt),Kt=b({},ut);Kt[N]=b(b(b(b({},{duotone:`fad`}),Kt[N]),_t.kit),_t[`kit-duotone`]);var qt=Ut(Kt),Jt=b({},Ct);Jt[N]=b(b({},Jt[N]),gt.kit);var Yt=Ut(Jt),Xt=b({},xt);Xt[N]=b(b({},Xt[N]),mt.kit),Ut(Xt);var Zt=ce,Qt=`fa-layers-text`,$t=le;Ut(b({},st));var en=[`class`,`data-prefix`,`data-icon`,`data-fa-transform`,`data-fa-mask`],tn=de,nn=[].concat(S(pt),S(Ot)),rn=A.FontAwesomeConfig||{};function an(e){var t=j.querySelector(`script[`+e+`]`);if(t)return t.getAttribute(e)}function on(e){return e===``?!0:e===`false`?!1:e===`true`||e}j&&typeof j.querySelector==`function`&&[[`data-family-prefix`,`familyPrefix`],[`data-css-prefix`,`cssPrefix`],[`data-family-default`,`familyDefault`],[`data-style-default`,`styleDefault`],[`data-replacement-class`,`replacementClass`],[`data-auto-replace-svg`,`autoReplaceSvg`],[`data-auto-add-css`,`autoAddCss`],[`data-search-pseudo-elements`,`searchPseudoElements`],[`data-search-pseudo-elements-warnings`,`searchPseudoElementsWarnings`],[`data-search-pseudo-elements-full-scan`,`searchPseudoElementsFullScan`],[`data-observe-mutations`,`observeMutations`],[`data-mutate-approach`,`mutateApproach`],[`data-keep-original-source`,`keepOriginalSource`],[`data-measure-performance`,`measurePerformance`],[`data-show-missing-icons`,`showMissingIcons`]].forEach(function(e){var t=x(e,2),n=t[0],r=t[1],i=on(an(n));i!=null&&(rn[r]=i)});var sn={styleDefault:`solid`,familyDefault:N,cssPrefix:jt,replacementClass:Mt,autoReplaceSvg:!0,autoAddCss:!0,searchPseudoElements:!1,searchPseudoElementsWarnings:!0,searchPseudoElementsFullScan:!1,observeMutations:!0,mutateApproach:`async`,keepOriginalSource:!0,measurePerformance:!1,showMissingIcons:!0};rn.familyPrefix&&(rn.cssPrefix=rn.familyPrefix);var cn=b(b({},sn),rn);cn.autoReplaceSvg||(cn.observeMutations=!1);var F={};Object.keys(sn).forEach(function(e){Object.defineProperty(F,e,{enumerable:!0,set:function(t){cn[e]=t,ln.forEach(function(e){return e(F)})},get:function(){return cn[e]}})}),Object.defineProperty(F,"familyPrefix",{enumerable:!0,set:function(e){cn.cssPrefix=e,ln.forEach(function(e){return e(F)})},get:function(){return cn.cssPrefix}}),A.FontAwesomeConfig=F;var ln=[];function un(e){return ln.push(e),function(){ln.splice(ln.indexOf(e),1)}}var I=At,L={size:16,x:0,y:0,rotate:0,flipX:!1,flipY:!1};function dn(e){if(e&&M){var t=j.createElement(`style`);t.setAttribute(`type`,`text/css`),t.innerHTML=e;for(var n=j.head.childNodes,r=null,i=n.length-1;i>-1;i--){var a=n[i],o=(a.tagName||``).toUpperCase();[`STYLE`,`LINK`].indexOf(o)>-1&&(r=a)}return j.head.insertBefore(t,r),e}}var fn=`0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`;function pn(){for(var e=12,t=``;e-->0;)t+=fn[Math.random()*62|0];return t}function mn(e){for(var t=[],n=(e||[]).length>>>0;n--;)t[n]=e[n];return t}function hn(e){return e.classList?mn(e.classList):(e.getAttribute(`class`)||``).split(` `).filter(function(e){return e})}function gn(e){return`${e}`.replace(/&/g,`&amp;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`)}function _n(e){return Object.keys(e||{}).reduce(function(t,n){return t+`${n}="${gn(e[n])}" `},``).trim()}function vn(e){return Object.keys(e||{}).reduce(function(t,n){return t+`${n}: ${e[n].trim()};`},``)}function yn(e){return e.size!==L.size||e.x!==L.x||e.y!==L.y||e.rotate!==L.rotate||e.flipX||e.flipY}function bn(e){var t=e.transform,n=e.containerWidth,r=e.iconWidth;return{outer:{transform:`translate(${n/2} 256)`},inner:{transform:`${`translate(${t.x*32}, ${t.y*32}) `} ${`scale(${t.size/16*(t.flipX?-1:1)}, ${t.size/16*(t.flipY?-1:1)}) `} ${`rotate(${t.rotate} 0 0)`}`},path:{transform:`translate(${r/2*-1} -256)`}}}function xn(e){var t=e.transform,n=e.width,r=n===void 0?At:n,i=e.height,a=i===void 0?At:i,o=e.startCentered,s=o!==void 0&&o,c=``;return c+=s&&oe?`translate(${t.x/I-r/2}em, ${t.y/I-a/2}em) `:s?`translate(calc(-50% + ${t.x/I}em), calc(-50% + ${t.y/I}em)) `:`translate(${t.x/I}em, ${t.y/I}em) `,c+=`scale(${t.size/I*(t.flipX?-1:1)}, ${t.size/I*(t.flipY?-1:1)}) `,c+=`rotate(${t.rotate}deg) `,c}var Sn=`:root, :host {
  --fa-font-solid: normal 900 1em/1 'Font Awesome 7 Free';
  --fa-font-regular: normal 400 1em/1 'Font Awesome 7 Free';
  --fa-font-light: normal 300 1em/1 'Font Awesome 7 Pro';
  --fa-font-thin: normal 100 1em/1 'Font Awesome 7 Pro';
  --fa-font-duotone: normal 900 1em/1 'Font Awesome 7 Duotone';
  --fa-font-duotone-regular: normal 400 1em/1 'Font Awesome 7 Duotone';
  --fa-font-duotone-light: normal 300 1em/1 'Font Awesome 7 Duotone';
  --fa-font-duotone-thin: normal 100 1em/1 'Font Awesome 7 Duotone';
  --fa-font-brands: normal 400 1em/1 'Font Awesome 7 Brands';
  --fa-font-sharp-solid: normal 900 1em/1 'Font Awesome 7 Sharp';
  --fa-font-sharp-regular: normal 400 1em/1 'Font Awesome 7 Sharp';
  --fa-font-sharp-light: normal 300 1em/1 'Font Awesome 7 Sharp';
  --fa-font-sharp-thin: normal 100 1em/1 'Font Awesome 7 Sharp';
  --fa-font-sharp-duotone-solid: normal 900 1em/1 'Font Awesome 7 Sharp Duotone';
  --fa-font-sharp-duotone-regular: normal 400 1em/1 'Font Awesome 7 Sharp Duotone';
  --fa-font-sharp-duotone-light: normal 300 1em/1 'Font Awesome 7 Sharp Duotone';
  --fa-font-sharp-duotone-thin: normal 100 1em/1 'Font Awesome 7 Sharp Duotone';
  --fa-font-slab-regular: normal 400 1em/1 'Font Awesome 7 Slab';
  --fa-font-slab-press-regular: normal 400 1em/1 'Font Awesome 7 Slab Press';
  --fa-font-slab-duo-regular: normal 400 1em/1 'Font Awesome 7 Slab Duo';
  --fa-font-slab-press-duo-regular: normal 400 1em/1 'Font Awesome 7 Slab Press Duo';
  --fa-font-pixel-regular: normal 400 1em/1 'Font Awesome 7 Pixel';
  --fa-font-mosaic-solid: normal 900 1em/1 'Font Awesome 7 Mosaic';
  --fa-font-vellum-solid: normal 900 1em/1 'Font Awesome 7 Vellum';
  --fa-font-whiteboard-semibold: normal 600 1em/1 'Font Awesome 7 Whiteboard';
  --fa-font-thumbprint-light: normal 300 1em/1 'Font Awesome 7 Thumbprint';
  --fa-font-notdog-solid: normal 900 1em/1 'Font Awesome 7 Notdog';
  --fa-font-notdog-duo-solid: normal 900 1em/1 'Font Awesome 7 Notdog Duo';
  --fa-font-etch-solid: normal 900 1em/1 'Font Awesome 7 Etch';
  --fa-font-graphite-thin: normal 100 1em/1 'Font Awesome 7 Graphite';
  --fa-font-jelly-regular: normal 400 1em/1 'Font Awesome 7 Jelly';
  --fa-font-jelly-fill-regular: normal 400 1em/1 'Font Awesome 7 Jelly Fill';
  --fa-font-jelly-duo-regular: normal 400 1em/1 'Font Awesome 7 Jelly Duo';
  --fa-font-chisel-regular: normal 400 1em/1 'Font Awesome 7 Chisel';
  --fa-font-utility-semibold: normal 600 1em/1 'Font Awesome 7 Utility';
  --fa-font-utility-duo-semibold: normal 600 1em/1 'Font Awesome 7 Utility Duo';
  --fa-font-utility-fill-semibold: normal 600 1em/1 'Font Awesome 7 Utility Fill';
}

.svg-inline--fa {
  box-sizing: content-box;
  display: var(--fa-display, inline-block);
  height: 1em;
  overflow: visible;
  vertical-align: -0.125em;
  width: var(--fa-width, 1.25em);
}
.svg-inline--fa.fa-2xs {
  vertical-align: 0.1em;
}
.svg-inline--fa.fa-xs {
  vertical-align: 0em;
}
.svg-inline--fa.fa-sm {
  vertical-align: -0.0714285714em;
}
.svg-inline--fa.fa-lg {
  vertical-align: -0.2em;
}
.svg-inline--fa.fa-xl {
  vertical-align: -0.25em;
}
.svg-inline--fa.fa-2xl {
  vertical-align: -0.3125em;
}
.svg-inline--fa.fa-pull-left,
.svg-inline--fa .fa-pull-start {
  float: inline-start;
  margin-inline-end: var(--fa-pull-margin, 0.3em);
}
.svg-inline--fa.fa-pull-right,
.svg-inline--fa .fa-pull-end {
  float: inline-end;
  margin-inline-start: var(--fa-pull-margin, 0.3em);
}
.svg-inline--fa.fa-li {
  width: var(--fa-li-width, 2em);
  inset-inline-start: calc(-1 * var(--fa-li-width, 2em));
  inset-block-start: 0.25em; /* syncing vertical alignment with Web Font rendering */
}

.fa-layers-counter, .fa-layers-text {
  display: inline-block;
  position: absolute;
  text-align: center;
}

.fa-layers {
  display: inline-block;
  height: 1em;
  position: relative;
  text-align: center;
  vertical-align: -0.125em;
  width: var(--fa-width, 1.25em);
}
.fa-layers .svg-inline--fa {
  inset: 0;
  margin: auto;
  position: absolute;
  transform-origin: center center;
}

.fa-layers-text {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  transform-origin: center center;
}

.fa-layers-counter {
  background-color: var(--fa-counter-background-color, #ff253a);
  border-radius: var(--fa-counter-border-radius, 1em);
  box-sizing: border-box;
  color: var(--fa-inverse, #fff);
  line-height: var(--fa-counter-line-height, 1);
  max-width: var(--fa-counter-max-width, 5em);
  min-width: var(--fa-counter-min-width, 1.5em);
  overflow: hidden;
  padding: var(--fa-counter-padding, 0.25em 0.5em);
  right: var(--fa-right, 0);
  text-overflow: ellipsis;
  top: var(--fa-top, 0);
  transform: scale(var(--fa-counter-scale, 0.25));
  transform-origin: top right;
}

.fa-layers-bottom-right {
  bottom: var(--fa-bottom, 0);
  right: var(--fa-right, 0);
  top: auto;
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: bottom right;
}

.fa-layers-bottom-left {
  bottom: var(--fa-bottom, 0);
  left: var(--fa-left, 0);
  right: auto;
  top: auto;
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: bottom left;
}

.fa-layers-top-right {
  top: var(--fa-top, 0);
  right: var(--fa-right, 0);
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: top right;
}

.fa-layers-top-left {
  left: var(--fa-left, 0);
  right: auto;
  top: var(--fa-top, 0);
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: top left;
}

.fa-1x {
  font-size: 1em;
}

.fa-2x {
  font-size: 2em;
}

.fa-3x {
  font-size: 3em;
}

.fa-4x {
  font-size: 4em;
}

.fa-5x {
  font-size: 5em;
}

.fa-6x {
  font-size: 6em;
}

.fa-7x {
  font-size: 7em;
}

.fa-8x {
  font-size: 8em;
}

.fa-9x {
  font-size: 9em;
}

.fa-10x {
  font-size: 10em;
}

.fa-2xs {
  font-size: calc(10 / 16 * 1em); /* converts a 10px size into an em-based value that's relative to the scale's 16px base */
  line-height: calc(1 / 10 * 1em); /* sets the line-height of the icon back to that of it's parent */
  vertical-align: calc((6 / 10 - 0.375) * 1em); /* vertically centers the icon taking into account the surrounding text's descender */
}

.fa-xs {
  font-size: calc(12 / 16 * 1em); /* converts a 12px size into an em-based value that's relative to the scale's 16px base */
  line-height: calc(1 / 12 * 1em); /* sets the line-height of the icon back to that of it's parent */
  vertical-align: calc((6 / 12 - 0.375) * 1em); /* vertically centers the icon taking into account the surrounding text's descender */
}

.fa-sm {
  font-size: calc(14 / 16 * 1em); /* converts a 14px size into an em-based value that's relative to the scale's 16px base */
  line-height: calc(1 / 14 * 1em); /* sets the line-height of the icon back to that of it's parent */
  vertical-align: calc((6 / 14 - 0.375) * 1em); /* vertically centers the icon taking into account the surrounding text's descender */
}

.fa-lg {
  font-size: calc(20 / 16 * 1em); /* converts a 20px size into an em-based value that's relative to the scale's 16px base */
  line-height: calc(1 / 20 * 1em); /* sets the line-height of the icon back to that of it's parent */
  vertical-align: calc((6 / 20 - 0.375) * 1em); /* vertically centers the icon taking into account the surrounding text's descender */
}

.fa-xl {
  font-size: calc(24 / 16 * 1em); /* converts a 24px size into an em-based value that's relative to the scale's 16px base */
  line-height: calc(1 / 24 * 1em); /* sets the line-height of the icon back to that of it's parent */
  vertical-align: calc((6 / 24 - 0.375) * 1em); /* vertically centers the icon taking into account the surrounding text's descender */
}

.fa-2xl {
  font-size: calc(32 / 16 * 1em); /* converts a 32px size into an em-based value that's relative to the scale's 16px base */
  line-height: calc(1 / 32 * 1em); /* sets the line-height of the icon back to that of it's parent */
  vertical-align: calc((6 / 32 - 0.375) * 1em); /* vertically centers the icon taking into account the surrounding text's descender */
}

.fa-width-auto {
  --fa-width: auto;
}

.fa-fw,
.fa-width-fixed {
  --fa-width: 1.25em;
}

.fa-canvas-square {
  padding-block: 0.125em;
  margin-block-end: -0.125em;
}

.fa-canvas-roomy {
  padding-block: 0.25em;
  padding-inline: 0.125em;
  margin-block-end: -0.25em;
  box-sizing: content-box;
}

.fa-ul {
  list-style-type: none;
  margin-inline-start: var(--fa-li-margin, 2.5em);
  padding-inline-start: 0;
}
.fa-ul > li {
  position: relative;
}

.fa-li {
  inset-inline-start: calc(-1 * var(--fa-li-width, 2em));
  position: absolute;
  text-align: center;
  width: var(--fa-li-width, 2em);
  line-height: inherit;
}

/* Heads Up: Bordered Icons will not be supported in the future!
  - This feature will be deprecated in the next major release of Font Awesome (v8)!
  - You may continue to use it in this version *v7), but it will not be supported in Font Awesome v8.
*/
/* Notes:
* --@{v.$css-prefix}-border-width = 1/16 by default (to render as ~1px based on a 16px default font-size)
* --@{v.$css-prefix}-border-padding =
  ** 3/16 for vertical padding (to give ~2px of vertical whitespace around an icon considering it's vertical alignment)
  ** 4/16 for horizontal padding (to give ~4px of horizontal whitespace around an icon)
*/
.fa-border {
  border-color: var(--fa-border-color, #eee);
  border-radius: var(--fa-border-radius, 0.1em);
  border-style: var(--fa-border-style, solid);
  border-width: var(--fa-border-width, 0.0625em);
  box-sizing: var(--fa-border-box-sizing, content-box);
  padding: var(--fa-border-padding, 0.1875em 0.25em);
}

.fa-pull-left,
.fa-pull-start {
  float: inline-start;
  margin-inline-end: var(--fa-pull-margin, 0.3em);
}

.fa-pull-right,
.fa-pull-end {
  float: inline-end;
  margin-inline-start: var(--fa-pull-margin, 0.3em);
}

.fa-beat {
  animation-name: fa-beat;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-bounce {
  animation-name: fa-bounce;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.28, 0.84, 0.42, 1));
}

.fa-fade {
  animation-name: fa-fade;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-beat-fade {
  animation-name: fa-beat-fade;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-flip {
  animation-name: fa-flip;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1.5s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-flip-360 {
  animation-name: fa-flip-360;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-shake {
  animation-name: fa-shake;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 0.75s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-spin {
  animation-name: fa-spin;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 2s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, linear);
}

.fa-spin-reverse {
  --fa-animation-direction: reverse;
}

.fa-pulse,
.fa-spin-pulse {
  animation-name: fa-spin;
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, steps(8));
}

.fa-spin-snap {
  animation-name: fa-spin-snap;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 3s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, linear);
}

.fa-spin-snap-4 {
  animation-name: fa-spin-snap-4;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 2.4s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, linear);
}

.fa-spin-snap-8 {
  animation-name: fa-spin-snap-8;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 4s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, linear);
}

.fa-buzz {
  animation-name: fa-buzz;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 0.6s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, linear);
}

.fa-wag {
  animation-name: fa-wag;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 0.9s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-out);
  transform-origin: bottom center;
}

.fa-float {
  animation-name: fa-float;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 3s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-in-out);
  will-change: transform;
}

.fa-swing {
  animation-name: fa-swing;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1.2s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-out);
  transform-origin: top center;
}

.fa-jello {
  animation-name: fa-jello;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 0.9s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .fa-beat,
  .fa-bounce,
  .fa-fade,
  .fa-beat-fade,
  .fa-flip,
  .fa-flip-360,
  .fa-pulse,
  .fa-shake,
  .fa-spin,
  .fa-spin-pulse,
  .fa-buzz,
  .fa-float,
  .fa-jello,
  .fa-spin-snap,
  .fa-spin-snap-4,
  .fa-spin-snap-8,
  .fa-swing,
  .fa-wag {
    animation: none !important;
    transition: none !important;
  }
}
@keyframes fa-beat {
  0% {
    transform: scale(1);
  }
  25% {
    transform: scale(calc(1.25 * var(--fa-beat-scale, 1.25)));
  }
  45% {
    transform: scale(calc(1.22 * var(--fa-beat-scale, 1.22)));
  }
  65% {
    transform: scale(calc(1.25 * var(--fa-beat-scale, 1.25)));
  }
  90% {
    transform: scale(1);
  }
}
@keyframes fa-bounce {
  0% {
    transform: scale(1, 1) translateY(0);
    animation-timing-function: var(--fa-animation-timing);
  }
  14% {
    transform: scale(var(--fa-bounce-start-scale-x, 1.06), var(--fa-bounce-start-scale-y, 0.94)) translateY(var(--fa-bounce-anticipation, 3px));
    animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
  }
  32% {
    transform: scale(var(--fa-bounce-jump-scale-x, 0.94), var(--fa-bounce-jump-scale-y, 1.12)) translateY(calc(-1 * var(--fa-bounce-height, 0.5em)));
    animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
  }
  52% {
    transform: scale(1, 1) translateY(calc(-1 * var(--fa-bounce-height, 0.5em) * 1.1));
    animation-timing-function: cubic-bezier(0.5, 0, 1, 0.5);
  }
  70% {
    transform: scale(var(--fa-bounce-land-scale-x, 1.06), var(--fa-bounce-land-scale-y, 0.92)) translateY(0);
    animation-timing-function: cubic-bezier(0.33, 0.33, 0.66, 1);
  }
  85% {
    transform: scale(0.98, 1.04) translateY(calc(-2px * var(--fa-bounce-rebound, 1)));
    animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
  }
  100% {
    transform: scale(1, 1) translateY(0);
  }
}
@keyframes fa-fade {
  0% {
    opacity: 1;
    transform: scale(1);
    animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
  }
  40% {
    opacity: var(--fa-fade-opacity, 0.4);
    transform: scale(0.98);
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes fa-beat-fade {
  0% {
    opacity: var(--fa-beat-fade-opacity, 0.4);
    transform: scale(1);
    animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
  }
  25% {
    opacity: calc(var(--fa-beat-fade-opacity, 0.4) + 0.4);
    transform: scale(var(--fa-beat-fade-scale, 1.28));
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  }
  45% {
    opacity: 1;
    transform: scale(var(--fa-beat-fade-scale, 1.25));
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  65% {
    opacity: calc(var(--fa-beat-fade-opacity, 0.4) + 0.4);
    transform: scale(var(--fa-beat-fade-scale, 1.28));
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  }
  100% {
    opacity: var(--fa-beat-fade-opacity, 0.4);
    transform: scale(1);
  }
}
@keyframes fa-flip {
  0% {
    transform: perspective(2em) scale(1) rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), 0deg);
    animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
  }
  8% {
    transform: perspective(2em) scale(var(--fa-flip-anticipation-scale, 0.95)) rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), 0deg);
    animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
  }
  35% {
    transform: perspective(2em) scale(1) rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), calc(var(--fa-flip-angle, -360deg) * 0.6));
    animation-timing-function: linear;
  }
  65% {
    transform: perspective(2em) scale(1) rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), calc(var(--fa-flip-angle, -360deg) * 0.5));
    animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
  }
  92% {
    transform: perspective(2em) scale(1) rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), calc(var(--fa-flip-angle, -360deg) * var(--fa-flip-overshoot, 1.04)));
    animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
  }
  100% {
    transform: perspective(2em) scale(1) rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), var(--fa-flip-angle, -360deg));
  }
}
@keyframes fa-flip-360 {
  0% {
    transform: perspective(2em) scale(1) rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), 0deg);
    animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1);
  }
  8% {
    transform: perspective(2em) scale(var(--fa-flip-anticipation-scale, 0.95)) rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), 0deg);
    animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
  }
  50% {
    transform: perspective(2em) scale(1) rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), calc(var(--fa-flip-angle, -360deg) * 0.6));
    animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
  }
  80% {
    transform: perspective(2em) scale(1) rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), calc(var(--fa-flip-angle, -360deg) * var(--fa-flip-overshoot, 1.04)));
    animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
  }
  100% {
    transform: perspective(2em) scale(1) rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), var(--fa-flip-angle, -360deg));
  }
}
@keyframes fa-shake {
  0% {
    transform: rotate(0deg);
    animation-timing-function: cubic-bezier(0.2, 0, 0.8, 1);
  }
  8% {
    transform: rotate(35deg) translateX(1px);
    animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
  }
  20% {
    transform: rotate(-22deg) translateX(-1px);
    animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
  }
  35% {
    transform: rotate(15deg) translateX(1px);
    animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
  }
  50% {
    transform: rotate(-9deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  }
  65% {
    transform: rotate(5deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  }
  78% {
    transform: rotate(-3deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  }
  90% {
    transform: rotate(1deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  100% {
    transform: rotate(0deg);
  }
}
@keyframes fa-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
@keyframes fa-spin-snap {
  0% {
    transform: rotate(0deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  12% {
    transform: rotate(60deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  16.67% {
    transform: rotate(60deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  28.67% {
    transform: rotate(120deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  33.33% {
    transform: rotate(120deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  45.33% {
    transform: rotate(180deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: rotate(180deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  62% {
    transform: rotate(240deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  66.67% {
    transform: rotate(240deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  78.67% {
    transform: rotate(300deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  83.33% {
    transform: rotate(300deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  95.33% {
    transform: rotate(360deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  100% {
    transform: rotate(360deg);
  }
}
@keyframes fa-spin-snap-4 {
  0% {
    transform: rotate(0deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  15% {
    transform: rotate(90deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  25% {
    transform: rotate(90deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  40% {
    transform: rotate(180deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: rotate(180deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  65% {
    transform: rotate(270deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  75% {
    transform: rotate(270deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  90% {
    transform: rotate(360deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  100% {
    transform: rotate(360deg);
  }
}
@keyframes fa-spin-snap-8 {
  0% {
    transform: rotate(0deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  9% {
    transform: rotate(45deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  12.5% {
    transform: rotate(45deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  21.5% {
    transform: rotate(90deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  25% {
    transform: rotate(90deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  34% {
    transform: rotate(135deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  37.5% {
    transform: rotate(135deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  46.5% {
    transform: rotate(180deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: rotate(180deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  59% {
    transform: rotate(225deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  62.5% {
    transform: rotate(225deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  71.5% {
    transform: rotate(270deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  75% {
    transform: rotate(270deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  84% {
    transform: rotate(315deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  87.5% {
    transform: rotate(315deg);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
  96.5% {
    transform: rotate(360deg);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  100% {
    transform: rotate(360deg);
  }
}
@keyframes fa-buzz {
  0% {
    transform: translateX(0) rotate(0deg);
    animation-timing-function: cubic-bezier(0.1, 0, 0.9, 1);
  }
  5% {
    transform: translateX(var(--fa-buzz-distance, 4px)) rotate(0.5deg);
  }
  10% {
    transform: translateX(calc(-1 * var(--fa-buzz-distance, 4px))) rotate(-0.5deg);
  }
  15% {
    transform: translateX(var(--fa-buzz-distance, 4px)) rotate(0.3deg);
  }
  20% {
    transform: translateX(calc(-1 * var(--fa-buzz-distance, 4px))) rotate(-0.3deg);
  }
  25% {
    transform: translateX(calc(var(--fa-buzz-distance, 4px) * 0.7)) rotate(0.2deg);
  }
  30% {
    transform: translateX(calc(-1 * var(--fa-buzz-distance, 4px) * 0.7)) rotate(-0.2deg);
  }
  35% {
    transform: translateX(calc(var(--fa-buzz-distance, 4px) * 0.4)) rotate(0.1deg);
  }
  40% {
    transform: translateX(0) rotate(0deg);
  }
  100% {
    transform: translateX(0) rotate(0deg);
  }
}
@keyframes fa-wag {
  0% {
    transform: rotate(0deg);
    animation-timing-function: cubic-bezier(0.2, 0, 0.6, 1);
  }
  12% {
    transform: rotate(var(--fa-wag-angle, 12deg));
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  24% {
    transform: rotate(2deg);
    animation-timing-function: cubic-bezier(0.2, 0, 0.6, 1);
  }
  36% {
    transform: rotate(calc(var(--fa-wag-angle, 12deg) * 0.85));
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  48% {
    transform: rotate(1deg);
    animation-timing-function: cubic-bezier(0.2, 0, 0.6, 1);
  }
  58% {
    transform: rotate(calc(var(--fa-wag-angle, 12deg) * 0.6));
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  68% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
@keyframes fa-float {
  0% {
    transform: translateY(0) translateX(0) rotate(0deg) scale(var(--fa-float-squash-x, 1.02), var(--fa-float-squash-y, 0.98));
    animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
  }
  15% {
    transform: translateY(calc(-0.4 * var(--fa-float-height, 6px))) translateX(var(--fa-float-drift, 1px)) rotate(var(--fa-float-tilt, 1deg)) scale(1, 1);
    animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
  }
  35% {
    transform: translateY(calc(-1 * var(--fa-float-height, 6px))) translateX(0) rotate(0deg) scale(var(--fa-float-stretch-x, 0.98), var(--fa-float-stretch-y, 1.03));
    animation-timing-function: cubic-bezier(0.5, 0, 0.5, 0);
  }
  50% {
    transform: translateY(calc(-0.92 * var(--fa-float-height, 6px))) translateX(calc(-0.5 * var(--fa-float-drift, 1px))) rotate(calc(-0.5 * var(--fa-float-tilt, 1deg))) scale(0.995, 1.01);
    animation-timing-function: cubic-bezier(0.33, 0, 0.66, 0.33);
  }
  70% {
    transform: translateY(calc(-0.3 * var(--fa-float-height, 6px))) translateX(calc(-1 * var(--fa-float-drift, 1px))) rotate(calc(-1 * var(--fa-float-tilt, 1deg))) scale(1, 1);
    animation-timing-function: cubic-bezier(0.33, 0.66, 0.66, 1);
  }
  90% {
    transform: translateY(calc(0.05 * var(--fa-float-height, 6px))) translateX(0) rotate(0deg) scale(var(--fa-float-squash-x, 1.02), var(--fa-float-squash-y, 0.98));
    animation-timing-function: cubic-bezier(0.33, 0, 0.66, 1);
  }
  100% {
    transform: translateY(0) translateX(0) rotate(0deg) scale(var(--fa-float-squash-x, 1.02), var(--fa-float-squash-y, 0.98));
  }
}
@keyframes fa-swing {
  0% {
    transform: rotate(0deg);
    animation-timing-function: cubic-bezier(0.2, 0, 0.8, 1);
  }
  8% {
    transform: rotate(var(--fa-swing-angle, 22deg));
    animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
  }
  18% {
    transform: rotate(calc(-1 * var(--fa-swing-angle, 22deg) * 0.85));
    animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
  }
  28% {
    transform: rotate(calc(var(--fa-swing-angle, 22deg) * 0.65));
    animation-timing-function: cubic-bezier(0.35, 0, 0.65, 1);
  }
  38% {
    transform: rotate(calc(-1 * var(--fa-swing-angle, 22deg) * 0.45));
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  }
  48% {
    transform: rotate(calc(var(--fa-swing-angle, 22deg) * 0.25));
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  }
  56% {
    transform: rotate(calc(-1 * var(--fa-swing-angle, 22deg) * 0.1));
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  }
  64% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
@keyframes fa-jello {
  0% {
    transform: scale(1, 1);
    animation-timing-function: cubic-bezier(0.2, 0, 0.8, 1);
  }
  12% {
    transform: scale(var(--fa-jello-scale-x, 1.15), calc(2 - var(--fa-jello-scale-x, 1.15)));
    animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
  }
  24% {
    transform: scale(calc(2 - var(--fa-jello-scale-y, 1.12)), var(--fa-jello-scale-y, 1.12));
    animation-timing-function: cubic-bezier(0.3, 0, 0.7, 1);
  }
  36% {
    transform: scale(calc(1 + (var(--fa-jello-scale-x, 1.15) - 1) * 0.5), calc(2 - (1 + (var(--fa-jello-scale-x, 1.15) - 1) * 0.5)));
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  }
  48% {
    transform: scale(calc(2 - (1 + (var(--fa-jello-scale-y, 1.12) - 1) * 0.3)), calc(1 + (var(--fa-jello-scale-y, 1.12) - 1) * 0.3));
    animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
  }
  58% {
    transform: scale(1.02, 0.98);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  68% {
    transform: scale(1, 1);
  }
  100% {
    transform: scale(1, 1);
  }
}
.fa-rotate-90 {
  transform: rotate(90deg);
}

.fa-rotate-180 {
  transform: rotate(180deg);
}

.fa-rotate-270 {
  transform: rotate(270deg);
}

.fa-flip-horizontal {
  transform: scale(-1, 1);
}

.fa-flip-vertical {
  transform: scale(1, -1);
}

.fa-flip-both,
.fa-flip-horizontal.fa-flip-vertical {
  transform: scale(-1, -1);
}

.fa-rotate-by {
  transform: rotate(var(--fa-rotate-angle, 0));
}

.svg-inline--fa .fa-primary {
  fill: var(--fa-primary-color, currentColor);
  opacity: var(--fa-primary-opacity, 1);
}

.svg-inline--fa .fa-secondary {
  fill: var(--fa-secondary-color, currentColor);
  opacity: var(--fa-secondary-opacity, 0.4);
}

.svg-inline--fa.fa-swap-opacity .fa-primary {
  opacity: var(--fa-secondary-opacity, 0.4);
}

.svg-inline--fa.fa-swap-opacity .fa-secondary {
  opacity: var(--fa-primary-opacity, 1);
}

.svg-inline--fa mask .fa-primary,
.svg-inline--fa mask .fa-secondary {
  fill: black;
}

.svg-inline--fa.fa-inverse {
  fill: var(--fa-inverse, #fff);
}

.fa-stack {
  display: inline-block;
  height: 2em;
  line-height: 2em;
  position: relative;
  vertical-align: middle;
  width: 2.5em;
}

.fa-inverse {
  color: var(--fa-inverse, #fff);
}

.svg-inline--fa.fa-stack-1x {
  --fa-width: 1.25em;
  height: 1em;
  width: var(--fa-width);
}
.svg-inline--fa.fa-stack-2x {
  --fa-width: 2.5em;
  height: 2em;
  width: var(--fa-width);
}

.fa-stack-1x,
.fa-stack-2x {
  inset: 0;
  margin: auto;
  position: absolute;
  z-index: var(--fa-stack-z-index, auto);
}`;function Cn(){var e=jt,t=Mt,n=F.cssPrefix,r=F.replacementClass,i=Sn;if(n!==e||r!==t){var a=RegExp(`\\.${e}\\-`,`g`),o=RegExp(`\\--${e}\\-`,`g`),s=RegExp(`\\.${t}`,`g`);i=i.replace(a,`.${n}-`).replace(o,`--${n}-`).replace(s,`.${r}`)}return i}var wn=!1;function Tn(){F.autoAddCss&&!wn&&(dn(Cn()),wn=!0)}var En={mixout:function(){return{dom:{css:Cn,insertCss:Tn}}},hooks:function(){return{beforeDOMElementCreation:function(){Tn()},beforeI2svg:function(){Tn()}}}},R=A||{};R[P]||(R[P]={}),R[P].styles||(R[P].styles={}),R[P].hooks||(R[P].hooks={}),R[P].shims||(R[P].shims=[]);var z=R[P],Dn=[],On=function(){j.removeEventListener(`DOMContentLoaded`,On),kn=1,Dn.map(function(e){return e()})},kn=!1;M&&(kn=(j.documentElement.doScroll?/^loaded|^c/:/^loaded|^i|^c/).test(j.readyState),kn||j.addEventListener(`DOMContentLoaded`,On));function An(e){M&&(kn?setTimeout(e,0):Dn.push(e))}function jn(e){var t=e.tag,n=e.attributes,r=n===void 0?{}:n,i=e.children,a=i===void 0?[]:i;return typeof e==`string`?gn(e):`<${t} ${_n(r)}>${a.map(jn).join(``)}</${t}>`}function Mn(e,t,n){if(e&&e[t]&&e[t][n])return{prefix:t,iconName:n,icon:e[t][n]}}var Nn=function(e,t){return function(n,r,i,a){return e.call(t,n,r,i,a)}},Pn=function(e,t,n,r){var i=Object.keys(e),a=i.length,o=r===void 0?t:Nn(t,r),s,c,l;for(n===void 0?(s=1,l=e[i[0]]):(s=0,l=n);s<a;s++)c=i[s],l=o(l,e[c],c,e);return l};function Fn(e){return S(e).length===1?e.codePointAt(0).toString(16):null}function In(e){return Object.keys(e).reduce(function(t,n){var r=e[n];return r.icon?t[r.iconName]=r.icon:t[n]=r,t},{})}function Ln(e,t){var n=(arguments.length>2&&arguments[2]!==void 0?arguments[2]:{}).skipHooks,r=n!==void 0&&n,i=In(t);typeof z.hooks.addPack==`function`&&!r?z.hooks.addPack(e,In(t)):z.styles[e]=b(b({},z.styles[e]||{}),i),e===`fas`&&Ln(`fa`,t)}var Rn=z.styles,zn=z.shims,Bn=Object.keys(Yt),Vn=Bn.reduce(function(e,t){return e[t]=Object.keys(Yt[t]),e},{}),Hn=null,Un={},Wn={},Gn={},Kn={},qn={};function Jn(e){return~nn.indexOf(e)}function Yn(e,t){var n=t.split(`-`),r=n[0],i=n.slice(1).join(`-`);return r===e&&i!==``&&!Jn(i)?i:null}var Xn=function(){var e=function(e){return Pn(Rn,function(t,n,r){return t[r]=Pn(n,e,{}),t},{})};Un=e(function(e,t,n){return t[3]&&(e[t[3]]=n),t[2]&&t[2].filter(function(e){return typeof e==`number`}).forEach(function(t){e[t.toString(16)]=n}),e}),Wn=e(function(e,t,n){return e[n]=n,t[2]&&t[2].filter(function(e){return typeof e==`string`}).forEach(function(t){e[t]=n}),e}),qn=e(function(e,t,n){var r=t[2];return e[n]=n,r.forEach(function(t){e[t]=n}),e});var t=`far`in Rn||F.autoFetchSvg,n=Pn(zn,function(e,n){var r=n[0],i=n[1],a=n[2];return i===`far`&&!t&&(i=`fas`),typeof r==`string`&&(e.names[r]={prefix:i,iconName:a}),typeof r==`number`&&(e.unicodes[r.toString(16)]={prefix:i,iconName:a}),e},{names:{},unicodes:{}});Gn=n.names,Kn=n.unicodes,Hn=ir(F.styleDefault,{family:F.familyDefault})};un(function(e){Hn=ir(e.styleDefault,{family:F.familyDefault})}),Xn();function Zn(e,t){return(Un[e]||{})[t]}function Qn(e,t){return(Wn[e]||{})[t]}function $n(e,t){return(qn[e]||{})[t]}function er(e){return Gn[e]||{prefix:null,iconName:null}}function tr(e){var t=Kn[e],n=Zn(`fas`,e);return t||(n?{prefix:`fas`,iconName:n}:null)||{prefix:null,iconName:null}}function B(){return Hn}var nr=function(){return{prefix:null,iconName:null,rest:[]}};function rr(e){var t=N,n=Bn.reduce(function(e,t){return e[t]=`${F.cssPrefix}-${t}`,e},{});return ot.forEach(function(r){(e.includes(n[r])||e.some(function(e){return Vn[r].includes(e)}))&&(t=r)}),t}function ir(e){var t=(arguments.length>1&&arguments[1]!==void 0?arguments[1]:{}).family,n=t===void 0?N:t,r=Gt[n][e];if(n===pe&&!e)return`fad`;var i=qt[n][e]||qt[n][r],a=e in z.styles?e:null;return i||a||null}function ar(e){var t=[],n=null;return e.forEach(function(e){var r=Yn(F.cssPrefix,e);r?n=r:e&&t.push(e)}),{iconName:n,rest:t}}function or(e){return e.sort().filter(function(e,t,n){return n.indexOf(e)===t})}var sr=wt.concat(dt);function cr(e){var t=(arguments.length>1&&arguments[1]!==void 0?arguments[1]:{}).skipLookups,n=t!==void 0&&t,r=null,i=or(e.filter(function(e){return sr.includes(e)})),a=or(e.filter(function(e){return!sr.includes(e)})),o=x(i.filter(function(e){return r=e,!fe.includes(e)}),1)[0],s=o===void 0?null:o,c=rr(i),l=b(b({},ar(a)),{},{prefix:ir(s,{family:c})});return b(b(b({},l),fr({values:e,family:c,styles:Rn,config:F,canonical:l,givenPrefix:r})),lr(n,r,l))}function lr(e,t,n){var r=n.prefix,i=n.iconName;if(e||!r||!i)return{prefix:r,iconName:i};var a=t===`fa`?er(i):{},o=$n(r,i);return i=a.iconName||o||i,r=a.prefix||r,r===`far`&&!Rn.far&&Rn.fas&&!F.autoFetchSvg&&(r=`fas`),{prefix:r,iconName:i}}var ur=ot.filter(function(e){return e!==N||e!==pe}),dr=Object.keys(Ct).filter(function(e){return e!==N}).map(function(e){return Object.keys(Ct[e])}).flat();function fr(e){var t=e.values,n=e.family,r=e.canonical,i=e.givenPrefix,a=i===void 0?``:i,o=e.styles,s=o===void 0?{}:o,c=e.config,l=c===void 0?{}:c,u=n===pe,d=t.includes(`fa-duotone`)||t.includes(`fad`),f=l.familyDefault===`duotone`,p=r.prefix===`fad`||r.prefix===`fa-duotone`;return!u&&(d||f||p)&&(r.prefix=`fad`),(t.includes(`fa-brands`)||t.includes(`fab`))&&(r.prefix=`fab`),!r.prefix&&ur.includes(n)&&(Object.keys(s).find(function(e){return dr.includes(e)})||l.autoFetchSvg)&&(r.prefix=lt.get(n).defaultShortPrefixId,r.iconName=$n(r.prefix,r.iconName)||r.iconName),(r.prefix===`fa`||a===`fa`)&&(r.prefix=B()||`fas`),r}var pr=function(){function e(){u(this,e),this.definitions={}}return f(e,[{key:`add`,value:function(){var e=this,t=[...arguments].reduce(this._pullDefinitions,{});Object.keys(t).forEach(function(n){e.definitions[n]=b(b({},e.definitions[n]||{}),t[n]),Ln(n,t[n]);var r=Yt[N][n];r&&Ln(r,t[n]),Xn()})}},{key:`reset`,value:function(){this.definitions={}}},{key:`_pullDefinitions`,value:function(e,t){var n=t.prefix&&t.iconName&&t.icon?{0:t}:t;return Object.keys(n).map(function(t){var r=n[t],i=r.prefix,a=r.iconName,o=r.icon,s=o[2];e[i]||(e[i]={}),s.length>0&&s.forEach(function(t){typeof t==`string`&&(e[i][t]=o)}),e[i][a]=o}),e}}])}(),mr=[],hr={},gr={},_r=Object.keys(gr);function vr(e,t){var n=t.mixoutsTo;return mr=e,hr={},Object.keys(gr).forEach(function(e){_r.indexOf(e)===-1&&delete gr[e]}),mr.forEach(function(e){var t=e.mixout?e.mixout():{};if(Object.keys(t).forEach(function(e){typeof t[e]==`function`&&(n[e]=t[e]),T(t[e])===`object`&&Object.keys(t[e]).forEach(function(r){n[e]||(n[e]={}),n[e][r]=t[e][r]})}),e.hooks){var r=e.hooks();Object.keys(r).forEach(function(e){hr[e]||(hr[e]=[]),hr[e].push(r[e])})}e.provides&&e.provides(gr)}),n}function yr(e,t){var n=[...arguments].slice(2);return(hr[e]||[]).forEach(function(e){t=e.apply(null,[t].concat(n))}),t}function br(e){var t=[...arguments].slice(1);(hr[e]||[]).forEach(function(e){e.apply(null,t)})}function V(){var e=arguments[0],t=Array.prototype.slice.call(arguments,1);return gr[e]?gr[e].apply(null,t):void 0}function xr(e){e.prefix===`fa`&&(e.prefix=`fas`);var t=e.iconName,n=e.prefix||B();if(t)return t=$n(n,t)||t,Mn(Sr.definitions,n,t)||Mn(z.styles,n,t)}var Sr=new pr,H={noAuto:function(){F.autoReplaceSvg=!1,F.observeMutations=!1,br(`noAuto`)},config:F,dom:{i2svg:function(){var e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};return M?(br(`beforeI2svg`,e),V(`pseudoElements2svg`,e),V(`i2svg`,e)):Promise.reject(Error(`Operation requires a DOM of some kind.`))},watch:function(){var e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{},t=e.autoReplaceSvgRoot;F.autoReplaceSvg===!1&&(F.autoReplaceSvg=!0),F.observeMutations=!0,An(function(){Cr({autoReplaceSvgRoot:t}),br(`watch`,e)})}},parse:{icon:function(e){if(e===null)return null;if(T(e)===`object`&&e.prefix&&e.iconName)return{prefix:e.prefix,iconName:$n(e.prefix,e.iconName)||e.iconName};if(Array.isArray(e)&&e.length===2){var t=e[1].indexOf(`fa-`)===0?e[1].slice(3):e[1],n=ir(e[0]);return{prefix:n,iconName:$n(n,t)||t}}if(typeof e==`string`&&(e.indexOf(`${F.cssPrefix}-`)>-1||e.match(Zt))){var r=cr(e.split(` `),{skipLookups:!0});return{prefix:r.prefix||B(),iconName:$n(r.prefix,r.iconName)||r.iconName}}if(typeof e==`string`){var i=B();return{prefix:i,iconName:$n(i,e)||e}}}},library:Sr,findIconDefinition:xr,toHtml:jn},Cr=function(){var e=(arguments.length>0&&arguments[0]!==void 0?arguments[0]:{}).autoReplaceSvgRoot,t=e===void 0?j:e;(Object.keys(z.styles).length>0||F.autoFetchSvg)&&M&&F.autoReplaceSvg&&H.dom.i2svg({node:t})};function wr(e,t){return Object.defineProperty(e,"abstract",{get:t}),Object.defineProperty(e,"html",{get:function(){return e.abstract.map(function(e){return jn(e)})}}),Object.defineProperty(e,"node",{get:function(){if(M){var t=j.createElement(`div`);return t.innerHTML=e.html,t.children}}}),e}function Tr(e){var t=e.children,n=e.main,r=e.mask,i=e.attributes,a=e.styles,o=e.transform;if(yn(o)&&n.found&&!r.found){var s={x:n.width/n.height/2,y:.5};i.style=vn(b(b({},a),{},{"transform-origin":`${s.x+o.x/16}em ${s.y+o.y/16}em`}))}return[{tag:`svg`,attributes:i,children:t}]}function Er(e){var t=e.prefix,n=e.iconName,r=e.children,i=e.attributes,a=e.symbol,o=a===!0?`${t}-${F.cssPrefix}-${n}`:a;return[{tag:`svg`,attributes:{style:`display: none;`},children:[{tag:`symbol`,attributes:b(b({},i),{},{id:o}),children:r}]}]}function Dr(e){return[`aria-label`,`aria-labelledby`,`title`,`role`].some(function(t){return t in e})}function Or(e){var t=e.icons,n=t.main,r=t.mask,i=e.prefix,a=e.iconName,o=e.transform,s=e.symbol,c=e.maskId,l=e.extra,u=e.watchable,d=u!==void 0&&u,f=r.found?r:n,p=f.width,m=f.height,h=[F.replacementClass,a?`${F.cssPrefix}-${a}`:``].filter(function(e){return l.classes.indexOf(e)===-1}).filter(function(e){return e!==``||!!e}).concat(l.classes).join(` `),g={children:[],attributes:b(b({},l.attributes),{},{"data-prefix":i,"data-icon":a,class:h,role:l.attributes.role||`img`,viewBox:`0 0 ${p} ${m}`})};!Dr(l.attributes)&&!l.attributes[`aria-hidden`]&&(g.attributes[`aria-hidden`]=`true`),d&&(g.attributes[Nt]=``);var _=b(b({},g),{},{prefix:i,iconName:a,main:n,mask:r,maskId:c,transform:o,symbol:s,styles:b({},l.styles)}),v=r.found&&n.found?V(`generateAbstractMask`,_)||{children:[],attributes:{}}:V(`generateAbstractIcon`,_)||{children:[],attributes:{}},y=v.children,x=v.attributes;return _.children=y,_.attributes=x,s?Er(_):Tr(_)}function kr(e){var t=e.content,n=e.width,r=e.height,i=e.transform,a=e.extra,o=e.watchable,s=o!==void 0&&o,c=b(b({},a.attributes),{},{class:a.classes.join(` `)});s&&(c[Nt]=``);var l=b({},a.styles);yn(i)&&(l.transform=xn({transform:i,startCentered:!0,width:n,height:r}),l[`-webkit-transform`]=l.transform);var u=vn(l);u.length>0&&(c.style=u);var d=[];return d.push({tag:`span`,attributes:c,children:[t]}),d}function Ar(e){var t=e.content,n=e.extra,r=b(b({},n.attributes),{},{class:n.classes.join(` `)}),i=vn(n.styles);i.length>0&&(r.style=i);var a=[];return a.push({tag:`span`,attributes:r,children:[t]}),a}var jr=z.styles;function Mr(e){var t=e[0],n=e[1],r=x(e.slice(4),1)[0],i=null;return i=Array.isArray(r)?{tag:`g`,attributes:{class:`${F.cssPrefix}-${tn.GROUP}`},children:[{tag:`path`,attributes:{class:`${F.cssPrefix}-${tn.SECONDARY}`,fill:`currentColor`,d:r[0]}},{tag:`path`,attributes:{class:`${F.cssPrefix}-${tn.PRIMARY}`,fill:`currentColor`,d:r[1]}}]}:{tag:`path`,attributes:{fill:`currentColor`,d:r}},{found:!0,width:t,height:n,icon:i}}var Nr={found:!1,width:512,height:512};function Pr(e,t){!Ht&&!F.showMissingIcons&&e&&console.error(`Icon with name "${e}" and prefix "${t}" is missing.`)}function Fr(e,t){var n=t;return t===`fa`&&F.styleDefault!==null&&(t=B()),new Promise(function(r,i){if(n===`fa`){var a=er(e)||{};e=a.iconName||e,t=a.prefix||t}if(e&&t&&jr[t]&&jr[t][e]){var o=jr[t][e];return r(Mr(o))}Pr(e,t),r(b(b({},Nr),{},{icon:F.showMissingIcons&&e&&V(`missingIconAbstract`)||{}}))})}var Ir=function(){},Lr=F.measurePerformance&&ae&&ae.mark&&ae.measure?ae:{mark:Ir,measure:Ir},Rr=`FA "7.3.1"`,zr=function(e){return Lr.mark(`${Rr} ${e} begins`),function(){return Br(e)}},Br=function(e){Lr.mark(`${Rr} ${e} ends`),Lr.measure(`${Rr} ${e}`,`${Rr} ${e} begins`,`${Rr} ${e} ends`)},Vr={begin:zr,end:Br},Hr=function(){};function Ur(e){return typeof(e.getAttribute?e.getAttribute(Nt):null)==`string`}function Wr(e){var t=e.getAttribute?e.getAttribute(It):null,n=e.getAttribute?e.getAttribute(Lt):null;return t&&n}function Gr(e){return e&&e.classList&&e.classList.contains&&e.classList.contains(F.replacementClass)}function Kr(){return F.autoReplaceSvg===!0?Zr.replace:Zr[F.autoReplaceSvg]||Zr.replace}function qr(e){return j.createElementNS(`http://www.w3.org/2000/svg`,e)}function Jr(e){return j.createElement(e)}function Yr(e){var t=(arguments.length>1&&arguments[1]!==void 0?arguments[1]:{}).ceFn,n=t===void 0?e.tag===`svg`?qr:Jr:t;if(typeof e==`string`)return j.createTextNode(e);var r=n(e.tag);return Object.keys(e.attributes||[]).forEach(function(t){r.setAttribute(t,e.attributes[t])}),(e.children||[]).forEach(function(e){r.appendChild(Yr(e,{ceFn:n}))}),r}function Xr(e){var t=` ${e.outerHTML} `;return t=`${t}Font Awesome fontawesome.com `,t}var Zr={replace:function(e){var t=e[0];if(t.parentNode){if(e[1].forEach(function(e){t.parentNode.insertBefore(Yr(e),t)}),t.getAttribute(Nt)===null&&F.keepOriginalSource){var n=j.createComment(Xr(t));t.parentNode.replaceChild(n,t)}else t.remove()}},nest:function(e){var t=e[0],n=e[1];if(~hn(t).indexOf(F.replacementClass))return Zr.replace(e);var r=RegExp(`${F.cssPrefix}-.*`);if(delete n[0].attributes.id,n[0].attributes.class){var i=n[0].attributes.class.split(` `).reduce(function(e,t){return t===F.replacementClass||t.match(r)?e.toSvg.push(t):e.toNode.push(t),e},{toNode:[],toSvg:[]});n[0].attributes.class=i.toSvg.join(` `),i.toNode.length===0?t.removeAttribute(`class`):t.setAttribute(`class`,i.toNode.join(` `))}var a=n.map(function(e){return jn(e)}).join(`
`);t.setAttribute(Nt,``),t.innerHTML=a}};function Qr(e){e()}function $r(e,t){var n=typeof t==`function`?t:Hr;if(e.length===0)n();else{var r=Qr;F.mutateApproach===zt&&(r=A.requestAnimationFrame||Qr),r(function(){var t=Kr(),r=Vr.begin(`mutate`);e.map(t),r(),n()})}}var ei=!1;function ti(){ei=!0}function ni(){ei=!1}var ri=null;function ii(e){if(ie&&F.observeMutations){var t=e.treeCallback,n=t===void 0?Hr:t,r=e.nodeCallback,i=r===void 0?Hr:r,a=e.pseudoElementsCallback,o=a===void 0?Hr:a,s=e.observeMutationsRoot,c=s===void 0?j:s;ri=new ie(function(e){if(!ei){var t=B();mn(e).forEach(function(e){if(e.type===`childList`&&e.addedNodes.length>0&&!Ur(e.addedNodes[0])&&(F.searchPseudoElements&&o(e.target),n(e.target)),e.type===`attributes`&&e.target.parentNode&&F.searchPseudoElements&&o([e.target],!0),e.type===`attributes`&&Ur(e.target)&&~en.indexOf(e.attributeName)){if(e.attributeName===`class`&&Wr(e.target)){var r=cr(hn(e.target)),a=r.prefix,s=r.iconName;e.target.setAttribute(It,a||t),s&&e.target.setAttribute(Lt,s)}else Gr(e.target)&&i(e.target)}})}}),M&&ri.observe(c,{childList:!0,attributes:!0,characterData:!0,subtree:!0})}}function ai(){ri&&ri.disconnect()}function oi(e){var t=e.getAttribute(`style`),n=[];return t&&(n=t.split(`;`).reduce(function(e,t){var n=t.split(`:`),r=n[0],i=n.slice(1);return r&&i.length>0&&(e[r]=i.join(`:`).trim()),e},{})),n}function si(e){var t=e.getAttribute(`data-prefix`),n=e.getAttribute(`data-icon`),r=e.innerText===void 0?``:e.innerText.trim(),i=cr(hn(e));return i.prefix||=B(),t&&n&&(i.prefix=t,i.iconName=n),i.iconName&&i.prefix?i:(i.prefix&&r.length>0&&(i.iconName=Qn(i.prefix,e.innerText)||Zn(i.prefix,Fn(e.innerText))),!i.iconName&&F.autoFetchSvg&&e.firstChild&&e.firstChild.nodeType===Node.TEXT_NODE&&(i.iconName=e.firstChild.data),i)}function ci(e){return mn(e.attributes).reduce(function(e,t){return e.name!==`class`&&e.name!==`style`&&(e[t.name]=t.value),e},{})}function li(){return{iconName:null,prefix:null,transform:L,symbol:!1,mask:{iconName:null,prefix:null,rest:[]},maskId:null,extra:{classes:[],styles:{},attributes:{}}}}function ui(e){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{styleParser:!0},n=si(e),r=n.iconName,i=n.prefix,a=n.rest,o=ci(e),s=yr(`parseNodeAttributes`,{},e);return b({iconName:r,prefix:i,transform:L,mask:{iconName:null,prefix:null,rest:[]},maskId:null,symbol:!1,extra:{classes:a,styles:t.styleParser?oi(e):[],attributes:o}},s)}var di=z.styles;function fi(e){var t=F.autoReplaceSvg===`nest`?ui(e,{styleParser:!1}):ui(e);return~t.extra.classes.indexOf(Qt)?V(`generateLayersText`,e,t):V(`generateSvgReplacementMutation`,e,t)}function pi(){return[].concat(S(dt),S(wt))}function mi(e){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:null;if(!M)return Promise.resolve();var n=j.documentElement.classList,r=function(e){return n.add(`${Rt}-${e}`)},i=function(e){return n.remove(`${Rt}-${e}`)},a=F.autoFetchSvg?pi():fe.concat(Object.keys(di));a.includes(`fa`)||a.push(`fa`);var o=[`.${Qt}:not([${Nt}])`].concat(a.map(function(e){return`.${e}:not([${Nt}])`})).join(`, `);if(o.length===0)return Promise.resolve();var s=[];try{s=mn(e.querySelectorAll(o))}catch{}if(s.length>0)r(`pending`),i(`complete`);else return Promise.resolve();var c=Vr.begin(`onTree`),l=s.reduce(function(e,t){try{var n=fi(t);n&&e.push(n)}catch(e){Ht||e.name===`MissingIcon`&&console.error(e)}return e},[]);return new Promise(function(e,n){Promise.all(l).then(function(n){$r(n,function(){r(`active`),r(`complete`),i(`pending`),typeof t==`function`&&t(),c(),e()})}).catch(function(e){c(),n(e)})})}function hi(e){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:null;fi(e).then(function(e){e&&$r([e],t)})}function gi(e){return function(t){var n=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},r=(t||{}).icon?t:xr(t||{}),i=n.mask;return i&&=(i||{}).icon?i:xr(i||{}),e(r,b(b({},n),{},{mask:i}))}}var _i=function(e){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},n=t.transform,r=n===void 0?L:n,i=t.symbol,a=i!==void 0&&i,o=t.mask,s=o===void 0?null:o,c=t.maskId,l=c===void 0?null:c,u=t.classes,d=u===void 0?[]:u,f=t.attributes,p=f===void 0?{}:f,m=t.styles,h=m===void 0?{}:m;if(e){var g=e.prefix,_=e.iconName,v=e.icon;return wr(b({type:`icon`},e),function(){return br(`beforeDOMElementCreation`,{iconDefinition:e,params:t}),Or({icons:{main:Mr(v),mask:s?Mr(s.icon):{found:!1,width:null,height:null,icon:{}}},prefix:g,iconName:_,transform:b(b({},L),r),symbol:a,maskId:l,extra:{attributes:p,styles:h,classes:d}})})}},vi={mixout:function(){return{icon:gi(_i)}},hooks:function(){return{mutationObserverCallbacks:function(e){return e.treeCallback=mi,e.nodeCallback=hi,e}}},provides:function(e){e.i2svg=function(e){var t=e.node,n=t===void 0?j:t,r=e.callback;return mi(n,r===void 0?function(){}:r)},e.generateSvgReplacementMutation=function(e,t){var n=t.iconName,r=t.prefix,i=t.transform,a=t.symbol,o=t.mask,s=t.maskId,c=t.extra;return new Promise(function(t,l){Promise.all([Fr(n,r),o.iconName?Fr(o.iconName,o.prefix):Promise.resolve({found:!1,width:512,height:512,icon:{}})]).then(function(o){var l=x(o,2),u=l[0],d=l[1];t([e,Or({icons:{main:u,mask:d},prefix:r,iconName:n,transform:i,symbol:a,maskId:s,extra:c,watchable:!0})])}).catch(l)})},e.generateAbstractIcon=function(e){var t=e.children,n=e.attributes,r=e.main,i=e.transform,a=e.styles,o=vn(a);o.length>0&&(n.style=o);var s;return yn(i)&&(s=V(`generateAbstractTransformGrouping`,{main:r,transform:i,containerWidth:r.width,iconWidth:r.width})),t.push(s||r.icon),{children:t,attributes:n}}}},yi={mixout:function(){return{layer:function(e){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},n=t.classes,r=n===void 0?[]:n;return wr({type:`layer`},function(){br(`beforeDOMElementCreation`,{assembler:e,params:t});var n=[];return e(function(e){Array.isArray(e)?e.map(function(e){n=n.concat(e.abstract)}):n=n.concat(e.abstract)}),[{tag:`span`,attributes:{class:[`${F.cssPrefix}-layers`].concat(S(r)).join(` `)},children:n}]})}}}},bi={mixout:function(){return{counter:function(e){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},n=t.title,r=n===void 0?null:n,i=t.classes,a=i===void 0?[]:i,o=t.attributes,s=o===void 0?{}:o,c=t.styles,l=c===void 0?{}:c;return wr({type:`counter`,content:e},function(){return br(`beforeDOMElementCreation`,{content:e,params:t}),Ar({content:e.toString(),title:r,extra:{attributes:s,styles:l,classes:[`${F.cssPrefix}-layers-counter`].concat(S(a))}})})}}}},xi={mixout:function(){return{text:function(e){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},n=t.transform,r=n===void 0?L:n,i=t.classes,a=i===void 0?[]:i,o=t.attributes,s=o===void 0?{}:o,c=t.styles,l=c===void 0?{}:c;return wr({type:`text`,content:e},function(){return br(`beforeDOMElementCreation`,{content:e,params:t}),kr({content:e,transform:b(b({},L),r),extra:{attributes:s,styles:l,classes:[`${F.cssPrefix}-layers-text`].concat(S(a))}})})}}},provides:function(e){e.generateLayersText=function(e,t){var n=t.transform,r=t.extra,i=null,a=null;if(oe){var o=parseInt(getComputedStyle(e).fontSize,10),s=e.getBoundingClientRect();i=s.width/o,a=s.height/o}return Promise.resolve([e,kr({content:e.innerHTML,width:i,height:a,transform:n,extra:r,watchable:!0})])}}},Si=RegExp(`"`,`ug`),Ci=[1105920,1112319],wi=b(b(b(b({},{FontAwesome:{normal:`fas`,400:`fas`}}),ct),kt),ht),Ti=Object.keys(wi).reduce(function(e,t){return e[t.toLowerCase()]=wi[t],e},{}),Ei=Object.keys(Ti).reduce(function(e,t){var n=Ti[t];return e[t]=n[900]||S(Object.entries(n))[0][1],e},{});function Di(e){return Fn(S(e.replace(Si,``))[0]||``)}function Oi(e){var t=e.getPropertyValue(`font-feature-settings`).includes(`ss01`),n=e.getPropertyValue(`content`).replace(Si,``),r=n.codePointAt(0),i=r>=Ci[0]&&r<=Ci[1],a=n.length===2&&n[0]===n[1];return i||a||t}function ki(e,t){var n=e.replace(/^['"]|['"]$/g,``).toLowerCase(),r=parseInt(t),i=isNaN(r)?`normal`:r;return(Ti[n]||{})[i]||Ei[n]}function Ai(e,t){var n=`${Ft}${t.replace(`:`,`-`)}`;return new Promise(function(r,i){if(e.getAttribute(n)!==null)return r();var a=mn(e.children).filter(function(e){return e.getAttribute(Pt)===t})[0],o=A.getComputedStyle(e,t),s=o.getPropertyValue(`font-family`),c=s.match($t),l=o.getPropertyValue(`font-weight`),u=o.getPropertyValue(`content`);if(a&&!c)return e.removeChild(a),r();if(c&&u!==`none`&&u!==``){var d=o.getPropertyValue(`content`),f=ki(s,l),p=Di(d),m=c[0].startsWith(`FontAwesome`),h=Oi(o),g=Zn(f,p),_=g;if(m){var v=tr(p);v.iconName&&v.prefix&&(g=v.iconName,f=v.prefix)}if(g&&!h&&(!a||a.getAttribute(It)!==f||a.getAttribute(Lt)!==_)){e.setAttribute(n,_),a&&e.removeChild(a);var y=li(),x=y.extra;x.attributes[Pt]=t,Fr(g,f).then(function(i){var a=Or(b(b({},y),{},{icons:{main:i,mask:nr()},prefix:f,iconName:_,extra:x,watchable:!0})),o=j.createElementNS(`http://www.w3.org/2000/svg`,`svg`);t===`::before`?e.insertBefore(o,e.firstChild):e.appendChild(o),o.outerHTML=a.map(function(e){return jn(e)}).join(`
`),e.removeAttribute(n),r()}).catch(i)}else r()}else r()})}function ji(e){return Promise.all([Ai(e,`::before`),Ai(e,`::after`)])}function Mi(e){return e.parentNode!==document.head&&!~Bt.indexOf(e.tagName.toUpperCase())&&!e.getAttribute(Pt)&&(!e.parentNode||e.parentNode.tagName!==`svg`)}var Ni=function(e){return!!e&&Vt.some(function(t){return e.includes(t)})},Pi=function(e){if(!e)return[];var t=new Set,n=e.split(/,(?![^()]*\))/).map(function(e){return e.trim()});n=n.flatMap(function(e){return e.includes(`(`)?e:e.split(`,`).map(function(e){return e.trim()})});var r=p(n),i;try{for(r.s();!(i=r.n()).done;){var a=i.value;if(Ni(a)){var o=Vt.reduce(function(e,t){return e.replace(t,``)},a);o!==``&&o!==`*`&&t.add(o)}}}catch(e){r.e(e)}finally{r.f()}return t};function Fi(e){var t=arguments.length>1&&arguments[1]!==void 0&&arguments[1];if(M){var n;if(t)n=e;else if(F.searchPseudoElementsFullScan)n=e.querySelectorAll(`*`);else{var r=new Set,i=p(document.styleSheets),a;try{for(i.s();!(a=i.n()).done;){var o=a.value;try{var s=p(o.cssRules),c;try{for(s.s();!(c=s.n()).done;){var l=c.value,u=p(Pi(l.selectorText)),d;try{for(u.s();!(d=u.n()).done;){var f=d.value;r.add(f)}}catch(e){u.e(e)}finally{u.f()}}}catch(e){s.e(e)}finally{s.f()}}catch(e){F.searchPseudoElementsWarnings&&console.warn(`Font Awesome: cannot parse stylesheet: ${o.href} (${e.message})
If it declares any Font Awesome CSS pseudo-elements, they will not be rendered as SVG icons. Add crossorigin="anonymous" to the <link>, enable searchPseudoElementsFullScan for slower but more thorough DOM parsing, or suppress this warning by setting searchPseudoElementsWarnings to false.`)}}}catch(e){i.e(e)}finally{i.f()}if(!r.size)return;var m=Array.from(r).join(`, `);try{n=e.querySelectorAll(m)}catch{}}return new Promise(function(e,t){var r=mn(n).filter(Mi).map(ji),i=Vr.begin(`searchPseudoElements`);ti(),Promise.all(r).then(function(){i(),ni(),e()}).catch(function(){i(),ni(),t()})})}}var Ii={hooks:function(){return{mutationObserverCallbacks:function(e){return e.pseudoElementsCallback=Fi,e}}},provides:function(e){e.pseudoElements2svg=function(e){var t=e.node,n=t===void 0?j:t;F.searchPseudoElements&&Fi(n)}}},Li=!1,Ri={mixout:function(){return{dom:{unwatch:function(){ti(),Li=!0}}}},hooks:function(){return{bootstrap:function(){ii(yr(`mutationObserverCallbacks`,{}))},noAuto:function(){ai()},watch:function(e){var t=e.observeMutationsRoot;Li?ni():ii(yr(`mutationObserverCallbacks`,{observeMutationsRoot:t}))}}}},zi=function(e){return e.toLowerCase().split(` `).reduce(function(e,t){var n=t.toLowerCase().split(`-`),r=n[0],i=n.slice(1).join(`-`);if(r&&i===`h`)return e.flipX=!0,e;if(r&&i===`v`)return e.flipY=!0,e;if(i=parseFloat(i),isNaN(i))return e;switch(r){case`grow`:e.size+=i;break;case`shrink`:e.size-=i;break;case`left`:e.x-=i;break;case`right`:e.x+=i;break;case`up`:e.y-=i;break;case`down`:e.y+=i;break;case`rotate`:e.rotate+=i}return e},{size:16,x:0,y:0,flipX:!1,flipY:!1,rotate:0})},Bi={mixout:function(){return{parse:{transform:function(e){return zi(e)}}}},hooks:function(){return{parseNodeAttributes:function(e,t){var n=t.getAttribute(`data-fa-transform`);return n&&(e.transform=zi(n)),e}}},provides:function(e){e.generateAbstractTransformGrouping=function(e){var t=e.main,n=e.transform,r=e.containerWidth,i=e.iconWidth,a={outer:{transform:`translate(${r/2} 256)`},inner:{transform:`${`translate(${n.x*32}, ${n.y*32}) `} ${`scale(${n.size/16*(n.flipX?-1:1)}, ${n.size/16*(n.flipY?-1:1)}) `} ${`rotate(${n.rotate} 0 0)`}`},path:{transform:`translate(${i/2*-1} -256)`}};return{tag:`g`,attributes:b({},a.outer),children:[{tag:`g`,attributes:b({},a.inner),children:[{tag:t.icon.tag,children:t.icon.children,attributes:b(b({},t.icon.attributes),a.path)}]}]}}}},Vi={x:0,y:0,width:`100%`,height:`100%`};function Hi(e){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:!0;return e.attributes&&(e.attributes.fill||t)&&(e.attributes.fill=`black`),e}function Ui(e){return e.tag===`g`?e.children:[e]}vr([En,vi,yi,bi,xi,Ii,Ri,Bi,{hooks:function(){return{parseNodeAttributes:function(e,t){var n=t.getAttribute(`data-fa-mask`),r=n?cr(n.split(` `).map(function(e){return e.trim()})):nr();return r.prefix||=B(),e.mask=r,e.maskId=t.getAttribute(`data-fa-mask-id`),e}}},provides:function(e){e.generateAbstractMask=function(e){var t=e.children,n=e.attributes,r=e.main,i=e.mask,a=e.maskId,o=e.transform,s=r.width,c=r.icon,l=i.width,u=i.icon,d=bn({transform:o,containerWidth:l,iconWidth:s}),f={tag:`rect`,attributes:b(b({},Vi),{},{fill:`white`})},p=c.children?{children:c.children.map(Hi)}:{},m={tag:`g`,attributes:b({},d.inner),children:[Hi(b({tag:c.tag,attributes:b(b({},c.attributes),d.path)},p))]},h={tag:`g`,attributes:b({},d.outer),children:[m]},g=`mask-${a||pn()}`,_=`clip-${a||pn()}`,v={tag:`mask`,attributes:b(b({},Vi),{},{id:g,maskUnits:`userSpaceOnUse`,maskContentUnits:`userSpaceOnUse`}),children:[f,h]},y={tag:`defs`,children:[{tag:`clipPath`,attributes:{id:_},children:Ui(u)},v]};return t.push(y,{tag:`rect`,attributes:b({fill:`currentColor`,"clip-path":`url(#${_})`,mask:`url(#${g})`},Vi)}),{children:t,attributes:n}}}},{provides:function(e){var t=!1;A.matchMedia&&(t=A.matchMedia(`(prefers-reduced-motion: reduce)`).matches),e.missingIconAbstract=function(){var e=[],n={fill:`currentColor`},r={attributeType:`XML`,repeatCount:`indefinite`,dur:`2s`};e.push({tag:`path`,attributes:b(b({},n),{},{d:`M156.5,447.7l-12.6,29.5c-18.7-9.5-35.9-21.2-51.5-34.9l22.7-22.7C127.6,430.5,141.5,440,156.5,447.7z M40.6,272H8.5 c1.4,21.2,5.4,41.7,11.7,61.1L50,321.2C45.1,305.5,41.8,289,40.6,272z M40.6,240c1.4-18.8,5.2-37,11.1-54.1l-29.5-12.6 C14.7,194.3,10,216.7,8.5,240H40.6z M64.3,156.5c7.8-14.9,17.2-28.8,28.1-41.5L69.7,92.3c-13.7,15.6-25.5,32.8-34.9,51.5 L64.3,156.5z M397,419.6c-13.9,12-29.4,22.3-46.1,30.4l11.9,29.8c20.7-9.9,39.8-22.6,56.9-37.6L397,419.6z M115,92.4 c13.9-12,29.4-22.3,46.1-30.4l-11.9-29.8c-20.7,9.9-39.8,22.6-56.8,37.6L115,92.4z M447.7,355.5c-7.8,14.9-17.2,28.8-28.1,41.5 l22.7,22.7c13.7-15.6,25.5-32.9,34.9-51.5L447.7,355.5z M471.4,272c-1.4,18.8-5.2,37-11.1,54.1l29.5,12.6 c7.5-21.1,12.2-43.5,13.6-66.8H471.4z M321.2,462c-15.7,5-32.2,8.2-49.2,9.4v32.1c21.2-1.4,41.7-5.4,61.1-11.7L321.2,462z M240,471.4c-18.8-1.4-37-5.2-54.1-11.1l-12.6,29.5c21.1,7.5,43.5,12.2,66.8,13.6V471.4z M462,190.8c5,15.7,8.2,32.2,9.4,49.2h32.1 c-1.4-21.2-5.4-41.7-11.7-61.1L462,190.8z M92.4,397c-12-13.9-22.3-29.4-30.4-46.1l-29.8,11.9c9.9,20.7,22.6,39.8,37.6,56.9 L92.4,397z M272,40.6c18.8,1.4,36.9,5.2,54.1,11.1l12.6-29.5C317.7,14.7,295.3,10,272,8.5V40.6z M190.8,50 c15.7-5,32.2-8.2,49.2-9.4V8.5c-21.2,1.4-41.7,5.4-61.1,11.7L190.8,50z M442.3,92.3L419.6,115c12,13.9,22.3,29.4,30.5,46.1 l29.8-11.9C470,128.5,457.3,109.4,442.3,92.3z M397,92.4l22.7-22.7c-15.6-13.7-32.8-25.5-51.5-34.9l-12.6,29.5 C370.4,72.1,384.4,81.5,397,92.4z`})});var i=b(b({},r),{},{attributeName:`opacity`}),a={tag:`circle`,attributes:b(b({},n),{},{cx:`256`,cy:`364`,r:`28`}),children:[]};return t||a.children.push({tag:`animate`,attributes:b(b({},r),{},{attributeName:`r`,values:`28;14;28;28;14;28;`})},{tag:`animate`,attributes:b(b({},i),{},{values:`1;0;1;1;0;1;`})}),e.push(a),e.push({tag:`path`,attributes:b(b({},n),{},{opacity:`1`,d:`M263.7,312h-16c-6.6,0-12-5.4-12-12c0-71,77.4-63.9,77.4-107.8c0-20-17.8-40.2-57.4-40.2c-29.1,0-44.3,9.6-59.2,28.7 c-3.9,5-11.1,6-16.2,2.4l-13.1-9.2c-5.6-3.9-6.9-11.8-2.6-17.2c21.2-27.2,46.4-44.7,91.2-44.7c52.3,0,97.4,29.8,97.4,80.2 c0,67.6-77.4,63.5-77.4,107.8C275.7,306.6,270.3,312,263.7,312z`}),children:t?[]:[{tag:`animate`,attributes:b(b({},i),{},{values:`1;0;0;0;0;1;`})}]}),t||e.push({tag:`path`,attributes:b(b({},n),{},{opacity:`0`,d:`M232.5,134.5l7,168c0.3,6.4,5.6,11.5,12,11.5h9c6.4,0,11.7-5.1,12-11.5l7-168c0.3-6.8-5.2-12.5-12-12.5h-23 C237.7,122,232.2,127.7,232.5,134.5z`}),children:[{tag:`animate`,attributes:b(b({},i),{},{values:`0;0;1;1;0;0;`})}]}),{tag:`g`,attributes:{class:`missing`},children:e}}}},{hooks:function(){return{parseNodeAttributes:function(e,t){var n=t.getAttribute(`data-fa-symbol`);return e.symbol=n===null?!1:n===``||n,e}}}}],{mixoutsTo:H}),H.noAuto;var Wi=H.config;H.library,H.dom;var Gi=H.parse;H.findIconDefinition,H.toHtml;var Ki=H.icon;H.layer,H.text,H.counter;var qi=/^(?:[a-z][a-z0-9+.-]*:|[\\/]{2})/i,Ji=/^[\\/]{2}/;function Yi(e,t){return t+e.replace(/\\/g,`/`)}var Xi=`popstate`;function Zi(e){return typeof e==`object`&&!!e&&`pathname`in e&&`search`in e&&`hash`in e&&`state`in e&&`key`in e}function Qi(e={}){function t(e,t){let n=t.state?.masked,{pathname:r,search:i,hash:a}=n||e.location;return ta(``,{pathname:r,search:i,hash:a},t.state&&t.state.usr||null,t.state&&t.state.key||`default`,n?{pathname:e.location.pathname,search:e.location.search,hash:e.location.hash}:void 0)}function n(e,t){return typeof t==`string`?t:na(t)}return ia(t,n,null,e)}function U(e,t){if(e===!1||e==null)throw Error(t)}function W(e,t){if(!e){typeof console<`u`&&console.warn(t);try{throw Error(t)}catch{}}}function $i(){return Math.random().toString(36).substring(2,10)}function ea(e,t){return{usr:e.state,key:e.key,idx:t,masked:e.mask?{pathname:e.pathname,search:e.search,hash:e.hash}:void 0}}function ta(e,t,n=null,r,i){return{pathname:typeof e==`string`?e:e.pathname,search:``,hash:``,...typeof t==`string`?ra(t):t,state:n,key:t&&t.key||r||$i(),mask:i}}function na({pathname:e=`/`,search:t=``,hash:n=``}){return t&&t!==`?`&&(e+=t.charAt(0)===`?`?t:`?`+t),n&&n!==`#`&&(e+=n.charAt(0)===`#`?n:`#`+n),e}function ra(e){let t={};if(e){let n=e.indexOf(`#`);n>=0&&(t.hash=e.substring(n),e=e.substring(0,n));let r=e.indexOf(`?`);r>=0&&(t.search=e.substring(r),e=e.substring(0,r)),e&&(t.pathname=e)}return t}function ia(e,t,n,r={}){let{window:i=document.defaultView,v5Compat:a=!1}=r,o=i.history,s=`POP`,c=null,l=u();l??(l=0,o.replaceState({...o.state,idx:l},``));function u(){return(o.state||{idx:null}).idx}function d(){s=`POP`;let e=u(),t=e==null?null:e-l;l=e,c&&c({action:s,location:h.location,delta:t})}function f(e,t){s=`PUSH`;let r=Zi(e)?e:ta(h.location,e,t);n&&n(r,e),l=u()+1;let d=ea(r,l),f=h.createHref(r.mask||r);try{o.pushState(d,``,f)}catch(e){if(e instanceof DOMException&&e.name===`DataCloneError`)throw e;i.location.assign(f)}a&&c&&c({action:s,location:h.location,delta:1})}function p(e,t){s=`REPLACE`;let r=Zi(e)?e:ta(h.location,e,t);n&&n(r,e),l=u();let i=ea(r,l),d=h.createHref(r.mask||r);o.replaceState(i,``,d),a&&c&&c({action:s,location:h.location,delta:0})}function m(e){return aa(i,e)}let h={get action(){return s},get location(){return e(i,o)},listen(e){if(c)throw Error(`A history only accepts one active listener`);return i.addEventListener(Xi,d),c=e,()=>{i.removeEventListener(Xi,d),c=null}},createHref(e){return t(i,e)},createURL:m,encodeLocation(e){let t=m(e);return{pathname:t.pathname,search:t.search,hash:t.hash}},push:f,replace:p,go(e){return o.go(e)}};return h}function aa(e,t,n=!1){let r=`http://localhost`;e&&(r=e.location.origin===`null`?e.location.href:e.location.origin),U(r,`No window.location.(origin|href) available to create URL`);let i=typeof t==`string`?t:na(t);return i=i.replace(/ $/,`%20`),!n&&Ji.test(i)&&(i=r+i),new URL(i,r)}function oa(e,t,n=`/`){return sa(e,t,n,!1)}function sa(e,t,n,r,i){let a=G((typeof t==`string`?ra(t):t).pathname||`/`,n);if(a==null)return null;let o=i??ca(e),s=null,c=Ta(a);for(let e=0;s==null&&e<o.length;++e)s=xa(o[e],c,r);return s}function ca(e){let t=la(e);return da(t),t}function la(e,t=[],n=[],r=``,i=!1){let a=(e,a,o=i,s)=>{let c={relativePath:s===void 0?e.path||``:s,caseSensitive:e.caseSensitive===!0,childrenIndex:a,route:e};if(c.relativePath.startsWith(`/`)){if(!c.relativePath.startsWith(r)&&o)return;U(c.relativePath.startsWith(r),`Absolute route path "${c.relativePath}" nested under path "${r}" is not valid. An absolute child route path must start with the combined path of all its parent routes.`),c.relativePath=c.relativePath.slice(r.length)}let l=K([r,c.relativePath]),u=n.concat(c);e.children&&e.children.length>0&&(U(e.index!==!0,`Index routes must not have child routes. Please remove all child routes from route path "${l}".`),la(e.children,t,u,l,o)),(e.path!=null||e.index)&&t.push({path:l,score:ya(l,e.index),routesMeta:u.map((e,t)=>{let[n,r]=wa(e.relativePath,e.caseSensitive,t===u.length-1);return{...e,matcher:n,compiledParams:r}})})};return e.forEach((e,t)=>{if(e.path===``||!e.path?.includes(`?`))a(e,t);else for(let n of ua(e.path))a(e,t,!0,n)}),t}function ua(e){let t=e.split(`/`);if(t.length===0)return[];let[n,...r]=t,i=n.endsWith(`?`),a=n.replace(/\?$/,``);if(r.length===0)return i?[a,``]:[a];let o=ua(r.join(`/`)),s=[];return s.push(...o.map(e=>e===``?a:[a,e].join(`/`))),i&&s.push(...o),s.map(t=>e.startsWith(`/`)&&t===``?`/`:t)}function da(e){e.sort((e,t)=>e.score===t.score?ba(e.routesMeta.map(e=>e.childrenIndex),t.routesMeta.map(e=>e.childrenIndex)):t.score-e.score)}var fa=/^:[\w-]+$/,pa=3,ma=2,ha=1,ga=10,_a=-2,va=e=>e===`*`;function ya(e,t){let n=e.split(`/`),r=n.length;return n.some(va)&&(r+=_a),t&&(r+=ma),n.filter(e=>!va(e)).reduce((e,t)=>e+(fa.test(t)?pa:t===``?ha:ga),r)}function ba(e,t){return e.length===t.length&&e.slice(0,-1).every((e,n)=>e===t[n])?e[e.length-1]-t[t.length-1]:0}function xa(e,t,n=!1){let{routesMeta:r}=e,i={},a=`/`,o=[];for(let e=0;e<r.length;++e){let s=r[e],c=e===r.length-1,l=a===`/`?t:t.slice(a.length)||`/`,u={path:s.relativePath,caseSensitive:s.caseSensitive,end:c},d=s.matcher&&s.compiledParams?Ca(u,l,s.matcher,s.compiledParams):Sa(u,l),f=s.route;if(!d&&c&&n&&!r[r.length-1].route.index&&(d=Sa({path:s.relativePath,caseSensitive:s.caseSensitive,end:!1},l)),!d)return null;Object.assign(i,d.params),o.push({params:i,pathname:K([a,d.pathname]),pathnameBase:Pa(K([a,d.pathnameBase])),route:f}),d.pathnameBase!==`/`&&(a=K([a,d.pathnameBase]))}return o}function Sa(e,t){typeof e==`string`&&(e={path:e,caseSensitive:!1,end:!0});let[n,r]=wa(e.path,e.caseSensitive,e.end);return Ca(e,t,n,r)}function Ca(e,t,n,r){let i=t.match(n);if(!i)return null;let a=i[0],o=Na(a,1),s=i.slice(1);return{params:r.reduce((e,{paramName:t,isOptional:n},r)=>{if(t===`*`){let e=s[r]||``;o=Na(a.slice(0,a.length-e.length),1)}let i=s[r];return e[t]=n&&!i?void 0:(i||``).replace(/%2F/g,`/`),e},{}),pathname:a,pathnameBase:o,pattern:e}}function wa(e,t=!1,n=!0){W(e===`*`||!e.endsWith(`*`)||e.endsWith(`/*`),`Route path "${e}" will be treated as if it were "${e.replace(/\*$/,`/*`)}" because the \`*\` character must always follow a \`/\` in the pattern. To get rid of this warning, please change the route path to "${e.replace(/\*$/,`/*`)}".`);let r=[],i=`^`+e.replace(/\/*\*?$/,``).replace(/^\/*/,`/`).replace(/[\\.*+^${}|()[\]]/g,`\\$&`).replace(/\/:([\w-]+)(\?)?/g,(e,t,n,i,a)=>{if(r.push({paramName:t,isOptional:n!=null}),n){let t=a.charAt(i+e.length);return t&&t!==`/`?`/([^\\/]*)`:`(?:/([^\\/]*))?`}return`/([^\\/]+)`}).replace(/\/([\w-]+)\?(\/|$)/g,`(/$1)?$2`);return e.endsWith(`*`)?(r.push({paramName:`*`}),i+=e===`*`||e===`/*`?`(.*)$`:`(?:\\/(.+)|\\/*)$`):n?i+=`\\/*$`:e!==``&&e!==`/`&&(i+=`(?:(?=\\/|$))`),[new RegExp(i,t?void 0:`i`),r]}function Ta(e){try{return e.split(`/`).map(e=>decodeURIComponent(e).replace(/\//g,`%2F`)).join(`/`)}catch(t){return W(!1,`The URL path "${e}" could not be decoded because it is a malformed URL segment. This is probably due to a bad percent encoding (${t}).`),e}}function G(e,t){if(t===`/`)return e;if(!e.toLowerCase().startsWith(t.toLowerCase()))return null;let n=t.endsWith(`/`)?t.length-1:t.length,r=e.charAt(n);return r&&r!==`/`?null:e.slice(n)||`/`}function Ea(e,t=`/`){let{pathname:n,search:r=``,hash:i=``}=typeof e==`string`?ra(e):e,a;return n?(n=Ma(n),a=n.startsWith(`/`)||n.startsWith(`\\`)?Da(n.substring(1),`/`):Da(n,t)):a=t,{pathname:a,search:Fa(r),hash:Ia(i)}}function Da(e,t){let n=Na(t).split(`/`);return e.split(`/`).forEach(e=>{e===`..`?n.length>1&&n.pop():e!==`.`&&n.push(e)}),n.length>1?n.join(`/`):`/`}function Oa(e,t,n,r){return`Cannot include a '${e}' character in a manually specified \`to.${t}\` field [${JSON.stringify(r)}].  Please separate it out to the \`to.${n}\` field. Alternatively you may provide the full path as a string in <Link to="..."> and the router will parse it for you.`}function ka(e){return e.filter((e,t)=>t===0||e.route.path&&e.route.path.length>0)}function Aa(e){let t=ka(e);return t.map((e,n)=>n===t.length-1?e.pathname:e.pathnameBase)}function ja(e,t,n,r=!1){let i;typeof e==`string`?i=ra(e):(i={...e},U(!i.pathname||!i.pathname.includes(`?`),Oa(`?`,`pathname`,`search`,i)),U(!i.pathname||!i.pathname.includes(`#`),Oa(`#`,`pathname`,`hash`,i)),U(!i.search||!i.search.includes(`#`),Oa(`#`,`search`,`hash`,i)));let a=e===``||i.pathname===``,o=a?`/`:i.pathname,s;if(o==null)s=n;else{let e=t.length-1;if(!r&&o.startsWith(`..`)){let t=o.split(`/`);for(;t[0]===`..`;)t.shift(),--e;i.pathname=t.join(`/`)}s=e>=0?t[e]:`/`}let c=Ea(i,s),l=o&&o!==`/`&&o.endsWith(`/`),u=(a||o===`.`)&&n.endsWith(`/`);return!c.pathname.endsWith(`/`)&&(l||u)&&(c.pathname+=`/`),c}var Ma=e=>e.replace(/[\\/]{2,}/g,`/`),K=e=>Ma(e.join(`/`));function Na(e,t=0){let n=e.length;for(;n>t&&e.charCodeAt(n-1)===47;)n--;return n===e.length?e:e.slice(0,n)}var Pa=e=>Na(e).replace(/^\/*/,`/`),Fa=e=>!e||e===`?`?``:e.startsWith(`?`)?e:`?`+e,Ia=e=>!e||e===`#`?``:e.startsWith(`#`)?e:`#`+e,La=class{constructor(e,t,n,r=!1){this.status=e,this.statusText=t||``,this.internal=r,n instanceof Error?(this.data=n.toString(),this.error=n):this.data=n}};function Ra(e){return e!=null&&typeof e.status==`number`&&typeof e.statusText==`string`&&typeof e.internal==`boolean`&&`data`in e}function za(e){return K(e.map(e=>e.route.path).filter(Boolean))||`/`}var Ba=typeof window<`u`&&window.document!==void 0&&window.document.createElement!==void 0;function Va(e,t){let n=e;if(typeof n!=`string`||!qi.test(n))return{absoluteURL:void 0,isExternal:!1,to:n};let r=n,i=!1;if(Ba)try{let e=new URL(window.location.href),r=Ji.test(n)?new URL(Yi(n,e.protocol)):new URL(n),a=G(r.pathname,t);r.origin===e.origin&&a!=null?n=a+r.search+r.hash:i=!0}catch{W(!1,`<Link to="${n}"> contains an invalid URL which will probably break when clicked - please update to a valid URL path.`)}return{absoluteURL:r,isExternal:i,to:n}}Object.getOwnPropertyNames(Object.prototype).sort().join(`\0`);var Ha=new URL(`http://localhost`);function Ua(e){if(e.createURL)return e.createURL(`/`);try{return new URL(e.createHref(`/`),Ha)}catch{return Ha}}function Wa(e,t){return e.origin===t.origin&&(e.origin!==`null`||e.protocol===t.protocol&&e.host===t.host)}function Ga(e,t){if(e.startsWith(`//`))return!0;let n=t.protocol.toLowerCase();return e.toLowerCase().startsWith(n)?t.host===``||e.slice(n.length).startsWith(`//`):!1}function Ka(e,t,n,r){let i=null;try{i=e==null?null:new URL(e,n)}catch{}let a=new URL(t,n),o=i!=null&&!Wa(i,n),s=!Wa(a,n);if(r===`reject`){if(o||s)throw Error(`External navigation is not allowed`)}else if(s&&(i==null||!Ga(e,i)||!Wa(i,a)))throw Error(`External navigation is not allowed`)}var qa=[`POST`,`PUT`,`PATCH`,`DELETE`];new Set(qa);var Ja=[`GET`,...qa];new Set(Ja);var Ya=[`about:`,`blob:`,`chrome:`,`chrome-untrusted:`,`content:`,`data:`,`devtools:`,`file:`,`filesystem:`,`javascript:`];function Xa(e){try{return Ya.includes(new URL(e).protocol)}catch{return!1}}var Za=o.createContext(null);Za.displayName=`DataRouter`;var Qa=o.createContext(null);Qa.displayName=`DataRouterState`;var $a=o.createContext(!1);function eo(){return o.useContext($a)}var to=o.createContext({isTransitioning:!1});to.displayName=`ViewTransition`;var no=o.createContext(new Map);no.displayName=`Fetchers`;var ro=o.createContext(null);ro.displayName=`Await`;var q=o.createContext(null);q.displayName=`Navigation`;var io=o.createContext(null);io.displayName=`Location`;var J=o.createContext({outlet:null,matches:[],isDataRoute:!1});J.displayName=`Route`;var ao=o.createContext(null);ao.displayName=`RouteError`;var oo=`REACT_ROUTER_ERROR`,so=`REDIRECT`,co=`ROUTE_ERROR_RESPONSE`;function lo(e){if(e.startsWith(`${oo}:${so}:{`))try{let t=JSON.parse(e.slice(28));if(typeof t==`object`&&t&&typeof t.status==`number`&&typeof t.statusText==`string`&&typeof t.location==`string`&&typeof t.reloadDocument==`boolean`&&typeof t.replace==`boolean`)return t}catch{}}function uo(e){if(e.startsWith(`${oo}:${co}:{`))try{let t=JSON.parse(e.slice(40));if(typeof t==`object`&&t&&typeof t.status==`number`&&typeof t.statusText==`string`)return new La(t.status,t.statusText,t.data)}catch{}}function fo(e,{relative:t}={}){U(po(),`useHref() may be used only in the context of a <Router> component.`);let{basename:n,navigator:r}=o.useContext(q),{hash:i,pathname:a,search:s}=Co(e,{relative:t}),c=a;return n!==`/`&&(c=a===`/`?n:K([n,a])),r.createHref({pathname:c,search:s,hash:i})}function po(){return o.useContext(io)!=null}function Y(){return U(po(),`useLocation() may be used only in the context of a <Router> component.`),o.useContext(io).location}function mo(){return o.useContext(io).navigationType}var ho=`You should call navigate() in a React.useEffect(), not when your component is first rendered.`;function go(e){o.useContext(q).static||o.useLayoutEffect(e)}function _o(){let{isDataRoute:e}=o.useContext(J);return e?Bo():vo()}function vo(){U(po(),`useNavigate() may be used only in the context of a <Router> component.`);let e=o.useContext(Za),{basename:t,navigator:n}=o.useContext(q),{matches:r}=o.useContext(J),{pathname:i}=Y(),a=JSON.stringify(Aa(r)),s=o.useRef(!1);return go(()=>{s.current=!0}),o.useCallback((r,o={})=>{if(W(s.current,ho),!s.current)return;if(typeof r==`number`){n.go(r);return}let c=ja(r,JSON.parse(a),i,o.relative===`path`);e==null&&t!==`/`&&(c.pathname=c.pathname===`/`?t:K([t,c.pathname])),Ka(typeof r==`string`?r:na(r),n.createHref(c),Ua(n),`reject`),(o.replace?n.replace:n.push)(c,o.state,o)},[t,n,a,i,e])}var yo=o.createContext(null);function bo(){return o.useContext(yo)}function xo(e){let t=o.useContext(J).outlet;return o.useMemo(()=>t&&o.createElement(yo.Provider,{value:e},t),[t,e])}function So(){let{matches:e}=o.useContext(J);return e[e.length-1]?.params??{}}function Co(e,{relative:t}={}){let{matches:n}=o.useContext(J),{pathname:r}=Y(),i=JSON.stringify(Aa(n));return o.useMemo(()=>ja(e,JSON.parse(i),r,t===`path`),[e,i,r,t])}function wo(e,t){return To(e,t)}function To(e,t,n){U(po(),`useRoutes() may be used only in the context of a <Router> component.`);let{navigator:r}=o.useContext(q),{matches:i}=o.useContext(J),a=i[i.length-1],s=a?a.params:{},c=a?a.pathname:`/`,l=a?a.pathnameBase:`/`,u=a&&a.route;{let e=u&&u.path||``;Ho(c,!u||e.endsWith(`*`)||e.endsWith(`*?`),`You rendered descendant <Routes> (or called \`useRoutes()\`) at "${c}" (under <Route path="${e}">) but the parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and therefore the child routes will never render.

Please change the parent <Route path="${e}"> to <Route path="${e===`/`?`*`:`${e}/*`}">.`)}let d=Y(),f;if(t){let e=typeof t==`string`?ra(t):t;U(l===`/`||e.pathname?.startsWith(l),`When overriding the location using \`<Routes location>\` or \`useRoutes(routes, location)\`, the location pathname must begin with the portion of the URL pathname that was matched by all parent routes. The current pathname base is "${l}" but pathname "${e.pathname}" was given in the \`location\` prop.`),f=e}else f=d;let p=f.pathname||`/`,m=p;if(l!==`/`){let e=l.replace(/^\//,``).split(`/`);m=`/`+p.replace(/^\//,``).split(`/`).slice(e.length).join(`/`)}let h=n&&n.state.matches.length?n.state.matches.map(e=>Object.assign(e,{route:n.manifest[e.route.id]||e.route})):oa(e,{pathname:m});W(u||h!=null,`No routes matched location "${f.pathname}${f.search}${f.hash}" `),W(h==null||h[h.length-1].route.element!==void 0||h[h.length-1].route.Component!==void 0||h[h.length-1].route.lazy!==void 0,`Matched leaf route at location "${f.pathname}${f.search}${f.hash}" does not have an element or Component. This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.`);let g=Mo(h&&h.map(e=>Object.assign({},e,{params:Object.assign({},s,e.params),pathname:K([l,r.encodeLocation?r.encodeLocation(e.pathname.replace(/%/g,`%25`).replace(/\?/g,`%3F`).replace(/#/g,`%23`)).pathname:e.pathname]),pathnameBase:e.pathnameBase===`/`?l:K([l,r.encodeLocation?r.encodeLocation(e.pathnameBase.replace(/%/g,`%25`).replace(/\?/g,`%3F`).replace(/#/g,`%23`)).pathname:e.pathnameBase])})),i,n);return t&&g?o.createElement(io.Provider,{value:{location:{pathname:`/`,search:``,hash:``,state:null,key:`default`,mask:void 0,...f},navigationType:`POP`}},g):g}function Eo(){let e=zo(),t=Ra(e)?`${e.status} ${e.statusText}`:e instanceof Error?e.message:JSON.stringify(e),n=e instanceof Error?e.stack:null,r=`rgba(200,200,200, 0.5)`,i={padding:`0.5rem`,backgroundColor:r},a={padding:`2px 4px`,backgroundColor:r},s=null;return console.error(`Error handled by React Router default ErrorBoundary:`,e),s=o.createElement(o.Fragment,null,o.createElement(`p`,null,`💿 Hey developer 👋`),o.createElement(`p`,null,`You can provide a way better UX than this when your app throws errors by providing your own `,o.createElement(`code`,{style:a},`ErrorBoundary`),` or`,` `,o.createElement(`code`,{style:a},`errorElement`),` prop on your route.`)),o.createElement(o.Fragment,null,o.createElement(`h2`,null,`Unexpected Application Error!`),o.createElement(`h3`,{style:{fontStyle:`italic`}},t),n?o.createElement(`pre`,{style:i},n):null,s)}var Do=o.createElement(Eo,null),Oo=class extends o.Component{constructor(e){super(e),this.state={location:e.location,revalidation:e.revalidation,error:e.error}}static getDerivedStateFromError(e){return{error:e}}static getDerivedStateFromProps(e,t){return t.location!==e.location||t.revalidation!==`idle`&&e.revalidation===`idle`?{error:e.error,location:e.location,revalidation:e.revalidation}:{error:e.error===void 0?t.error:e.error,location:t.location,revalidation:e.revalidation||t.revalidation}}componentDidCatch(e,t){this.props.onError?this.props.onError(e,t):console.error(`React Router caught the following error during render`,e)}render(){let e=this.state.error;if(this.context&&typeof e==`object`&&e&&`digest`in e&&typeof e.digest==`string`){let t=uo(e.digest);t&&(e=t)}let t=e===void 0?this.props.children:o.createElement(J.Provider,{value:this.props.routeContext},o.createElement(ao.Provider,{value:e,children:this.props.component}));return this.context?o.createElement(Ao,{error:e},t):t}};Oo.contextType=$a;var ko=new WeakMap;function Ao({children:e,error:t}){let{basename:n,navigator:r}=o.useContext(q);if(typeof t==`object`&&t&&`digest`in t&&typeof t.digest==`string`){let e=lo(t.digest);if(e){let i=ko.get(t);if(i)throw i;let a=Va(e.location,n),s=a.absoluteURL||a.to;if(Ka(e.location,s,Ua(r),`allow-explicit`),Xa(s))throw Error(`Invalid redirect location`);if(Ba&&!ko.get(t)){if(a.isExternal||e.reloadDocument)window.location.href=s;else{let n=Promise.resolve().then(()=>window.__reactRouterDataRouter.navigate(a.to,{replace:e.replace}));throw ko.set(t,n),n}}return o.createElement(`meta`,{httpEquiv:`refresh`,content:`0;url=${s}`})}}return e}function jo({routeContext:e,match:t,children:n}){let r=o.useContext(Za);return r&&r.static&&r.staticContext&&(t.route.errorElement||t.route.ErrorBoundary)&&(r.staticContext._deepestRenderedBoundaryId=t.route.id),o.createElement(J.Provider,{value:e},n)}function Mo(e,t=[],n){let r=n?.state;if(e==null){if(!r)return null;if(r.errors)e=r.matches;else if(t.length===0&&!r.initialized&&r.matches.length>0)e=r.matches;else return null}let i=e,a=r?.errors;if(a!=null){let e=i.findIndex(e=>e.route.id&&a?.[e.route.id]!==void 0);U(e>=0,`Could not find a matching route for errors on route IDs: ${Object.keys(a).join(`,`)}`),i=i.slice(0,Math.min(i.length,e+1))}let s=!1,c=-1;if(n&&r){s=r.renderFallback;for(let e=0;e<i.length;e++){let t=i[e];if((t.route.HydrateFallback||t.route.hydrateFallbackElement)&&(c=e),t.route.id){let{loaderData:e,errors:a}=r,o=t.route.loader&&!e.hasOwnProperty(t.route.id)&&(!a||a[t.route.id]===void 0);if(t.route.lazy||o){n.isStatic&&(s=!0),i=c>=0?i.slice(0,c+1):[i[0]];break}}}}let l=n?.onError,u=r&&l?(e,t)=>{l(e,{location:r.location,params:r.matches?.[0]?.params??{},pattern:za(r.matches),errorInfo:t})}:void 0;return i.reduceRight((e,n,l)=>{let d,f=!1,p=null,m=null;r&&(d=a&&n.route.id?a[n.route.id]:void 0,p=n.route.errorElement||Do,s&&(c<0&&l===0?(Ho(`route-fallback`,!1,"No `HydrateFallback` element provided to render during initial hydration"),f=!0,m=null):c===l&&(f=!0,m=n.route.hydrateFallbackElement||null)));let h=t.concat(i.slice(0,l+1)),g=()=>{let t;return t=d?p:f?m:n.route.Component?o.createElement(n.route.Component,null):n.route.element?n.route.element:e,o.createElement(jo,{match:n,routeContext:{outlet:e,matches:h,isDataRoute:r!=null},children:t})};return r&&(n.route.ErrorBoundary||n.route.errorElement||l===0)?o.createElement(Oo,{location:r.location,revalidation:r.revalidation,component:p,error:d,children:g(),routeContext:{outlet:null,matches:h,isDataRoute:!0},onError:u}):g()},null)}function No(e){return`${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`}function Po(e){let t=o.useContext(Za);return U(t,No(e)),t}function Fo(e){let t=o.useContext(Qa);return U(t,No(e)),t}function Io(e){let t=o.useContext(J);return U(t,No(e)),t}function Lo(e){let t=Io(e),n=t.matches[t.matches.length-1];return U(n.route.id,`${e} can only be used on routes that contain a unique "id"`),n.route.id}function Ro(){return Lo(`useRouteId`)}function zo(){let e=o.useContext(ao),t=Fo(`useRouteError`),n=Lo(`useRouteError`);return e===void 0?t.errors?.[n]:e}function Bo(){let{router:e}=Po(`useNavigate`),t=Lo(`useNavigate`),n=o.useRef(!1);return go(()=>{n.current=!0}),o.useCallback(async(r,i={})=>{W(n.current,ho),n.current&&(typeof r==`number`?await e.navigate(r):await e.navigate(r,{fromRouteId:t,...i}))},[e,t])}var Vo={};function Ho(e,t,n){!t&&!Vo[e]&&(Vo[e]=!0,W(!1,n))}o.memo(Uo);function Uo({routes:e,manifest:t,future:n,state:r,isStatic:i,onError:a}){return To(e,void 0,{manifest:t,state:r,isStatic:i,onError:a,future:n})}function Wo({to:e,replace:t,state:n,relative:r}){U(po(),`<Navigate> may be used only in the context of a <Router> component.`);let{static:i,navigator:a}=o.useContext(q);W(!i,`<Navigate> must not be used on the initial render in a <StaticRouter>. This is a no-op, but you should modify your code so the <Navigate> is only ever rendered in response to some user interaction or state change.`);let{matches:s}=o.useContext(J),{pathname:c}=Y(),l=_o(),u=ja(e,Aa(s),c,r===`path`);Ka(typeof e==`string`?e:na(e),a.createHref(u),Ua(a),`reject`);let d=JSON.stringify(u);return o.useEffect(()=>{l(JSON.parse(d),{replace:t,state:n,relative:r})},[l,d,r,t,n]),null}function Go(e){return xo(e.context)}function Ko(e){U(!1,`A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your <Route> in a <Routes>.`)}function qo({basename:e=`/`,children:t=null,location:n,navigationType:r=`POP`,navigator:i,static:a=!1,useTransitions:s}){U(!po(),`You cannot render a <Router> inside another <Router>. You should never have more than one in your app.`);let c=e.replace(/^\/*/,`/`),l=o.useMemo(()=>({basename:c,navigator:i,static:a,useTransitions:s,future:{}}),[c,i,a,s]);typeof n==`string`&&(n=ra(n));let{pathname:u=`/`,search:d=``,hash:f=``,state:p=null,key:m=`default`,mask:h}=n,g=o.useMemo(()=>{let e=G(u,c);return e==null?null:{location:{pathname:e,search:d,hash:f,state:p,key:m,mask:h},navigationType:r}},[c,u,d,f,p,m,r,h]);return W(g!=null,`<Router basename="${c}"> is not able to match the URL "${u}${d}${f}" because it does not start with the basename, so the <Router> won't render anything.`),g==null?null:o.createElement(q.Provider,{value:l},o.createElement(io.Provider,{children:t,value:g}))}function Jo({children:e,location:t}){return wo(Yo(e),t)}o.Component;function Yo(e,t=[]){let n=[];return o.Children.forEach(e,(e,r)=>{if(!o.isValidElement(e))return;let i=[...t,r];if(e.type===o.Fragment){n.push.apply(n,Yo(e.props.children,i));return}U(e.type===Ko,`[${typeof e.type==`string`?e.type:e.type.name}] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>`),U(!e.props.index||!e.props.children,`An index route cannot have child routes.`);let a={id:e.props.id||i.join(`-`),caseSensitive:e.props.caseSensitive,element:e.props.element,Component:e.props.Component,index:e.props.index,path:e.props.path,middleware:e.props.middleware,loader:e.props.loader,action:e.props.action,hydrateFallbackElement:e.props.hydrateFallbackElement,HydrateFallback:e.props.HydrateFallback,errorElement:e.props.errorElement,ErrorBoundary:e.props.ErrorBoundary,hasErrorBoundary:e.props.hasErrorBoundary===!0||e.props.ErrorBoundary!=null||e.props.errorElement!=null,shouldRevalidate:e.props.shouldRevalidate,handle:e.props.handle,lazy:e.props.lazy};e.props.children&&(a.children=Yo(e.props.children,i)),n.push(a)}),n}var Xo=`get`,Zo=`application/x-www-form-urlencoded`;function Qo(e){return typeof HTMLElement<`u`&&e instanceof HTMLElement}function $o(e){return Qo(e)&&e.tagName.toLowerCase()===`button`}function es(e){return Qo(e)&&e.tagName.toLowerCase()===`form`}function ts(e){return Qo(e)&&e.tagName.toLowerCase()===`input`}function ns(e){return!!(e.metaKey||e.altKey||e.ctrlKey||e.shiftKey)}function rs(e,t){return e.button===0&&(!t||t===`_self`)&&!ns(e)}function is(e=``){return new URLSearchParams(typeof e==`string`||Array.isArray(e)||e instanceof URLSearchParams?e:Object.keys(e).reduce((t,n)=>{let r=e[n];return t.concat(Array.isArray(r)?r.map(e=>[n,e]):[[n,r]])},[]))}function as(e,t){let n=is(e);return t&&t.forEach((e,r)=>{n.has(r)||t.getAll(r).forEach(e=>{n.append(r,e)})}),n}var os=null;function ss(){if(os===null)try{new FormData(document.createElement(`form`),0),os=!1}catch{os=!0}return os}var cs=new Set([`application/x-www-form-urlencoded`,`multipart/form-data`,`text/plain`]);function ls(e){return e!=null&&!cs.has(e)?(W(!1,`"${e}" is not a valid \`encType\` for \`<Form>\`/\`<fetcher.Form>\` and will default to "${Zo}"`),null):e}function us(e,t){let n,r,i,a,o;if(es(e)){let o=e.getAttribute(`action`);r=o?G(o,t):null,n=e.getAttribute(`method`)||Xo,i=ls(e.getAttribute(`enctype`))||Zo,a=new FormData(e)}else if($o(e)||ts(e)&&(e.type===`submit`||e.type===`image`)){let o=e.form;if(o==null)throw Error(`Cannot submit a <button> or <input type="submit"> without a <form>`);let s=e.getAttribute(`formaction`)||o.getAttribute(`action`);if(r=s?G(s,t):null,n=e.getAttribute(`formmethod`)||o.getAttribute(`method`)||Xo,i=ls(e.getAttribute(`formenctype`))||ls(o.getAttribute(`enctype`))||Zo,a=new FormData(o,e),!ss()){let{name:t,type:n,value:r}=e;if(n===`image`){let e=t?`${t}.`:``;a.append(`${e}x`,`0`),a.append(`${e}y`,`0`)}else t&&a.append(t,r)}}else if(Qo(e))throw Error(`Cannot submit element that is not <form>, <button>, or <input type="submit|image">`);else n=Xo,r=null,i=Zo,o=e;return a&&i===`text/plain`&&(o=a,a=void 0),{action:r,method:n.toLowerCase(),encType:i,formData:a,body:o}}Object.getOwnPropertyNames(Object.prototype).sort().join(`\0`);function ds(e,t){if(e===!1||e==null)throw Error(t)}function fs(e,t,n,r){let i=typeof e==`string`?new URL(e,typeof window>`u`?`server://singlefetch/`:window.location.origin):e;return i.pathname=n?i.pathname.endsWith(`/`)?`${i.pathname}_.${r}`:`${i.pathname}.${r}`:i.pathname===`/`?`_root.${r}`:t&&G(i.pathname,t)===`/`?`${Na(t)}/_root.${r}`:`${Na(i.pathname)}.${r}`,i}async function ps(e,t){if(e.id in t)return t[e.id];try{let n=await r(()=>import(e.module),[]);return t[e.id]=n,n}catch(t){return console.error(`Error loading route module \`${e.module}\`, reloading page...`),console.error(t),window.__reactRouterContext&&window.__reactRouterContext.isSpaMode,window.location.reload(),new Promise(()=>{})}}function ms(e){return e!=null&&typeof e.page==`string`}function hs(e){return e==null?!1:e.href==null?e.rel===`preload`&&typeof e.imageSrcSet==`string`&&typeof e.imageSizes==`string`:typeof e.rel==`string`&&typeof e.href==`string`}async function gs(e,t,n){return xs((await Promise.all(e.map(async e=>{let r=t.routes[e.route.id];if(r){let e=await ps(r,n);return e.links?e.links():[]}return[]}))).flat(1).filter(hs).filter(e=>e.rel===`stylesheet`||e.rel===`preload`).map(e=>e.rel===`stylesheet`?{...e,rel:`prefetch`,as:`style`}:{...e,rel:`prefetch`}))}function _s(e,t,n,r,i,a){let o=(e,t)=>!n[t]||e.route.id!==n[t].route.id,s=(e,t)=>n[t].pathname!==e.pathname||n[t].route.path?.endsWith(`*`)&&n[t].params[`*`]!==e.params[`*`];return a===`assets`?t.filter((e,t)=>o(e,t)||s(e,t)):a===`data`?t.filter((t,a)=>{let c=r.routes[t.route.id];if(!c||!c.hasLoader)return!1;if(o(t,a)||s(t,a))return!0;if(t.route.shouldRevalidate){let r=t.route.shouldRevalidate({currentUrl:new URL(i.pathname+i.search+i.hash,window.origin),currentParams:n[0]?.params||{},nextUrl:new URL(e,window.origin),nextParams:t.params,defaultShouldRevalidate:!0});if(typeof r==`boolean`)return r}return!0}):[]}function vs(e,t,{includeHydrateFallback:n}={}){return ys(e.map(e=>{let r=t.routes[e.route.id];if(!r)return[];let i=[r.module];return r.clientActionModule&&(i=i.concat(r.clientActionModule)),r.clientLoaderModule&&(i=i.concat(r.clientLoaderModule)),n&&r.hydrateFallbackModule&&(i=i.concat(r.hydrateFallbackModule)),r.imports&&(i=i.concat(r.imports)),i}).flat(1))}function ys(e){return[...new Set(e)]}function bs(e){let t={},n=Object.keys(e).sort();for(let r of n)t[r]=e[r];return t}function xs(e,t){let n=new Set,r=new Set(t);return e.reduce((e,i)=>{if(t&&!ms(i)&&i.as===`script`&&i.href&&r.has(i.href))return e;let a=JSON.stringify(bs(i));return n.has(a)||(n.add(a),e.push({key:a,link:i})),e},[])}function Ss(){let e=o.useContext(Za);return ds(e,`You must render this element inside a <DataRouterContext.Provider> element`),e}function Cs(){let e=o.useContext(Qa);return ds(e,`You must render this element inside a <DataRouterStateContext.Provider> element`),e}var ws=o.createContext(void 0);ws.displayName=`FrameworkContext`;function Ts(){let e=o.useContext(ws);return ds(e,`You must render this element inside a <HydratedRouter> element`),e}function Es(e,t){let n=o.useContext(ws),[r,i]=o.useState(!1),[a,s]=o.useState(!1),{onFocus:c,onBlur:l,onMouseEnter:u,onMouseLeave:d,onTouchStart:f}=t,p=o.useRef(null);o.useEffect(()=>{if(e===`render`&&s(!0),e===`viewport`){let e=new IntersectionObserver(e=>{e.forEach(e=>{s(e.isIntersecting)})},{threshold:.5});return p.current&&e.observe(p.current),()=>{e.disconnect()}}},[e]),o.useEffect(()=>{if(r){let e=setTimeout(()=>{s(!0)},100);return()=>{clearTimeout(e)}}},[r]);let m=()=>{i(!0)},h=()=>{i(!1),s(!1)};return n?e===`intent`?[a,p,{onFocus:Ds(c,m),onBlur:Ds(l,h),onMouseEnter:Ds(u,m),onMouseLeave:Ds(d,h),onTouchStart:Ds(f,m)}]:[a,p,{}]:[!1,p,{}]}function Ds(e,t){return n=>{e&&e(n),n.defaultPrevented||t(n)}}function Os({page:e,...t}){let n=eo(),{nonce:r}=Ts(),{router:i}=Ss(),a=o.useMemo(()=>oa(i.routes,e,i.basename),[i.routes,e,i.basename]);return a?(t.nonce==null&&r&&(t={...t,nonce:r}),n?o.createElement(As,{page:e,matches:a,...t}):o.createElement(js,{page:e,matches:a,...t})):null}function ks(e){let{manifest:t,routeModules:n}=Ts(),[r,i]=o.useState([]);return o.useEffect(()=>{let r=!1;return gs(e,t,n).then(e=>{r||i(e)}),()=>{r=!0}},[e,t,n]),r}function As({page:e,matches:t,...n}){let r=Y(),{future:i}=Ts(),{basename:a}=Ss(),s=o.useMemo(()=>{if(e===r.pathname+r.search+r.hash)return[];let n=fs(e,a,i.v8_trailingSlashAwareDataRequests,`rsc`),o=!1,s=[];for(let e of t)typeof e.route.shouldRevalidate==`function`?o=!0:s.push(e.route.id);return o&&s.length>0&&n.searchParams.set(`_routes`,s.join(`,`)),[n.pathname+n.search]},[a,i.v8_trailingSlashAwareDataRequests,e,r,t]);return o.createElement(o.Fragment,null,s.map(e=>o.createElement(`link`,{key:e,rel:`prefetch`,as:`fetch`,href:e,...n})))}function js({page:e,matches:t,...n}){let r=Y(),{future:i,manifest:a,routeModules:s}=Ts(),{basename:c}=Ss(),{loaderData:l,matches:u}=Cs(),d=o.useMemo(()=>_s(e,t,u,a,r,`data`),[e,t,u,a,r]),f=o.useMemo(()=>_s(e,t,u,a,r,`assets`),[e,t,u,a,r]),p=o.useMemo(()=>{if(e===r.pathname+r.search+r.hash)return[];let n=new Set,o=!1;if(t.forEach(e=>{let t=a.routes[e.route.id];t&&t.hasLoader&&(!d.some(t=>t.route.id===e.route.id)&&e.route.id in l&&s[e.route.id]?.shouldRevalidate||t.hasClientLoader?o=!0:n.add(e.route.id))}),n.size===0)return[];let u=fs(e,c,i.v8_trailingSlashAwareDataRequests,`data`);return o&&n.size>0&&u.searchParams.set(`_routes`,t.filter(e=>n.has(e.route.id)).map(e=>e.route.id).join(`,`)),[u.pathname+u.search]},[c,i.v8_trailingSlashAwareDataRequests,l,r,a,d,t,e,s]),m=o.useMemo(()=>vs(f,a),[f,a]),h=ks(f);return o.createElement(o.Fragment,null,p.map(e=>o.createElement(`link`,{key:e,rel:`prefetch`,as:`fetch`,href:e,...n})),m.map(e=>o.createElement(`link`,{key:e,rel:`modulepreload`,href:e,...n})),h.map(({key:e,link:t})=>o.createElement(`link`,{key:e,nonce:n.nonce,...t,crossOrigin:t.crossOrigin??n.crossOrigin})))}function Ms(...e){return t=>{e.forEach(e=>{typeof e==`function`?e(t):e!=null&&(e.current=t)})}}o.Component;var Ns=typeof window<`u`&&window.document!==void 0&&window.document.createElement!==void 0;try{Ns&&(window.__reactRouterVersion=`7.18.4`)}catch{}function Ps({basename:e,children:t,useTransitions:n,window:r}){let i=o.useRef();i.current??=Qi({window:r,v5Compat:!0});let a=i.current,[s,c]=o.useState({action:a.action,location:a.location}),l=o.useCallback(e=>{n===!1?c(e):o.startTransition(()=>c(e))},[n]);return o.useLayoutEffect(()=>a.listen(l),[a,l]),o.createElement(qo,{basename:e,children:t,location:s.location,navigationType:s.action,navigator:a,useTransitions:n})}var Fs=o.forwardRef(function({onClick:e,discover:t=`render`,prefetch:n=`none`,relative:r,reloadDocument:i,replace:a,mask:s,state:c,target:l,to:u,preventScrollReset:d,viewTransition:f,defaultShouldRevalidate:p,...m},h){let{basename:g,navigator:_,useTransitions:v}=o.useContext(q),y=typeof u==`string`&&qi.test(u),b=Va(u,g);u=b.to;let x=fo(u,{relative:r}),S=Y(),C=null;if(s){let e=ja(s,[],S.mask?S.mask.pathname:`/`,!0);g!==`/`&&(e.pathname=e.pathname===`/`?g:K([g,e.pathname])),C=_.createHref(e)}let[w,T,E]=Es(n,m),D=Bs(u,{replace:a,mask:s,state:c,target:l,preventScrollReset:d,relative:r,viewTransition:f,defaultShouldRevalidate:p,useTransitions:v});function ee(t){e&&e(t),t.defaultPrevented||D(t)}let O=!(b.isExternal||i),te=o.createElement(`a`,{...m,...E,href:(O?C:void 0)||b.absoluteURL||x,onClick:O?ee:e,ref:Ms(h,T),target:l,"data-discover":!y&&t===`render`?`true`:void 0});return w&&!y?o.createElement(o.Fragment,null,te,o.createElement(Os,{page:x})):te});Fs.displayName=`Link`;var Is=o.forwardRef(function({"aria-current":e=`page`,caseSensitive:t=!1,className:n=``,end:r=!1,style:i,to:a,viewTransition:s,children:c,...l},u){let d=Co(a,{relative:l.relative}),f=Y(),p=o.useContext(Qa),{navigator:m,basename:h}=o.useContext(q),g=p!=null&&Ks(d)&&s===!0,_=m.encodeLocation?m.encodeLocation(d).pathname:d.pathname,v=f.pathname,y=p&&p.navigation&&p.navigation.location?p.navigation.location.pathname:null;t||(v=v.toLowerCase(),y=y?y.toLowerCase():null,_=_.toLowerCase()),y&&h&&(y=G(y,h)||y);let b=_!==`/`&&_.endsWith(`/`)?_.length-1:_.length,x=v===_||!r&&v.startsWith(_)&&v.charAt(b)===`/`,S=y!=null&&(y===_||!r&&y.startsWith(_)&&y.charAt(_.length)===`/`),C={isActive:x,isPending:S,isTransitioning:g},w=x?e:void 0,T;T=typeof n==`function`?n(C):[n,x?`active`:null,S?`pending`:null,g?`transitioning`:null].filter(Boolean).join(` `);let E=typeof i==`function`?i(C):i;return o.createElement(Fs,{...l,"aria-current":w,className:T,ref:u,style:E,to:a,viewTransition:s},typeof c==`function`?c(C):c)});Is.displayName=`NavLink`;var Ls=o.forwardRef(({discover:e=`render`,fetcherKey:t,navigate:n,reloadDocument:r,replace:i,state:a,method:s=Xo,action:c,onSubmit:l,relative:u,preventScrollReset:d,viewTransition:f,defaultShouldRevalidate:p,...m},h)=>{let{useTransitions:g}=o.useContext(q),_=Ws(),v=Gs(c,{relative:u}),y=s.toLowerCase()===`get`?`get`:`post`,b=typeof c==`string`&&qi.test(c);return o.createElement(`form`,{ref:h,method:y,action:v,onSubmit:r?l:e=>{if(l&&l(e),e.defaultPrevented)return;e.preventDefault();let r=e.nativeEvent.submitter,c=r?.getAttribute(`formmethod`)||s,m=()=>_(r||e.currentTarget,{fetcherKey:t,method:c,navigate:n,replace:i,state:a,relative:u,preventScrollReset:d,viewTransition:f,defaultShouldRevalidate:p});g&&n!==!1?o.startTransition(()=>m()):m()},...m,"data-discover":!b&&e===`render`?`true`:void 0})});Ls.displayName=`Form`;function Rs(e){return`${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`}function zs(e){let t=o.useContext(Za);return U(t,Rs(e)),t}function Bs(e,{target:t,replace:n,mask:r,state:i,preventScrollReset:a,relative:s,viewTransition:c,defaultShouldRevalidate:l,useTransitions:u}={}){let d=_o(),f=Y(),p=Co(e,{relative:s});return o.useCallback(m=>{if(rs(m,t)){m.preventDefault();let t=n===void 0?na(f)===na(p):n,h=()=>d(e,{replace:t,mask:r,state:i,preventScrollReset:a,relative:s,viewTransition:c,defaultShouldRevalidate:l});u?o.startTransition(()=>h()):h()}},[f,d,p,n,r,i,t,e,a,s,c,l,u])}function Vs(e){W(typeof URLSearchParams<`u`,"You cannot use the `useSearchParams` hook in a browser that does not support the URLSearchParams API. If you need to support Internet Explorer 11, we recommend you load a polyfill such as https://github.com/ungap/url-search-params.");let t=o.useRef(is(e)),n=o.useRef(!1),r=Y(),i=o.useMemo(()=>as(r.search,n.current?null:t.current),[r.search]),a=_o();return[i,o.useCallback((e,t)=>{let r=is(typeof e==`function`?e(new URLSearchParams(i)):e);n.current=!0,a(`?`+r,t)},[a,i])]}var Hs=0,Us=()=>`__${String(++Hs)}__`;function Ws(){let{router:e}=zs(`useSubmit`),{basename:t}=o.useContext(q),n=Ro(),r=e.fetch,i=e.navigate;return o.useCallback(async(e,a={})=>{let{action:o,method:s,encType:c,formData:l,body:u}=us(e,t);if(a.navigate===!1){let e=a.fetcherKey||Us();await r(e,n,a.action||o,{defaultShouldRevalidate:a.defaultShouldRevalidate,preventScrollReset:a.preventScrollReset,formData:l,body:u,formMethod:a.method||s,formEncType:a.encType||c,flushSync:a.flushSync})}else await i(a.action||o,{defaultShouldRevalidate:a.defaultShouldRevalidate,preventScrollReset:a.preventScrollReset,formData:l,body:u,formMethod:a.method||s,formEncType:a.encType||c,replace:a.replace,state:a.state,fromRouteId:n,flushSync:a.flushSync,viewTransition:a.viewTransition})},[r,i,t,n])}function Gs(e,{relative:t}={}){let{basename:n}=o.useContext(q),r=o.useContext(J);U(r,`useFormAction must be used inside a RouteContext`);let[i]=r.matches.slice(-1),a={...Co(e||`.`,{relative:t})},s=Y();if(e==null){a.search=s.search;let e=new URLSearchParams(a.search),t=e.getAll(`index`);if(t.some(e=>e===``)){e.delete(`index`),t.filter(e=>e).forEach(t=>e.append(`index`,t));let n=e.toString();a.search=n?`?${n}`:``}}return(!e||e===`.`)&&i.route.index&&(a.search=a.search?a.search.replace(/^\?/,`?index&`):`?index`),n!==`/`&&(a.pathname=a.pathname===`/`?n:K([n,a.pathname])),na(a)}function Ks(e,{relative:t}={}){let n=o.useContext(to);U(n!=null,"`useViewTransitionState` must be used within `react-router-dom`'s `RouterProvider`.  Did you accidentally import `RouterProvider` from `react-router`?");let{basename:r}=zs(`useViewTransitionState`),i=Co(e,{relative:t});if(!n.isTransitioning)return!1;let a=G(n.currentLocation.pathname,r)||n.currentLocation.pathname,s=G(n.nextLocation.pathname,r)||n.nextLocation.pathname;return Sa(i.pathname,s)!=null||Sa(i.pathname,a)!=null}var qs=t((e=>{var t=Symbol.for(`react.transitional.element`),n=Symbol.for(`react.fragment`);function r(e,n,r){var i=null;if(r!==void 0&&(i=``+r),n.key!==void 0&&(i=``+n.key),`key`in n)for(var a in r={},n)a!==`key`&&(r[a]=n[a]);else r=n;return n=r.ref,{$$typeof:t,type:e,key:i,ref:n===void 0?null:n,props:r}}e.Fragment=n,e.jsx=r,e.jsxs=r})),Js=t(((e,t)=>{t.exports=qs()})),X=Js();function Z(...e){return e.filter(Boolean).join(` `)}function Ys(e){return`/`.replace(/\/$/,``)+e}function Xs({to:e,children:t,...n}){if(po())return(0,X.jsx)(Fs,{to:e,...n,children:t});let r=/^https?:/.test(e)?e:`https://kobblon.com${e}`;return(0,X.jsx)(`a`,{href:r,target:`_blank`,rel:`noreferrer`,...n,children:t})}function Zs(e){return e-=0,e===e}function Qs(e){return Zs(e)?e:(e=e.replace(/[_-]+(.)?/g,(e,t)=>t?t.toUpperCase():``),e.charAt(0).toLowerCase()+e.slice(1))}var $s=(e,t)=>o.createElement(`stop`,{key:`${t}-${e.offset}`,offset:e.offset,stopColor:e.color,...e.opacity!==void 0&&{stopOpacity:e.opacity}});function ec(e){return e.charAt(0).toUpperCase()+e.slice(1)}var tc=new Map,nc=1e3;function rc(e){if(tc.has(e))return tc.get(e);let t={},n=0,r=e.length;for(;n<r;){let i=e.indexOf(`;`,n),a=i===-1?r:i,o=e.slice(n,a).trim();if(o){let e=o.indexOf(`:`);if(e>0){let n=o.slice(0,e).trim(),r=o.slice(e+1).trim();if(n&&r){let e=Qs(n);t[e.startsWith(`webkit`)?ec(e):e]=r}}}n=a+1}if(tc.size===nc){let e=tc.keys().next().value;e&&tc.delete(e)}return tc.set(e,t),t}function ic(e,t,n={}){if(typeof t==`string`)return t;let r=(t.children||[]).map(t=>{let r=t;return(`fill`in n||n.gradientFill)&&t.tag===`path`&&`fill`in t.attributes&&(r={...t,attributes:{...t.attributes,fill:void 0}}),ic(e,r)}),i=t.attributes||{},a={};for(let[e,t]of Object.entries(i))switch(!0){case e===`class`:a.className=t;break;case e===`style`:a.style=rc(String(t));break;case e.startsWith(`aria-`):case e.startsWith(`data-`):a[e.toLowerCase()]=t;break;default:a[Qs(e)]=t}let{style:o,role:s,"aria-label":c,gradientFill:l,...u}=n;if(o&&(a.style=a.style?{...a.style,...o}:o),s&&(a.role=s),c&&(a[`aria-label`]=c,a[`aria-hidden`]=`false`),l){a.fill=`url(#${l.id})`;let{type:t,stops:n=[],...i}=l;r.unshift(e(t===`linear`?`linearGradient`:`radialGradient`,{...i,id:l.id},n.map($s)))}return e(t.tag,{...a,...u},...r)}var ac=ic.bind(null,o.createElement),oc=(e,t)=>{let n=(0,o.useId)();return e||(t?n:void 0)},sc=class{constructor(e=`react-fontawesome`){this.enabled=!1;let t=!1;try{t=typeof process<`u`&&!1}catch{}this.scope=e,this.enabled=t}log(...e){this.enabled&&console.log(`[${this.scope}]`,...e)}warn(...e){this.enabled&&console.warn(`[${this.scope}]`,...e)}error(...e){this.enabled&&console.error(`[${this.scope}]`,...e)}};typeof process<`u`&&{}.FA_VERSION;var cc=`searchPseudoElementsFullScan`in Wi&&typeof Wi.searchPseudoElementsFullScan==`boolean`?`7.0.0`:`6.0.0`,lc=Number.parseInt(cc)>=7,uc=()=>lc,dc=`fa`,Q={beat:`fa-beat`,fade:`fa-fade`,beatFade:`fa-beat-fade`,bounce:`fa-bounce`,shake:`fa-shake`,spin:`fa-spin`,spinPulse:`fa-spin-pulse`,spinReverse:`fa-spin-reverse`,pulse:`fa-pulse`,flip360:`fa-flip-360`,buzz:`fa-buzz`,float:`fa-float`,jello:`fa-jello`,spinSnap:`fa-spin-snap`,spinSnap4:`fa-spin-snap-4`,spinSnap8:`fa-spin-snap-8`,swing:`fa-swing`,wag:`fa-wag`},fc={left:`fa-pull-left`,right:`fa-pull-right`},pc={90:`fa-rotate-90`,180:`fa-rotate-180`,270:`fa-rotate-270`},mc={"2xs":`fa-2xs`,xs:`fa-xs`,sm:`fa-sm`,lg:`fa-lg`,xl:`fa-xl`,"2xl":`fa-2xl`,"1x":`fa-1x`,"2x":`fa-2x`,"3x":`fa-3x`,"4x":`fa-4x`,"5x":`fa-5x`,"6x":`fa-6x`,"7x":`fa-7x`,"8x":`fa-8x`,"9x":`fa-9x`,"10x":`fa-10x`},$={border:`fa-border`,fixedWidth:`fa-fw`,flip:`fa-flip`,flipHorizontal:`fa-flip-horizontal`,flipVertical:`fa-flip-vertical`,inverse:`fa-inverse`,rotateBy:`fa-rotate-by`,swapOpacity:`fa-swap-opacity`,widthAuto:`fa-width-auto`,canvasSquare:`fa-canvas-square`,canvasRoomy:`fa-canvas-roomy`},hc={default:`fa-layers`};function gc(e){let t=Wi.cssPrefix||Wi.familyPrefix||dc;return t===dc?e:e.replace(new RegExp(String.raw`(?<=^|\s)${dc}-`,`g`),`${t}-`)}function _c(e){let{beat:t,fade:n,beatFade:r,bounce:i,shake:a,spin:o,spinPulse:s,spinReverse:c,pulse:l,fixedWidth:u,inverse:d,border:f,flip:p,size:m,rotation:h,pull:g,swapOpacity:_,rotateBy:v,widthAuto:y,canvasSquare:b,canvasRoomy:x,flip360:S,buzz:C,float:w,jello:T,spinSnap:E,spinSnap4:D,spinSnap8:ee,swing:O,wag:te,className:ne}=e,k=[];return ne&&k.push(...ne.split(` `)),t&&k.push(Q.beat),n&&k.push(Q.fade),r&&k.push(Q.beatFade),i&&k.push(Q.bounce),a&&k.push(Q.shake),o&&k.push(Q.spin),c&&k.push(Q.spinReverse),s&&k.push(Q.spinPulse),l&&k.push(Q.pulse),u&&k.push($.fixedWidth),d&&k.push($.inverse),f&&k.push($.border),p===!0&&k.push($.flip),(p===`horizontal`||p===`both`)&&k.push($.flipHorizontal),(p===`vertical`||p===`both`)&&k.push($.flipVertical),m!=null&&k.push(mc[m]),h!=null&&h!==0&&k.push(pc[h]),g!=null&&k.push(fc[g]),_&&k.push($.swapOpacity),uc()?(v&&k.push($.rotateBy),y&&k.push($.widthAuto),b&&k.push($.canvasSquare),x&&k.push($.canvasRoomy),S&&k.push(Q.flip360),C&&k.push(Q.buzz),w&&k.push(Q.float),T&&k.push(Q.jello),E&&k.push(Q.spinSnap),D&&k.push(Q.spinSnap4),ee&&k.push(Q.spinSnap8),O&&k.push(Q.swing),te&&k.push(Q.wag),(Wi.cssPrefix||Wi.familyPrefix||dc)===dc?k:k.map(gc)):k}var vc=e=>typeof e==`object`&&`icon`in e&&!!e.icon;function yc(e){if(e)return vc(e)?e:Gi.icon(e)}function bc(e){return Object.keys(e)}var xc=new sc(`FontAwesomeIcon`),Sc={border:!1,className:``,mask:void 0,maskId:void 0,fixedWidth:!1,inverse:!1,flip:!1,icon:void 0,listItem:!1,pull:void 0,pulse:!1,rotation:void 0,rotateBy:!1,size:void 0,spin:!1,spinPulse:!1,spinReverse:!1,beat:!1,fade:!1,beatFade:!1,bounce:!1,shake:!1,symbol:!1,title:``,titleId:void 0,transform:void 0,swapOpacity:!1,widthAuto:!1,canvasSquare:!1,canvasRoomy:!1,flip360:!1,buzz:!1,float:!1,jello:!1,spinSnap:!1,spinSnap4:!1,spinSnap8:!1,swing:!1,wag:!1},Cc=new Set(Object.keys(Sc)),wc=o.forwardRef((e,t)=>{let n={...Sc,...e},{icon:r,mask:i,symbol:a,title:o,titleId:s,maskId:c,transform:l}=n,u=oc(c,!!i),d=oc(s,!!o),f=yc(r);if(!f)return xc.error(`Icon lookup is undefined`,r),null;let p=_c(n),m=typeof l==`string`?Gi.transform(l):l,h=yc(i),g=Ki(f,{...p.length>0&&{classes:p},...m&&{transform:m},...h&&{mask:h},symbol:a,title:o,titleId:d,maskId:u});if(!g)return xc.error(`Could not find icon`,f),null;let{abstract:_}=g,v={ref:t};for(let e of bc(n))Cc.has(e)||(v[e]=n[e]);return ac(_[0],v)});wc.displayName=`FontAwesomeIcon`,`${hc.default}${$.fixedWidth}`;function Tc(e){let t=t=>!!e&&RegExp(`(^|\\s)(${t}|size)-`).test(e);return Z(!t(`h`)&&`h-[1em]`,!t(`w`)&&`w-[1em]`)}function Ec(e){return Ys(`/icons/${e.startsWith(`workspace/`)?e:`ui/${e}`}.png`)}var Dc=`#5DADEC`,Oc={"reaction-heart-eyes":[{part:`reaction-heart-eyes-eyes`,colour:`#DF1F2D`}],"reaction-winky-grin":[{part:`reaction-winky-grin-tongue`,colour:`#FF6F9C`}],"reaction-sad":[{part:`reaction-sad-tears`,colour:Dc}],"reaction-laugh":[{part:`reaction-laugh-tears`,colour:Dc}]};function kc({name:e,label:t,title:n,tone:r,style:i,className:a}){let o=Ec(e),s=r===void 0?e.startsWith(`workspace/`)?null:`currentColor`:r;if(s){let r=s===`currentColor`?void 0:Oc[e],c=(0,X.jsx)(`span`,{role:t?`img`:void 0,"aria-label":t,"aria-hidden":!t||void 0,title:n,className:Z(`inline-block align-[-0.125em]`,Tc(a),a),style:{...i,backgroundColor:s===`currentColor`?`currentColor`:s,maskImage:`url(${o})`,WebkitMaskImage:`url(${o})`,maskSize:`contain`,WebkitMaskSize:`contain`,maskRepeat:`no-repeat`,WebkitMaskRepeat:`no-repeat`,maskPosition:`center`,WebkitMaskPosition:`center`}});return r?(0,X.jsxs)(`span`,{className:Z(`relative inline-block align-[-0.125em]`,Tc(a),a),role:t?`img`:void 0,"aria-label":t,"aria-hidden":!t||void 0,title:n,style:i,children:[(0,X.jsx)(`span`,{"aria-hidden":!0,className:`absolute inset-0`,style:{backgroundColor:s,maskImage:`url(${o})`,WebkitMaskImage:`url(${o})`,maskSize:`contain`,WebkitMaskSize:`contain`,maskRepeat:`no-repeat`,WebkitMaskRepeat:`no-repeat`,maskPosition:`center`,WebkitMaskPosition:`center`}}),r.map(e=>(0,X.jsx)(`span`,{"aria-hidden":!0,className:`absolute inset-0`,style:{backgroundColor:e.colour,maskImage:`url(${Ys(`/icons/ui/${e.part}.png`)})`,WebkitMaskImage:`url(${Ys(`/icons/ui/${e.part}.png`)})`,maskSize:`contain`,WebkitMaskSize:`contain`,maskRepeat:`no-repeat`,WebkitMaskRepeat:`no-repeat`,maskPosition:`center`,WebkitMaskPosition:`center`}},e.part))]}):c}return(0,X.jsx)(`img`,{src:o,alt:t??``,"aria-hidden":!t||void 0,title:n,style:i,draggable:!1,className:Z(`inline-block select-none align-[-0.125em] object-contain`,Tc(a),a)})}var Ac={user:`user`,"circle-user":`circle-user`,"user-large":`user`,"user-group":`users`,users:`people`,"user-plus":`add-user`,"user-minus":`remove-user`,"user-slash":`remove-user`,"user-xmark":`cross-user`,"user-check":`check-user`,"user-shield":`admin`,"user-tie":`admin`,comment:`chatbubble`,comments:`chatbubble`,"comment-dots":`chatbubble`,message:`chatbubble`,"paper-plane":`send`,microphone:`microphone`,"microphone-slash":`mute-microphone`,"microphone-lines":`microphone`,bullhorn:`announcement`,flag:`report`,bell:`notification`,gear:`gear`,"circle-check":`checkmark`,percent:`discount`,coins:`brix`,"hand-pointer":`click`,"earth-europe":`world`,shapes:`assets`},jc={star:{on:`favourite`,off:`favourite-stroke`},heart:{on:`favourite`,off:`favourite-stroke`},"thumbs-up":{on:`thumbs-up`,off:`thumbs-up-stroke`},"thumbs-down":{on:`thumbs-down`,off:`thumbs-down-stroke`}};function Mc({icon:e,name:t,on:n,tone:r=`currentColor`,label:i,title:a,style:o,spin:s,className:c}){let l=jc[e.iconName],u=t??(l?n===void 0?void 0:n?l.on:l.off:Ac[e.iconName]);return u?(0,X.jsx)(kc,{name:u,label:i,title:a,style:o,tone:r,className:Z(s&&`animate-spin`,c)}):(0,X.jsx)(wc,{icon:e,"aria-label":i,"aria-hidden":!i||void 0,title:a,style:o,spin:s,className:Z(c)})}var Nc={primary:`bg-brand text-white hover:bg-brand-bright active:bg-brand border-b-[3px] border-brand-ink active:border-b-0 active:mt-[3px]`,yes:`bg-space text-white hover:bg-space-bright active:bg-space border-b-[3px] border-space-deep active:border-b-0 active:mt-[3px]`,enter:`bg-space text-white hover:bg-space-bright active:bg-space border-b-[3px] border-space-deep active:border-b-0 active:mt-[3px]`,brand:`bg-brand text-white hover:bg-brand-bright active:bg-brand border-b-[3px] border-brand-ink active:border-b-0 active:mt-[3px]`,ghost:`bg-transparent text-white/80 hover:bg-white/10 hover:text-white border border-transparent`,subtle:`bg-ink-hover text-white hover:bg-[#2c2c36] border border-ink-line`,danger:`bg-danger text-white hover:bg-danger-bright active:bg-danger border-b-[3px] border-danger-ink active:border-b-0 active:mt-[3px]`},Pc={sm:`h-8 px-3 text-[13px] gap-1.5 rounded-lg`,md:`h-10 px-4 text-sm gap-2 rounded-xl`,lg:`h-12 px-6 text-base gap-2.5 rounded-xl`},Fc=`inline-flex items-center justify-center font-semibold transition-[background-color,transform,box-shadow] duration-150 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap`,Ic=(0,o.forwardRef)(function({variant:t=`primary`,size:n=`md`,icon:r,iconOn:i,iconName:a,iconRight:o,loading:s,to:c,block:l,className:u,children:d,...f},p){let m=Z(Fc,Nc[t],Pc[n],l&&`w-full`,u),h=(0,X.jsxs)(X.Fragment,{children:[s?(0,X.jsx)(Mc,{icon:e,className:`animate-spin`}):r&&(0,X.jsx)(Mc,{icon:r,name:a,on:i}),d,o&&!s&&(0,X.jsx)(Mc,{icon:o})]});return c?(0,X.jsx)(Xs,{to:c,className:m,children:h}):(0,X.jsx)(`button`,{ref:p,className:m,disabled:s||f.disabled,...f,children:h})}),Lc=`Kobblon`,Rc=Ys(`/brand/favicon.png`),zc=`At Kobblon`;function Bc(e){Uc(e?`${e} | ${zc}`:zc)}var Vc=Ys(`/brand/favicon-creator.png`);function Hc(e,t=Lc){(0,o.useEffect)(()=>(document.title=e?`${e} - ${t}`:t,()=>{document.title=Lc}),[e,t])}function Uc(e){(0,o.useEffect)(()=>(document.title=e||Lc,()=>{document.title=Lc}),[e])}var Wc=[],Gc=0,Kc=``;function qc(){let e=Wc.length?Wc[Wc.length-1].url:Rc;if(e===Kc)return;Kc=e;for(let e of Array.from(document.head.querySelectorAll(`link[rel="icon"]`)))e.remove();let t=document.createElement(`link`);t.rel=`icon`,t.type=e.endsWith(`.svg`)?`image/svg+xml`:`image/png`,t.href=e,document.head.appendChild(t)}function Jc(e){(0,o.useEffect)(()=>{let t={token:Gc+=1,url:e||Rc};return Wc.push(t),qc(),()=>{let e=Wc.findIndex(e=>e.token===t.token);e>=0&&Wc.splice(e,1),qc()}},[e])}function Yc(e){let{title:t,description:n,image:r}=e;(0,o.useEffect)(()=>{let e=(e,t,n)=>{let r=document.head.querySelector(e);if(!r)return;let i=r.getAttribute(t)??``;return r.setAttribute(t,n),()=>r.setAttribute(t,i)},i=[t&&e(`meta[property="og:title"]`,`content`,t),t&&e(`meta[name="twitter:title"]`,`content`,t),n&&e(`meta[name="description"]`,`content`,n),n&&e(`meta[property="og:description"]`,`content`,n),n&&e(`meta[name="twitter:description"]`,`content`,n),r&&e(`meta[property="og:image"]`,`content`,r),r&&e(`meta[name="twitter:image"]`,`content`,r),e(`meta[property="og:url"]`,`content`,window.location.href),e(`link[rel="canonical"]`,`href`,window.location.href)];return()=>i.forEach(e=>typeof e==`function`&&e())},[t,n,r])}var Xc=`w-full rounded-xl border border-ink-line bg-ink-raised px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 transition-colors focus:border-brand-bright focus:bg-ink-hover`,Zc=(0,o.forwardRef)(function({label:e,labelNote:t,hint:n,error:r,icon:i,className:a,id:s,...c},l){let u=(0,o.useId)(),d=s??u;return(0,X.jsxs)(`div`,{className:`w-full`,children:[e&&(0,X.jsxs)(`label`,{htmlFor:d,className:`mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-muted`,children:[e,t&&(0,X.jsx)(`span`,{className:`ml-1.5 font-medium normal-case text-white/30`,children:t})]}),(0,X.jsxs)(`div`,{className:`relative`,children:[i&&(0,X.jsx)(Mc,{icon:i,className:`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-white/35`}),(0,X.jsx)(`input`,{ref:l,id:d,"aria-invalid":r?!0:void 0,"aria-describedby":r||n?`${d}-desc`:void 0,className:Z(Xc,i&&`pl-10`,r&&`border-danger/60`,a),...c})]}),(r||n)&&(0,X.jsx)(`p`,{id:`${d}-desc`,className:Z(`mt-1.5 text-xs`,r?`text-danger`:`text-muted`),children:r??n})]})}),Qc=(0,o.forwardRef)(function({label:e,labelNote:t,hint:n,error:r,className:i,id:a,...s},c){let l=(0,o.useId)(),u=a??l;return(0,X.jsxs)(`div`,{className:`w-full`,children:[e&&(0,X.jsxs)(`label`,{htmlFor:u,className:`mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-muted`,children:[e,t&&(0,X.jsx)(`span`,{className:`ml-1.5 font-medium normal-case text-white/30`,children:t})]}),(0,X.jsx)(`textarea`,{ref:c,id:u,"aria-invalid":r?!0:void 0,className:Z(Xc,`min-h-[92px] resize-y`,r&&`border-danger/60`,i),...s}),(r||n)&&(0,X.jsx)(`p`,{className:Z(`mt-1.5 text-xs`,r?`text-danger`:`text-muted`),children:r??n})]})});export{Wi as A,Jo as C,bo as D,mo as E,So as O,Ko as S,_o as T,Ps as _,Uc as a,Wo as b,Hc as c,kc as d,wc as f,Js as g,Z as h,Bc as i,a as j,Vs as k,Ic as l,Ys as m,Qc as n,Jc as o,Xs as p,Vc as r,Yc as s,Zc as t,Mc as u,Fs as v,Y as w,Go as x,Is as y};