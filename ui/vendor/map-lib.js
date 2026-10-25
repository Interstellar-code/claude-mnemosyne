/* ui/vendor/map-lib.js: 3d-force-graph and three-spritetext with three, built by scripts/vendor-map.ts. Do not edit; see map-lib.inputs.json and THIRD-PARTY-NOTICES.txt. */
var gv=Object.create;var{getPrototypeOf:_v,defineProperty:Jd,getOwnPropertyNames:vv}=Object;var Kd=Object.prototype.hasOwnProperty;function yv(e){return this[e]}var xv,bv,Sv=(e,t,n)=>{var i=e!=null&&typeof e==="object";if(i){var r=t?xv??=new WeakMap:bv??=new WeakMap,s=r.get(e);if(s)return s}n=e!=null?gv(_v(e)):{};let o=t||!e||!e.__esModule||!Kd.call(e,"default")?Jd(n,"default",{value:e,enumerable:!0}):n;if(e&&typeof e==="object"||typeof e==="function"){for(let a of vv(e))if(!Kd.call(o,a))Jd(o,a,{get:yv.bind(e,a),enumerable:!0})}if(i)r.set(e,o);return o};var sn=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var Yu=sn(function(JD,i_){i_.exports=function(t){if(t===0)return"x";if(t===1)return"y";if(t===2)return"z";return"c"+(t+1)}});var or=sn(function(KD,r_){var Uw=Yu();r_.exports=function(t){return n;function n(i,r){let s=r&&r.indent||0,o=r&&r.join!==void 0?r.join:`
`,a=Array(s+1).join(" "),l=[];for(let c=0;c<t;++c){let u=Uw(c),f=c===0?"":a;l.push(f+i.replace(/{var}/g,u))}return l.join(o)}}});var c_=sn(function(QD,oo){var s_=or();oo.exports=Fw;oo.exports.generateCreateBodyFunctionBody=o_;oo.exports.getVectorCode=l_;oo.exports.getBodyCode=a_;function Fw(e,t){let n=o_(e,t),{Body:i}=Function(n)();return i}function o_(e,t){return`
${l_(e,t)}
${a_(e,t)}
return {Body: Body, Vector: Vector};
`}function a_(e){let t=s_(e),n=t("{var}",{join:", "});return`
function Body(${n}) {
  this.isPinned = false;
  this.pos = new Vector(${n});
  this.force = new Vector();
  this.velocity = new Vector();
  this.mass = 1;

  this.springCount = 0;
  this.springLength = 0;
}

Body.prototype.reset = function() {
  this.force.reset();
  this.springCount = 0;
  this.springLength = 0;
}

Body.prototype.setPosition = function (${n}) {
  ${t("this.pos.{var} = {var} || 0;",{indent:2})}
};`}function l_(e,t){let n=s_(e),i="";if(t)i=`${n(`
   var v{var};
Object.defineProperty(this, '{var}', {
  set: function(v) { 
    if (!Number.isFinite(v)) throw new Error('Cannot set non-numbers to {var}');
    v{var} = v; 
  },
  get: function() { return v{var}; }
});`)}`;return`function Vector(${n("{var}",{join:", "})}) {
  ${i}
    if (typeof arguments[0] === 'object') {
      // could be another vector
      let v = arguments[0];
      ${n('if (!Number.isFinite(v.{var})) throw new Error("Expected value is not a finite number at Vector constructor ({var})");',{indent:4})}
      ${n("this.{var} = v.{var};",{indent:4})}
    } else {
      ${n('this.{var} = typeof {var} === "number" ? {var} : 0;',{indent:4})}
    }
  }
  
  Vector.prototype.reset = function () {
    ${n("this.{var} = ",{join:""})}0;
  };`}});var g_=sn(function(eN,Ti){var $u=or(),wi=Yu();Ti.exports=Bw;Ti.exports.generateQuadTreeFunctionBody=h_;Ti.exports.getInsertStackCode=m_;Ti.exports.getQuadNodeCode=p_;Ti.exports.isSamePosition=u_;Ti.exports.getChildBodyCode=d_;Ti.exports.setChildBodyCode=f_;function Bw(e){let t=h_(e);return Function(t)()}function h_(e){let t=$u(e),n=Math.pow(2,e);return`
${m_()}
${p_(e)}
${u_(e)}
${d_(e)}
${f_(e)}

function createQuadTree(options, random) {
  options = options || {};
  options.gravity = typeof options.gravity === 'number' ? options.gravity : -1;
  options.theta = typeof options.theta === 'number' ? options.theta : 0.8;

  var gravity = options.gravity;
  var updateQueue = [];
  var insertStack = new InsertStack();
  var theta = options.theta;

  var nodesCache = [];
  var currentInCache = 0;
  var root = newNode();

  return {
    insertBodies: insertBodies,

    /**
     * Gets root node if it is present
     */
    getRoot: function() {
      return root;
    },

    updateBodyForce: update,

    options: function(newOptions) {
      if (newOptions) {
        if (typeof newOptions.gravity === 'number') {
          gravity = newOptions.gravity;
        }
        if (typeof newOptions.theta === 'number') {
          theta = newOptions.theta;
        }

        return this;
      }

      return {
        gravity: gravity,
        theta: theta
      };
    }
  };

  function newNode() {
    // To avoid pressure on GC we reuse nodes.
    var node = nodesCache[currentInCache];
    if (node) {
${o("      node.")}
      node.body = null;
      node.mass = ${t("node.mass_{var} = ",{join:""})}0;
      ${t("node.min_{var} = node.max_{var} = ",{join:""})}0;
    } else {
      node = new QuadNode();
      nodesCache[currentInCache] = node;
    }

    ++currentInCache;
    return node;
  }

  function update(sourceBody) {
    var queue = updateQueue;
    var v;
    ${t("var d{var};",{indent:4})}
    var r; 
    ${t("var f{var} = 0;",{indent:4})}
    var queueLength = 1;
    var shiftIdx = 0;
    var pushIdx = 1;

    queue[0] = root;

    while (queueLength) {
      var node = queue[shiftIdx];
      var body = node.body;

      queueLength -= 1;
      shiftIdx += 1;
      var differentBody = (body !== sourceBody);
      if (body && differentBody) {
        // If the current node is a leaf node (and it is not source body),
        // calculate the force exerted by the current node on body, and add this
        // amount to body's net force.
        ${t("d{var} = body.pos.{var} - sourceBody.pos.{var};",{indent:8})}
        r = Math.sqrt(${t("d{var} * d{var}",{join:" + "})});

        if (r === 0) {
          // Poor man's protection against zero distance.
          ${t("d{var} = (random.nextDouble() - 0.5) / 50;",{indent:10})}
          r = Math.sqrt(${t("d{var} * d{var}",{join:" + "})});
        }

        // This is standard gravitation force calculation but we divide
        // by r^3 to save two operations when normalizing force vector.
        v = gravity * body.mass * sourceBody.mass / (r * r * r);
        ${t("f{var} += v * d{var};",{indent:8})}
      } else if (differentBody) {
        // Otherwise, calculate the ratio s / r,  where s is the width of the region
        // represented by the internal node, and r is the distance between the body
        // and the node's center-of-mass
        ${t("d{var} = node.mass_{var} / node.mass - sourceBody.pos.{var};",{indent:8})}
        r = Math.sqrt(${t("d{var} * d{var}",{join:" + "})});

        if (r === 0) {
          // Sorry about code duplication. I don't want to create many functions
          // right away. Just want to see performance first.
          ${t("d{var} = (random.nextDouble() - 0.5) / 50;",{indent:10})}
          r = Math.sqrt(${t("d{var} * d{var}",{join:" + "})});
        }
        // If s / r < θ, treat this internal node as a single body, and calculate the
        // force it exerts on sourceBody, and add this amount to sourceBody's net force.
        if ((node.max_${wi(0)} - node.min_${wi(0)}) / r < theta) {
          // in the if statement above we consider node's width only
          // because the region was made into square during tree creation.
          // Thus there is no difference between using width or height.
          v = gravity * node.mass * sourceBody.mass / (r * r * r);
          ${t("f{var} += v * d{var};",{indent:10})}
        } else {
          // Otherwise, run the procedure recursively on each of the current node's children.

          // I intentionally unfolded this loop, to save several CPU cycles.
${s()}
        }
      }
    }

    ${t("sourceBody.force.{var} += f{var};",{indent:4})}
  }

  function insertBodies(bodies) {
    ${t("var {var}min = Number.MAX_VALUE;",{indent:4})}
    ${t("var {var}max = Number.MIN_VALUE;",{indent:4})}
    var i = bodies.length;

    // To reduce quad tree depth we are looking for exact bounding box of all particles.
    while (i--) {
      var pos = bodies[i].pos;
      ${t("if (pos.{var} < {var}min) {var}min = pos.{var};",{indent:6})}
      ${t("if (pos.{var} > {var}max) {var}max = pos.{var};",{indent:6})}
    }

    // Makes the bounds square.
    var maxSideLength = -Infinity;
    ${t("if ({var}max - {var}min > maxSideLength) maxSideLength = {var}max - {var}min ;",{indent:4})}

    currentInCache = 0;
    root = newNode();
    ${t("root.min_{var} = {var}min;",{indent:4})}
    ${t("root.max_{var} = {var}min + maxSideLength;",{indent:4})}

    i = bodies.length - 1;
    if (i >= 0) {
      root.body = bodies[i];
    }
    while (i--) {
      insert(bodies[i], root);
    }
  }

  function insert(newBody) {
    insertStack.reset();
    insertStack.push(root, newBody);

    while (!insertStack.isEmpty()) {
      var stackItem = insertStack.pop();
      var node = stackItem.node;
      var body = stackItem.body;

      if (!node.body) {
        // This is internal node. Update the total mass of the node and center-of-mass.
        ${t("var {var} = body.pos.{var};",{indent:8})}
        node.mass += body.mass;
        ${t("node.mass_{var} += body.mass * {var};",{indent:8})}

        // Recursively insert the body in the appropriate quadrant.
        // But first find the appropriate quadrant.
        var quadIdx = 0; // Assume we are in the 0's quad.
        ${t("var min_{var} = node.min_{var};",{indent:8})}
        ${t("var max_{var} = (min_{var} + node.max_{var}) / 2;",{indent:8})}

${r(8)}

        var child = getChild(node, quadIdx);

        if (!child) {
          // The node is internal but this quadrant is not taken. Add
          // subnode to it.
          child = newNode();
          ${t("child.min_{var} = min_{var};",{indent:10})}
          ${t("child.max_{var} = max_{var};",{indent:10})}
          child.body = body;

          setChild(node, quadIdx, child);
        } else {
          // continue searching in this quadrant.
          insertStack.push(child, body);
        }
      } else {
        // We are trying to add to the leaf node.
        // We have to convert current leaf into internal node
        // and continue adding two nodes.
        var oldBody = node.body;
        node.body = null; // internal nodes do not cary bodies

        if (isSamePosition(oldBody.pos, body.pos)) {
          // Prevent infinite subdivision by bumping one node
          // anywhere in this quadrant
          var retriesCount = 3;
          do {
            var offset = random.nextDouble();
            ${t("var d{var} = (node.max_{var} - node.min_{var}) * offset;",{indent:12})}

            ${t("oldBody.pos.{var} = node.min_{var} + d{var};",{indent:12})}
            retriesCount -= 1;
            // Make sure we don't bump it out of the box. If we do, next iteration should fix it
          } while (retriesCount > 0 && isSamePosition(oldBody.pos, body.pos));

          if (retriesCount === 0 && isSamePosition(oldBody.pos, body.pos)) {
            // This is very bad, we ran out of precision.
            // if we do not return from the method we'll get into
            // infinite loop here. So we sacrifice correctness of layout, and keep the app running
            // Next layout iteration should get larger bounding box in the first step and fix this
            return;
          }
        }
        // Next iteration should subdivide node further.
        insertStack.push(node, oldBody);
        insertStack.push(node, body);
      }
    }
  }
}
return createQuadTree;

`;function r(a){let l=[],c=Array(a+1).join(" ");for(let u=0;u<e;++u)l.push(c+`if (${wi(u)} > max_${wi(u)}) {`),l.push(c+`  quadIdx = quadIdx + ${Math.pow(2,u)};`),l.push(c+`  min_${wi(u)} = max_${wi(u)};`),l.push(c+`  max_${wi(u)} = node.max_${wi(u)};`),l.push(c+"}");return l.join(`
`)}function s(){let a=Array(11).join(" "),l=[];for(let c=0;c<n;++c)l.push(a+`if (node.quad${c}) {`),l.push(a+`  queue[pushIdx] = node.quad${c};`),l.push(a+"  queueLength += 1;"),l.push(a+"  pushIdx += 1;"),l.push(a+"}");return l.join(`
`)}function o(a){let l=[];for(let c=0;c<n;++c)l.push(`${a}quad${c} = null;`);return l.join(`
`)}}function u_(e){let t=$u(e);return`
  function isSamePosition(point1, point2) {
    ${t("var d{var} = Math.abs(point1.{var} - point2.{var});",{indent:2})}
  
    return ${t("d{var} < 1e-8",{join:" && "})};
  }  
`}function f_(e){var t=Math.pow(2,e);return`
function setChild(node, idx, child) {
  ${n()}
}`;function n(){let i=[];for(let r=0;r<t;++r){let s=r===0?"  ":"  else ";i.push(`${s}if (idx === ${r}) node.quad${r} = child;`)}return i.join(`
`)}}function d_(e){return`function getChild(node, idx) {
${t()}
  return null;
}`;function t(){let n=[],i=Math.pow(2,e);for(let r=0;r<i;++r)n.push(`  if (idx === ${r}) return node.quad${r};`);return n.join(`
`)}}function p_(e){let t=$u(e),n=Math.pow(2,e);var i=`
function QuadNode() {
  // body stored inside this node. In quad tree only leaf nodes (by construction)
  // contain bodies:
  this.body = null;

  // Child nodes are stored in quads. Each quad is presented by number:
  // 0 | 1
  // -----
  // 2 | 3
${r("  this.")}

  // Total mass of current node
  this.mass = 0;

  // Center of mass coordinates
  ${t("this.mass_{var} = 0;",{indent:2})}

  // bounding box coordinates
  ${t("this.min_{var} = 0;",{indent:2})}
  ${t("this.max_{var} = 0;",{indent:2})}
}
`;return i;function r(s){let o=[];for(let a=0;a<n;++a)o.push(`${s}quad${a} = null;`);return o.join(`
`)}}function m_(){return`
/**
 * Our implementation of QuadTree is non-recursive to avoid GC hit
 * This data structure represent stack of elements
 * which we are trying to insert into quad tree.
 */
function InsertStack () {
    this.stack = [];
    this.popIdx = 0;
}

InsertStack.prototype = {
    isEmpty: function() {
        return this.popIdx === 0;
    },
    push: function (node, body) {
        var item = this.stack[this.popIdx];
        if (!item) {
            // we are trying to avoid memory pressure: create new element
            // only when absolutely necessary
            this.stack[this.popIdx] = new InsertStackElement(node, body);
        } else {
            item.node = node;
            item.body = body;
        }
        ++this.popIdx;
    },
    pop: function () {
        if (this.popIdx > 0) {
            return this.stack[--this.popIdx];
        }
    },
    reset: function () {
        this.popIdx = 0;
    }
};

function InsertStackElement(node, body) {
    this.node = node; // QuadTree node
    this.body = body; // physical body which needs to be inserted to node
}
`}});var v_=sn(function(tN,Zu){Zu.exports=zw;Zu.exports.generateFunctionBody=__;var kw=or();function zw(e){let t=__(e);return Function("bodies","settings","random",t)}function __(e){let t=kw(e);return`
  var boundingBox = {
    ${t("min_{var}: 0, max_{var}: 0,",{indent:4})}
  };

  return {
    box: boundingBox,

    update: updateBoundingBox,

    reset: resetBoundingBox,

    getBestNewPosition: function (neighbors) {
      var ${t("base_{var} = 0",{join:", "})};

      if (neighbors.length) {
        for (var i = 0; i < neighbors.length; ++i) {
          let neighborPos = neighbors[i].pos;
          ${t("base_{var} += neighborPos.{var};",{indent:10})}
        }

        ${t("base_{var} /= neighbors.length;",{indent:8})}
      } else {
        ${t("base_{var} = (boundingBox.min_{var} + boundingBox.max_{var}) / 2;",{indent:8})}
      }

      var springLength = settings.springLength;
      return {
        ${t("{var}: base_{var} + (random.nextDouble() - 0.5) * springLength,",{indent:8})}
      };
    }
  };

  function updateBoundingBox() {
    var i = bodies.length;
    if (i === 0) return; // No bodies - no borders.

    ${t("var max_{var} = -Infinity;",{indent:4})}
    ${t("var min_{var} = Infinity;",{indent:4})}

    while(i--) {
      // this is O(n), it could be done faster with quadtree, if we check the root node bounds
      var bodyPos = bodies[i].pos;
      ${t("if (bodyPos.{var} < min_{var}) min_{var} = bodyPos.{var};",{indent:6})}
      ${t("if (bodyPos.{var} > max_{var}) max_{var} = bodyPos.{var};",{indent:6})}
    }

    ${t("boundingBox.min_{var} = min_{var};",{indent:4})}
    ${t("boundingBox.max_{var} = max_{var};",{indent:4})}
  }

  function resetBoundingBox() {
    ${t("boundingBox.min_{var} = boundingBox.max_{var} = 0;",{indent:4})}
  }
`}});var x_=sn(function(nN,Ju){var Gw=or();Ju.exports=Hw;Ju.exports.generateCreateDragForceFunctionBody=y_;function Hw(e){let t=y_(e);return Function("options",t)}function y_(e){return`
  if (!Number.isFinite(options.dragCoefficient)) throw new Error('dragCoefficient is not a finite number');

  return {
    update: function(body) {
      ${Gw(e)("body.force.{var} -= options.dragCoefficient * body.velocity.{var};",{indent:6})}
    }
  };
`}});var S_=sn(function(iN,Ku){var Vw=or();Ku.exports=Ww;Ku.exports.generateCreateSpringForceFunctionBody=b_;function Ww(e){let t=b_(e);return Function("options","random",t)}function b_(e){let t=Vw(e);return`
  if (!Number.isFinite(options.springCoefficient)) throw new Error('Spring coefficient is not a number');
  if (!Number.isFinite(options.springLength)) throw new Error('Spring length is not a number');

  return {
    /**
     * Updates forces acting on a spring
     */
    update: function (spring) {
      var body1 = spring.from;
      var body2 = spring.to;
      var length = spring.length < 0 ? options.springLength : spring.length;
      ${t("var d{var} = body2.pos.{var} - body1.pos.{var};",{indent:6})}
      var r = Math.sqrt(${t("d{var} * d{var}",{join:" + "})});

      if (r === 0) {
        ${t("d{var} = (random.nextDouble() - 0.5) / 50;",{indent:8})}
        r = Math.sqrt(${t("d{var} * d{var}",{join:" + "})});
      }

      var d = r - length;
      var coefficient = ((spring.coefficient > 0) ? spring.coefficient : options.springCoefficient) * d / r;

      ${t("body1.force.{var} += coefficient * d{var}",{indent:6})};
      body1.springCount += 1;
      body1.springLength += r;

      ${t("body2.force.{var} -= coefficient * d{var}",{indent:6})};
      body2.springCount += 1;
      body2.springLength += r;
    }
  };
`}});var w_=sn(function(rN,Qu){var Xw=or();Qu.exports=qw;Qu.exports.generateIntegratorFunctionBody=M_;function qw(e){let t=M_(e);return Function("bodies","timeStep","adaptiveTimeStepWeight",t)}function M_(e){let t=Xw(e);return`
  var length = bodies.length;
  if (length === 0) return 0;

  ${t("var d{var} = 0, t{var} = 0;",{indent:2})}

  for (var i = 0; i < length; ++i) {
    var body = bodies[i];
    if (body.isPinned) continue;

    if (adaptiveTimeStepWeight && body.springCount) {
      timeStep = (adaptiveTimeStepWeight * body.springLength/body.springCount);
    }

    var coeff = timeStep / body.mass;

    ${t("body.velocity.{var} += coeff * body.force.{var};",{indent:4})}
    ${t("var v{var} = body.velocity.{var};",{indent:4})}
    var v = Math.sqrt(${t("v{var} * v{var}",{join:" + "})});

    if (v > 1) {
      // We normalize it so that we move within timeStep range. 
      // for the case when v <= 1 - we let velocity to fade out.
      ${t("body.velocity.{var} = v{var} / v;",{indent:6})}
    }

    ${t("d{var} = timeStep * body.velocity.{var};",{indent:4})}

    ${t("body.pos.{var} += d{var};",{indent:4})}

    ${t("t{var} += Math.abs(d{var});",{indent:4})}
  }

  return (${t("t{var} * t{var}",{join:" + "})})/length;
`}});var E_=sn(function(sN,T_){T_.exports=jw;function jw(e,t,n,i){this.from=e,this.to=t,this.length=n,this.coefficient=i}});var R_=sn(function(oN,C_){C_.exports=A_;function A_(e,t){var n;if(!e)e={};if(t){for(n in t)if(t.hasOwnProperty(n)){var i=e.hasOwnProperty(n),r=typeof t[n],s=!i||typeof e[n]!==r;if(s)e[n]=t[n];else if(r==="object")e[n]=A_(e[n],t[n])}}return e}});var ef=sn(function(aN,P_){function Yw(e){Zw(e);let t=$w(e);return e.on=t.on,e.off=t.off,e.fire=t.fire,e}function $w(e){let t=Object.create(null);return{on:function(n,i,r){if(typeof i!="function")throw Error("callback is expected to be a function");let s=t[n];return s||(s=t[n]=[]),s.push({callback:i,ctx:r}),e},off:function(n,i){if(typeof n>"u")return t=Object.create(null),e;if(t[n])if(typeof i!="function")delete t[n];else{let r=t[n];for(let s=0;s<r.length;++s)r[s].callback===i&&r.splice(s,1)}return e},fire:function(n){let i=t[n];if(!i)return e;let r;arguments.length>1&&(r=Array.prototype.slice.call(arguments,1));for(let s=0;s<i.length;++s){let o=i[s];o.callback.apply(o.ctx,r)}return e}}}function Zw(e){if(!e)throw Error("Eventify cannot use falsy object as events subject");let t=["on","fire","off"];for(let n=0;n<t.length;++n)if(e.hasOwnProperty(t[n]))throw Error("Subject cannot be eventified, since it already has property '"+t[n]+"'")}P_.exports=Yw});var L_=sn(function(lN,Qa){Qa.exports=tf;Qa.exports.random=tf,Qa.exports.randomIterator=e1;function tf(e){var t=typeof e==="number"?e:+new Date;return new ar(t)}function ar(e){this.seed=e}ar.prototype.next=Qw;ar.prototype.nextDouble=nf;ar.prototype.uniform=nf;ar.prototype.gaussian=Jw;ar.prototype.random=nf;function Jw(){var e,t,n;do t=this.nextDouble()*2-1,n=this.nextDouble()*2-1,e=t*t+n*n;while(e>=1||e===0);return t*Math.sqrt(-2*Math.log(e)/e)}ar.prototype.levy=Kw;function Kw(){var e=1.5,t=Math.pow(I_(1+e)*Math.sin(Math.PI*e/2)/(I_((1+e)/2)*e*Math.pow(2,(e-1)/2)),1/e);return this.gaussian()*t/Math.pow(Math.abs(this.gaussian()),1/e)}function I_(e){return Math.sqrt(2*Math.PI/e)*Math.pow(1/Math.E*(e+1/(12*e-1/(10*e))),e)}function nf(){var e=this.seed;return e=e+2127912214+(e<<12)&4294967295,e=(e^3345072700^e>>>19)&4294967295,e=e+374761393+(e<<5)&4294967295,e=(e+3550635116^e<<9)&4294967295,e=e+4251993797+(e<<3)&4294967295,e=(e^3042594569^e>>>16)&4294967295,this.seed=e,(e&268435455)/268435456}function Qw(e){return Math.floor(this.nextDouble()*e)}function e1(e,t){var n=t||tf();if(typeof n.next!=="function")throw Error("customRandom does not match expected API: next() function is missing");return{forEach:r,shuffle:i};function i(){var s,o,a;for(s=e.length-1;s>0;--s)o=n.next(s+1),a=e[o],e[o]=e[s],e[s]=a;return e}function r(s){var o,a,l;for(o=e.length-1;o>0;--o)a=n.next(o+1),l=e[a],e[a]=e[o],e[o]=l,s(l);if(e.length)s(e[0])}}});var rf=sn(function(cN,N_){N_.exports=a1;var t1=c_(),n1=g_(),i1=v_(),r1=x_(),s1=S_(),o1=w_(),D_={};function a1(e){var t=E_(),n=R_(),i=ef();if(e){if(e.springCoeff!==void 0)throw Error("springCoeff was renamed to springCoefficient");if(e.dragCoeff!==void 0)throw Error("dragCoeff was renamed to dragCoefficient")}e=n(e,{springLength:10,springCoefficient:0.8,gravity:-12,theta:0.8,dragCoefficient:0.9,timeStep:0.5,adaptiveTimeStepWeight:0,dimensions:2,debug:!1});var r=D_[e.dimensions];if(!r){var s=e.dimensions;r={Body:t1(s,e.debug),createQuadTree:n1(s),createBounds:i1(s),createDragForce:r1(s),createSpringForce:s1(s),integrate:o1(s)},D_[s]=r}var o=r.Body,a=r.createQuadTree,l=r.createBounds,c=r.createDragForce,u=r.createSpringForce,f=r.integrate,h=(I)=>new o(I),d=L_().random(42),g=[],_=[],m=a(e,d),p=l(g,e,d),x=u(e,d),S=c(e),v=0,b=[],w=new Map,E=0;N("nbody",W),N("spring",R);var y={bodies:g,quadTree:m,springs:_,settings:e,addForce:N,removeForce:P,getForces:D,step:function(){for(var I=0;I<b.length;++I)b[I](E);var k=f(g,e.timeStep,e.adaptiveTimeStepWeight);return E+=1,k},addBody:function(I){if(!I)throw Error("Body is required");return g.push(I),I},addBodyAt:function(I){if(!I)throw Error("Body position is required");var k=h(I);return g.push(k),k},removeBody:function(I){if(!I)return;var k=g.indexOf(I);if(k<0)return;if(g.splice(k,1),g.length===0)p.reset();return!0},addSpring:function(I,k,z,te){if(!I||!k)throw Error("Cannot add null spring to force simulator");if(typeof z!=="number")z=-1;var Y=new t(I,k,z,te>=0?te:-1);return _.push(Y),Y},getTotalMovement:function(){return v},removeSpring:function(I){if(!I)return;var k=_.indexOf(I);if(k>-1)return _.splice(k,1),!0},getBestNewBodyPosition:function(I){return p.getBestNewPosition(I)},getBBox:A,getBoundingBox:A,invalidateBBox:function(){console.warn("invalidateBBox() is deprecated, bounds always recomputed on `getBBox()` call")},gravity:function(I){if(I!==void 0)return e.gravity=I,m.options({gravity:I}),this;else return e.gravity},theta:function(I){if(I!==void 0)return e.theta=I,m.options({theta:I}),this;else return e.theta},random:d};return l1(e,y),i(y),y;function A(){return p.update(),p.box}function N(I,k){if(w.has(I))throw Error("Force "+I+" is already added");w.set(I,k),b.push(k)}function P(I){var k=b.indexOf(w.get(I));if(k<0)return;b.splice(k,1),w.delete(I)}function D(){return w}function W(){if(g.length===0)return;m.insertBodies(g);var I=g.length;while(I--){var k=g[I];if(!k.isPinned)k.reset(),m.updateBodyForce(k),S.update(k)}}function R(){var I=_.length;while(I--)x.update(_[I])}}function l1(e,t){for(var n in e)c1(e,t,n)}function c1(e,t,n){if(!e.hasOwnProperty(n))return;if(typeof t[n]==="function")return;var i=Number.isFinite(e[n]);if(i)t[n]=function(r){if(r!==void 0){if(!Number.isFinite(r))throw Error("Value of "+n+" should be a valid number.");return e[n]=r,t}return e[n]};else t[n]=function(r){if(r!==void 0)return e[n]=r,t;return e[n]}}});var O_=sn(function(hN,sf){sf.exports=u1;sf.exports.simulator=rf();var h1=ef();function u1(e,t){if(!e)throw Error("Graph structure cannot be undefined");var n=t&&t.createSimulator||rf(),i=n(t);if(Array.isArray(t))throw Error("Physics settings is expected to be an object");var r=e.version>19?W:D;if(t&&typeof t.nodeMass==="function")r=t.nodeMass;var s=new Map,o={},a=0,l=i.settings.springTransform||f1;S(),m();var c=!1,u={step:function(){if(a===0)return f(!0),!0;var R=i.step();u.lastMove=R,u.fire("step");var I=R/a,k=I<=0.01;return f(k),k},getNodePosition:function(R){return P(R).pos},setNodePosition:function(R){var I=P(R);I.setPosition.apply(I,Array.prototype.slice.call(arguments,1))},getLinkPosition:function(R){var I=o[R];if(I)return{from:I.from.pos,to:I.to.pos}},getGraphRect:function(){return i.getBBox()},forEachBody:h,pinNode:function(R,I){var k=P(R.id);k.isPinned=!!I},isNodePinned:function(R){return P(R.id).isPinned},dispose:function(){e.off("changed",x),u.fire("disposed")},getBody:_,getSpring:g,getForceVectorLength:d,simulator:i,graph:e,lastMove:0};return h1(u),u;function f(R){if(c!==R)c=R,p(R)}function h(R){s.forEach(R)}function d(){var R=0,I=0;return h(function(k){R+=Math.abs(k.force.x),I+=Math.abs(k.force.y)}),Math.sqrt(R*R+I*I)}function g(R,I){var k;if(I===void 0)if(typeof R!=="object")k=R;else k=R.id;else{var z=e.hasLink(R,I);if(!z)return;k=z.id}return o[k]}function _(R){return s.get(R)}function m(){e.on("changed",x)}function p(R){u.fire("stable",R)}function x(R){for(var I=0;I<R.length;++I){var k=R[I];if(k.changeType==="add"){if(k.node)v(k.node.id);if(k.link)w(k.link)}else if(k.changeType==="remove"){if(k.node)b(k.node);if(k.link)E(k.link)}}a=e.getNodesCount()}function S(){a=0,e.forEachNode(function(R){v(R.id),a+=1}),e.forEachLink(w)}function v(R){var I=s.get(R);if(!I){var k=e.getNode(R);if(!k)throw Error("initBody() was called with unknown node id");var z=k.position;if(!z){var te=y(k);z=i.getBestNewBodyPosition(te)}if(I=i.addBodyAt(z),I.id=R,s.set(R,I),A(R),N(k))I.isPinned=!0}}function b(R){var I=R.id,k=s.get(I);if(k)s.delete(I),i.removeBody(k)}function w(R){A(R.fromId),A(R.toId);var I=s.get(R.fromId),k=s.get(R.toId),z=i.addSpring(I,k,R.length);l(R,z),o[R.id]=z}function E(R){var I=o[R.id];if(I){var k=e.getNode(R.fromId),z=e.getNode(R.toId);if(k)A(k.id);if(z)A(z.id);delete o[R.id],i.removeSpring(I)}}function y(R){var I=[];if(!R.links)return I;var k=Math.min(R.links.length,2);for(var z=0;z<k;++z){var te=R.links[z],Y=te.fromId!==R.id?s.get(te.fromId):s.get(te.toId);if(Y&&Y.pos)I.push(Y)}return I}function A(R){var I=s.get(R);if(I.mass=r(R),Number.isNaN(I.mass))throw Error("Node mass should be a number")}function N(R){return R&&(R.isPinned||R.data&&R.data.isPinned)}function P(R){var I=s.get(R);if(!I)v(R),I=s.get(R);return I}function D(R){var I=e.getLinks(R);if(!I)return 1;return 1+I.length/3}function W(R){var I=e.getLinks(R);if(!I)return 1;return 1+I.size/3}}function f1(){}});var oa="186",Mt={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},xn={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},Dp=0,pc=1,Np=2;var Ss=1,Op=2,Or=3,Ur=0,qt=1,Rn=2,bn=0,Fr=1,Br=2,mc=3,gc=4,Up=5;var kr=100,Fp=101,Bp=102,kp=103,zp=104,Gp=200,Hp=201,Vp=202,Wp=203,Xp=204,qp=205,jp=206,Yp=207,$p=208,Zp=209,Jp=210,Kp=211,Qp=212,em=213,tm=214,nm=0,im=1,rm=2,_c=3,sm=4,om=5,am=6,lm=7,cm=0,hm=1,um=2,Pn=0,Ms=1,ws=2,Ts=3,Es=4,As=5,Cs=6,Rs=7;var zr=301,Gi=302,aa=303,la=304,Ps=306,fm=1000,ca=1001,dm=1002,yi=1003,pm=1004;var Is=1005;var an=1006,ha=1007;var Hi=1008;var In=1009,mm=1010,gm=1011,Ls=1012,vc=1013,xi=1014,ri=1015,jt=1016,yc=1017,xc=1018,Gr=1020,_m=35902,vm=35899,ym=1021,xm=1022,Hn=1023,Vi=1026,Wi=1027,bm=1028,bc=1029,Xi=1030,Sc=1031;var Mc=1033,ua=33776,fa=33777,da=33778,pa=33779,wc=35840,Tc=35841,Ec=35842,Ac=35843,Cc=36196,Rc=37492,Pc=37496,Ic=37488,Lc=37489,ma=37490,Dc=37491,Nc=37808,Oc=37809,Uc=37810,Fc=37811,Bc=37812,kc=37813,zc=37814,Gc=37815,Hc=37816,Vc=37817,Wc=37818,Xc=37819,qc=37820,jc=37821,Yc=36492,$c=36494,Zc=36495,Jc=36283,Kc=36284,ga=36285,Qc=36286;var eh=0,Sm=1,qi="",ji="srgb",th="srgb-linear",nh="linear",lt="srgb";var Mm=512,wm=513,Tm=514,_a=515,Em=516,Am=517,va=518,Cm=519;var ih="300 es",rh=2000;function Mv(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function wv(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function Lr(e){return document.createElementNS("http://www.w3.org/1999/xhtml",e)}function Rm(){let e=Lr("canvas");return e.style.display="block",e}var Qd={},Dr=null;function xs(...e){let t="THREE."+e.shift();if(Dr)Dr("log",t,...e);else console.log(t,...e)}function Pm(e){let t=e[0];if(typeof t==="string"&&t.startsWith("TSL:")){let n=e[1];if(n&&n.isStackTrace)e[0]+=" "+n.getLocation();else e[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return e}function Ie(...e){e=Pm(e);let t="THREE."+e.shift();if(Dr)Dr("warn",t,...e);else{let n=e[0];if(n&&n.isStackTrace)console.warn(n.getError(t));else console.warn(t,...e)}}function Ne(...e){e=Pm(e);let t="THREE."+e.shift();if(Dr)Dr("error",t,...e);else{let n=e[0];if(n&&n.isStackTrace)console.error(n.getError(t));else console.error(t,...e)}}function zi(...e){let t=e.join(" ");if(t in Qd)return;Qd[t]=!0,Ie(...e)}function Im(e,t,n){return new Promise(function(i,r){function s(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:r();break;case e.TIMEOUT_EXPIRED:setTimeout(s,n);break;default:i()}}setTimeout(s,n)})}var Lm={[0]:1,[2]:6,[4]:7,[3]:5,[1]:0,[6]:2,[7]:4,[5]:3};class Vn{addEventListener(e,t){if(this._listeners===void 0)this._listeners={};let n=this._listeners;if(n[e]===void 0)n[e]=[];if(n[e].indexOf(t)===-1)n[e].push(t)}hasEventListener(e,t){let n=this._listeners;if(n===void 0)return!1;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let i=n[e];if(i!==void 0){let r=i.indexOf(t);if(r!==-1)i.splice(r,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let r=0,s=i.length;r<s;r++)i[r].call(this,e);e.target=null}}}var Wt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],ep=1234567,gs=Math.PI/180,Nr=180/Math.PI;function ni(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Wt[e&255]+Wt[e>>8&255]+Wt[e>>16&255]+Wt[e>>24&255]+"-"+Wt[t&255]+Wt[t>>8&255]+"-"+Wt[t>>16&15|64]+Wt[t>>24&255]+"-"+Wt[n&63|128]+Wt[n>>8&255]+"-"+Wt[n>>16&255]+Wt[n>>24&255]+Wt[i&255]+Wt[i>>8&255]+Wt[i>>16&255]+Wt[i>>24&255]).toLowerCase()}function He(e,t,n){return Math.max(t,Math.min(n,e))}function sh(e,t){return(e%t+t)%t}function Tv(e,t,n,i,r){return i+(e-t)*(r-i)/(n-t)}function Ev(e,t,n){if(e!==t)return(n-e)/(t-e);else return 0}function _s(e,t,n){return(1-n)*e+n*t}function Av(e,t,n,i){return _s(e,t,1-Math.exp(-n*i))}function Cv(e,t=1){return t-Math.abs(sh(e,t*2)-t)}function Rv(e,t,n){if(e<=t)return 0;if(e>=n)return 1;return e=(e-t)/(n-t),e*e*(3-2*e)}function Pv(e,t,n){if(e<=t)return 0;if(e>=n)return 1;return e=(e-t)/(n-t),e*e*e*(e*(e*6-15)+10)}function Iv(e,t){return e+Math.floor(Math.random()*(t-e+1))}function Lv(e,t){return e+Math.random()*(t-e)}function Dv(e){return e*(0.5-Math.random())}function Nv(e){if(e!==void 0)ep=e;let t=ep+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Ov(e){return e*gs}function Uv(e){return e*Nr}function Fv(e){return e>0&&Number.isInteger(e)&&2**Math.round(Math.log2(e))===e}function Bv(e){return Math.pow(2,Math.ceil(Math.log(e)/Math.LN2))}function kv(e){return Math.pow(2,Math.floor(Math.log(e)/Math.LN2))}function zv(e,t,n,i,r){let{cos:s,sin:o}=Math,a=s(n/2),l=o(n/2),c=s((t+i)/2),u=o((t+i)/2),f=s((t-i)/2),h=o((t-i)/2),d=s((i-t)/2),g=o((i-t)/2);switch(r){case"XYX":e.set(a*u,l*f,l*h,a*c);break;case"YZY":e.set(l*h,a*u,l*f,a*c);break;case"ZXZ":e.set(l*f,l*h,a*u,a*c);break;case"XZX":e.set(a*u,l*g,l*d,a*c);break;case"YXY":e.set(l*d,a*u,l*g,a*c);break;case"ZYZ":e.set(l*g,l*d,a*u,a*c);break;default:Ie("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function Cn(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:case Uint8ClampedArray:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw Error("THREE.MathUtils: Invalid component type.")}}function ot(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw Error("THREE.MathUtils: Invalid component type.")}}var Hr={DEG2RAD:gs,RAD2DEG:Nr,generateUUID:ni,clamp:He,euclideanModulo:sh,mapLinear:Tv,inverseLerp:Ev,lerp:_s,damp:Av,pingpong:Cv,smoothstep:Rv,smootherstep:Pv,randInt:Iv,randFloat:Lv,randFloatSpread:Dv,seededRandom:Nv,degToRad:Ov,radToDeg:Uv,isPowerOfTwo:Fv,ceilPowerOfTwo:Bv,floorPowerOfTwo:kv,setQuaternionFromProperEuler:zv,normalize:ot,denormalize:Cn};class ne{static{ne.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),r=this.x-e.x,s=this.y-e.y;return this.x=r*n-s*i+e.x,this.y=r*i+s*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Gt{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,r,s,o){let a=n[i+0],l=n[i+1],c=n[i+2],u=n[i+3],f=r[s+0],h=r[s+1],d=r[s+2],g=r[s+3];if(u!==g||a!==f||l!==h||c!==d){let _=a*f+l*h+c*d+u*g;if(_<0)f=-f,h=-h,d=-d,g=-g,_=-_;let m=1-o;if(_<0.9995){let p=Math.acos(_),x=Math.sin(p);m=Math.sin(m*p)/x,o=Math.sin(o*p)/x,a=a*m+f*o,l=l*m+h*o,c=c*m+d*o,u=u*m+g*o}else{a=a*m+f*o,l=l*m+h*o,c=c*m+d*o,u=u*m+g*o;let p=1/Math.sqrt(a*a+l*l+c*c+u*u);a*=p,l*=p,c*=p,u*=p}}e[t]=a,e[t+1]=l,e[t+2]=c,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,i,r,s){let o=n[i],a=n[i+1],l=n[i+2],c=n[i+3],u=r[s],f=r[s+1],h=r[s+2],d=r[s+3];return e[t]=o*d+c*u+a*h-l*f,e[t+1]=a*d+c*f+l*u-o*h,e[t+2]=l*d+c*h+o*f-a*u,e[t+3]=c*d-o*u-a*f-l*h,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let{_x:n,_y:i,_z:r,_order:s}=e,{cos:o,sin:a}=Math,l=o(n/2),c=o(i/2),u=o(r/2),f=a(n/2),h=a(i/2),d=a(r/2);switch(s){case"XYZ":this._x=f*c*u+l*h*d,this._y=l*h*u-f*c*d,this._z=l*c*d+f*h*u,this._w=l*c*u-f*h*d;break;case"YXZ":this._x=f*c*u+l*h*d,this._y=l*h*u-f*c*d,this._z=l*c*d-f*h*u,this._w=l*c*u+f*h*d;break;case"ZXY":this._x=f*c*u-l*h*d,this._y=l*h*u+f*c*d,this._z=l*c*d+f*h*u,this._w=l*c*u-f*h*d;break;case"ZYX":this._x=f*c*u-l*h*d,this._y=l*h*u+f*c*d,this._z=l*c*d-f*h*u,this._w=l*c*u+f*h*d;break;case"YZX":this._x=f*c*u+l*h*d,this._y=l*h*u+f*c*d,this._z=l*c*d-f*h*u,this._w=l*c*u-f*h*d;break;case"XZY":this._x=f*c*u-l*h*d,this._y=l*h*u-f*c*d,this._z=l*c*d+f*h*u,this._w=l*c*u+f*h*d;break;default:Ie("Quaternion: .setFromEuler() encountered an unknown order: "+s)}if(t===!0)this._onChangeCallback();return this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],r=t[8],s=t[1],o=t[5],a=t[9],l=t[2],c=t[6],u=t[10],f=n+o+u;if(f>0){let h=0.5/Math.sqrt(f+1);this._w=0.25/h,this._x=(c-a)*h,this._y=(r-l)*h,this._z=(s-i)*h}else if(n>o&&n>u){let h=2*Math.sqrt(1+n-o-u);this._w=(c-a)/h,this._x=0.25*h,this._y=(i+s)/h,this._z=(r+l)/h}else if(o>u){let h=2*Math.sqrt(1+o-n-u);this._w=(r-l)/h,this._x=(i+s)/h,this._y=0.25*h,this._z=(a+c)/h}else{let h=2*Math.sqrt(1+u-n-o);this._w=(s-i)/h,this._x=(r+l)/h,this._y=(a+c)/h,this._z=0.25*h}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;if(n<0.00000001)if(n=0,Math.abs(e.x)>Math.abs(e.z))this._x=-e.y,this._y=e.x,this._z=0,this._w=n;else this._x=0,this._y=-e.z,this._z=e.y,this._w=n;else this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n;return this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(He(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();if(e===0)this._x=0,this._y=0,this._z=0,this._w=1;else e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e;return this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let{_x:n,_y:i,_z:r,_w:s}=e,{_x:o,_y:a,_z:l,_w:c}=t;return this._x=n*c+s*o+i*l-r*a,this._y=i*c+s*a+r*o-n*l,this._z=r*c+s*l+n*a-i*o,this._w=s*c-n*o-i*a-r*l,this._onChangeCallback(),this}slerp(e,t){let{_x:n,_y:i,_z:r,_w:s}=e,o=this.dot(e);if(o<0)n=-n,i=-i,r=-r,s=-s,o=-o;let a=1-t;if(o<0.9995){let l=Math.acos(o),c=Math.sin(l);a=Math.sin(a*l)/c,t=Math.sin(t*l)/c,this._x=this._x*a+n*t,this._y=this._y*a+i*t,this._z=this._z*a+r*t,this._w=this._w*a+s*t,this._onChangeCallback()}else this._x=this._x*a+n*t,this._y=this._y*a+i*t,this._z=this._z*a+r*t,this._w=this._w*a+s*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class L{static{L.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){if(n===void 0)n=this.z;return this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(tp.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(tp.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*i,this.y=r[1]*t+r[4]*n+r[7]*i,this.z=r[2]*t+r[5]*n+r[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=e.elements,s=1/(r[3]*t+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*i+r[12])*s,this.y=(r[1]*t+r[5]*n+r[9]*i+r[13])*s,this.z=(r[2]*t+r[6]*n+r[10]*i+r[14])*s,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,{x:r,y:s,z:o,w:a}=e,l=2*(s*i-o*n),c=2*(o*t-r*i),u=2*(r*n-s*t);return this.x=t+a*l+s*u-o*c,this.y=n+a*c+o*l-r*u,this.z=i+a*u+r*c-s*l,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*i,this.y=r[1]*t+r[5]*n+r[9]*i,this.z=r[2]*t+r[6]*n+r[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let{x:n,y:i,z:r}=e,{x:s,y:o,z:a}=t;return this.x=i*a-r*o,this.y=r*s-n*a,this.z=n*o-i*s,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return zl.copy(this).projectOnVector(e),this.sub(zl)}reflect(e){return this.sub(zl.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}var zl=new L,tp=new Gt;class Be{static{Be.prototype.isMatrix3=!0}constructor(e,t,n,i,r,s,o,a,l){if(this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0)this.set(e,t,n,i,r,s,o,a,l)}set(e,t,n,i,r,s,o,a,l){let c=this.elements;return c[0]=e,c[1]=i,c[2]=o,c[3]=t,c[4]=r,c[5]=a,c[6]=n,c[7]=s,c[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,s=n[0],o=n[3],a=n[6],l=n[1],c=n[4],u=n[7],f=n[2],h=n[5],d=n[8],g=i[0],_=i[3],m=i[6],p=i[1],x=i[4],S=i[7],v=i[2],b=i[5],w=i[8];return r[0]=s*g+o*p+a*v,r[3]=s*_+o*x+a*b,r[6]=s*m+o*S+a*w,r[1]=l*g+c*p+u*v,r[4]=l*_+c*x+u*b,r[7]=l*m+c*S+u*w,r[2]=f*g+h*p+d*v,r[5]=f*_+h*x+d*b,r[8]=f*m+h*S+d*w,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],s=e[4],o=e[5],a=e[6],l=e[7],c=e[8];return t*s*c-t*o*l-n*r*c+n*o*a+i*r*l-i*s*a}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],s=e[4],o=e[5],a=e[6],l=e[7],c=e[8],u=c*s-o*l,f=o*a-c*r,h=l*r-s*a,d=t*u+n*f+i*h;if(d===0)return this.set(0,0,0,0,0,0,0,0,0);let g=1/d;return e[0]=u*g,e[1]=(i*l-c*n)*g,e[2]=(o*n-i*s)*g,e[3]=f*g,e[4]=(c*t-i*a)*g,e[5]=(i*r-o*t)*g,e[6]=h*g,e[7]=(n*a-l*t)*g,e[8]=(s*t-n*r)*g,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,r,s,o){let a=Math.cos(r),l=Math.sin(r);return this.set(n*a,n*l,-n*(a*s+l*o)+s+e,-i*l,i*a,-i*(-l*s+a*o)+o+t,0,0,1),this}scale(e,t){return zi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Gl.makeScale(e,t)),this}rotate(e){return zi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Gl.makeRotation(-e)),this}translate(e,t){return zi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Gl.makeTranslation(e,t)),this}makeTranslation(e,t){if(e.isVector2)this.set(1,0,e.x,0,1,e.y,0,0,1);else this.set(1,0,e,0,1,t,0,0,1);return this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}var Gl=new Be,np=new Be().set(0.4123908,0.3575843,0.1804808,0.212639,0.7151687,0.0721923,0.0193308,0.1191948,0.9505322),ip=new Be().set(3.2409699,-1.5373832,-0.4986108,-0.9692436,1.8759675,0.0415551,0.0556301,-0.203977,1.0569715);function Gv(){let e={enabled:!0,workingColorSpace:"srgb-linear",spaces:{},convert:function(r,s,o){if(this.enabled===!1||s===o||!s||!o)return r;if(this.spaces[s].transfer==="srgb")r.r=ii(r.r),r.g=ii(r.g),r.b=ii(r.b);if(this.spaces[s].primaries!==this.spaces[o].primaries)r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[o].fromXYZ);if(this.spaces[o].transfer==="srgb")r.r=Ir(r.r),r.g=Ir(r.g),r.b=Ir(r.b);return r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){if(r==="")return"linear";return this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,o){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return zi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),e.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return zi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),e.colorSpaceToWorking(r,s)}},t=[0.64,0.33,0.3,0.6,0.15,0.06],n=[0.2126,0.7152,0.0722],i=[0.3127,0.329];return e.define({["srgb-linear"]:{primaries:t,whitePoint:i,transfer:"linear",toXYZ:np,fromXYZ:ip,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:"srgb"},outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}},["srgb"]:{primaries:t,whitePoint:i,transfer:"srgb",toXYZ:np,fromXYZ:ip,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}}}),e}var We=Gv();function ii(e){return e<0.04045?e*0.0773993808:Math.pow(e*0.9478672986+0.0521327014,2.4)}function Ir(e){return e<0.0031308?e*12.92:1.055*Math.pow(e,0.41666)-0.055}var dr;class oh{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src))return e.src;if(typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{if(dr===void 0)dr=Lr("canvas");dr.width=e.width,dr.height=e.height;let i=dr.getContext("2d");if(e instanceof ImageData)i.putImageData(e,0,0);else i.drawImage(e,0,0,e.width,e.height);n=dr}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Lr("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let i=n.getImageData(0,0,e.width,e.height),r=i.data;for(let s=0;s<r.length;s++)r[s]=ii(r[s]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)if(t instanceof Uint8Array||t instanceof Uint8ClampedArray)t[n]=Math.floor(ii(t[n]/255)*255);else t[n]=ii(t[n]);return{data:t,width:e.width,height:e.height}}else return Ie("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}var Hv=0;class Ds{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Hv++}),this.uuid=ni(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;if(typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement)e.set(t.videoWidth,t.videoHeight,0);else if(typeof VideoFrame<"u"&&t instanceof VideoFrame)e.set(t.displayWidth,t.displayHeight,0);else if(t!==null)e.set(t.width,t.height,t.depth||0);else e.set(0,0,0);return e}set needsUpdate(e){if(e===!0)this.version++}toJSON(e){let t=e===void 0||typeof e==="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let s=0,o=i.length;s<o;s++)if(i[s].isDataTexture)r.push(Hl(i[s].image));else r.push(Hl(i[s]))}else r=Hl(i);n.url=r}if(!t)e.images[this.uuid]=n;return n}}function Hl(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap)return oh.getDataURL(e);else if(e.data)return{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name};else return Ie("Texture: Unable to serialize Texture."),{}}var Vv=0,Vl=new L;class Ft extends Vn{constructor(e=Ft.DEFAULT_IMAGE,t=Ft.DEFAULT_MAPPING,n=1001,i=1001,r=1006,s=1008,o=1023,a=1009,l=Ft.DEFAULT_ANISOTROPY,c=""){super();this.isTexture=!0,Object.defineProperty(this,"id",{value:Vv++}),this.uuid=ni(),this.name="",this.source=new Ds(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=s,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=a,this.offset=new ne(0,0),this.repeat=new ne(1,1),this.center=new ne(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Be,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=c,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=e&&e.depth&&e.depth>1?!0:!1,this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Vl).x}get height(){return this.source.getSize(Vl).y}get depth(){return this.source.getSize(Vl).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){Ie(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){Ie(`Texture.setValues(): property '${t}' does not exist.`);continue}if(i&&n&&(i.isVector2&&n.isVector2))i.copy(n);else if(i&&n&&(i.isVector3&&n.isVector3))i.copy(n);else if(i&&n&&(i.isMatrix3&&n.isMatrix3))i.copy(n);else this[t]=n}}toJSON(e){let t=e===void 0||typeof e==="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};if(Object.keys(this.userData).length>0)n.userData=this.userData;if(!t)e.textures[this.uuid]=n;return n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==300)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case 1000:e.x=e.x-Math.floor(e.x);break;case 1001:e.x=e.x<0?0:1;break;case 1002:if(Math.abs(Math.floor(e.x)%2)===1)e.x=Math.ceil(e.x)-e.x;else e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case 1000:e.y=e.y-Math.floor(e.y);break;case 1001:e.y=e.y<0?0:1;break;case 1002:if(Math.abs(Math.floor(e.y)%2)===1)e.y=Math.ceil(e.y)-e.y;else e.y=e.y-Math.floor(e.y);break}if(this.flipY)e.y=1-e.y;return e}set needsUpdate(e){if(e===!0)this.version++,this.source.needsUpdate=!0}set needsPMREMUpdate(e){if(e===!0)this.pmremVersion++}}Ft.DEFAULT_IMAGE=null;Ft.DEFAULT_MAPPING=300;Ft.DEFAULT_ANISOTROPY=1;class gt{static{gt.prototype.isVector4=!0}constructor(e=0,t=0,n=0,i=1){this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=this.w,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*i+s[12]*r,this.y=s[1]*t+s[5]*n+s[9]*i+s[13]*r,this.z=s[2]*t+s[6]*n+s[10]*i+s[14]*r,this.w=s[3]*t+s[7]*n+s[11]*i+s[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);if(t<0.0001)this.x=1,this.y=0,this.z=0;else this.x=e.x/t,this.y=e.y/t,this.z=e.z/t;return this}setAxisAngleFromRotationMatrix(e){let t,n,i,r,s=0.01,o=0.1,a=e.elements,l=a[0],c=a[4],u=a[8],f=a[1],h=a[5],d=a[9],g=a[2],_=a[6],m=a[10];if(Math.abs(c-f)<0.01&&Math.abs(u-g)<0.01&&Math.abs(d-_)<0.01){if(Math.abs(c+f)<0.1&&Math.abs(u+g)<0.1&&Math.abs(d+_)<0.1&&Math.abs(l+h+m-3)<0.1)return this.set(1,0,0,0),this;t=Math.PI;let x=(l+1)/2,S=(h+1)/2,v=(m+1)/2,b=(c+f)/4,w=(u+g)/4,E=(d+_)/4;if(x>S&&x>v)if(x<0.01)n=0,i=0.707106781,r=0.707106781;else n=Math.sqrt(x),i=b/n,r=w/n;else if(S>v)if(S<0.01)n=0.707106781,i=0,r=0.707106781;else i=Math.sqrt(S),n=b/i,r=E/i;else if(v<0.01)n=0.707106781,i=0.707106781,r=0;else r=Math.sqrt(v),n=w/r,i=E/r;return this.set(n,i,r,t),this}let p=Math.sqrt((_-d)*(_-d)+(u-g)*(u-g)+(f-c)*(f-c));if(Math.abs(p)<0.001)p=1;return this.x=(_-d)/p,this.y=(u-g)/p,this.z=(f-c)/p,this.w=Math.acos((l+h+m-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this.w=He(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this.w=He(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class ah extends Vn{constructor(e=1,t=1,n={}){super();n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:1006,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new gt(0,0,e,t),this.scissorTest=!1,this.viewport=new gt(0,0,e,t),this.textures=[];let i={width:e,height:t,depth:n.depth},r=new Ft(i),s=n.count;for(let o=0;o<s;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:1006,generateMipmaps:!1,flipY:!1,internalFormat:null};if(e.mapping!==void 0)t.mapping=e.mapping;if(e.wrapS!==void 0)t.wrapS=e.wrapS;if(e.wrapT!==void 0)t.wrapT=e.wrapT;if(e.wrapR!==void 0)t.wrapR=e.wrapR;if(e.magFilter!==void 0)t.magFilter=e.magFilter;if(e.minFilter!==void 0)t.minFilter=e.minFilter;if(e.format!==void 0)t.format=e.format;if(e.type!==void 0)t.type=e.type;if(e.anisotropy!==void 0)t.anisotropy=e.anisotropy;if(e.colorSpace!==void 0)t.colorSpace=e.colorSpace;if(e.flipY!==void 0)t.flipY=e.flipY;if(e.generateMipmaps!==void 0)t.generateMipmaps=e.generateMipmaps;if(e.internalFormat!==void 0)t.internalFormat=e.internalFormat;for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){if(this._depthTexture!==null&&this._depthTexture.renderTarget===this)this._depthTexture.renderTarget=null;if(e!==null&&e.renderTarget===null)e.renderTarget=this;this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,r=this.textures.length;i<r;i++)if(this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n,this.textures[i].isData3DTexture!==!0)this.textures[i].isArrayTexture=this.textures[i].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let i=Object.assign({},e.textures[t].image);this.textures[t].source=new Ds(i)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class It extends ah{constructor(e=1,t=1,n={}){super(e,t,n);this.isWebGLRenderTarget=!0}}class ya extends Ft{constructor(e=null,t=1,n=1,i=1){super(null);this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class lh extends Ft{constructor(e=null,t=1,n=1,i=1){super(null);this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}}class Je{static{Je.prototype.isMatrix4=!0}constructor(e,t,n,i,r,s,o,a,l,c,u,f,h,d,g,_){if(this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0)this.set(e,t,n,i,r,s,o,a,l,c,u,f,h,d,g,_)}set(e,t,n,i,r,s,o,a,l,c,u,f,h,d,g,_){let m=this.elements;return m[0]=e,m[4]=t,m[8]=n,m[12]=i,m[1]=r,m[5]=s,m[9]=o,m[13]=a,m[2]=l,m[6]=c,m[10]=u,m[14]=f,m[3]=h,m[7]=d,m[11]=g,m[15]=_,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Je().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){if(this.determinantAffine()===0)return e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this;return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,i=1/pr.setFromMatrixColumn(e,0).length(),r=1/pr.setFromMatrixColumn(e,1).length(),s=1/pr.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*s,t[9]=n[9]*s,t[10]=n[10]*s,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,{x:n,y:i,z:r}=e,s=Math.cos(n),o=Math.sin(n),a=Math.cos(i),l=Math.sin(i),c=Math.cos(r),u=Math.sin(r);if(e.order==="XYZ"){let f=s*c,h=s*u,d=o*c,g=o*u;t[0]=a*c,t[4]=-a*u,t[8]=l,t[1]=h+d*l,t[5]=f-g*l,t[9]=-o*a,t[2]=g-f*l,t[6]=d+h*l,t[10]=s*a}else if(e.order==="YXZ"){let f=a*c,h=a*u,d=l*c,g=l*u;t[0]=f+g*o,t[4]=d*o-h,t[8]=s*l,t[1]=s*u,t[5]=s*c,t[9]=-o,t[2]=h*o-d,t[6]=g+f*o,t[10]=s*a}else if(e.order==="ZXY"){let f=a*c,h=a*u,d=l*c,g=l*u;t[0]=f-g*o,t[4]=-s*u,t[8]=d+h*o,t[1]=h+d*o,t[5]=s*c,t[9]=g-f*o,t[2]=-s*l,t[6]=o,t[10]=s*a}else if(e.order==="ZYX"){let f=s*c,h=s*u,d=o*c,g=o*u;t[0]=a*c,t[4]=d*l-h,t[8]=f*l+g,t[1]=a*u,t[5]=g*l+f,t[9]=h*l-d,t[2]=-l,t[6]=o*a,t[10]=s*a}else if(e.order==="YZX"){let f=s*a,h=s*l,d=o*a,g=o*l;t[0]=a*c,t[4]=g-f*u,t[8]=d*u+h,t[1]=u,t[5]=s*c,t[9]=-o*c,t[2]=-l*c,t[6]=h*u+d,t[10]=f-g*u}else if(e.order==="XZY"){let f=s*a,h=s*l,d=o*a,g=o*l;t[0]=a*c,t[4]=-u,t[8]=l*c,t[1]=f*u+g,t[5]=s*c,t[9]=h*u-d,t[2]=d*u-h,t[6]=o*c,t[10]=g*u+f}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Wv,e,Xv)}lookAt(e,t,n){let i=this.elements;if(un.subVectors(e,t),un.lengthSq()===0)un.z=1;if(un.normalize(),pi.crossVectors(n,un),pi.lengthSq()===0){if(Math.abs(n.z)===1)un.x+=0.0001;else un.z+=0.0001;un.normalize(),pi.crossVectors(n,un)}return pi.normalize(),Io.crossVectors(un,pi),i[0]=pi.x,i[4]=Io.x,i[8]=un.x,i[1]=pi.y,i[5]=Io.y,i[9]=un.y,i[2]=pi.z,i[6]=Io.z,i[10]=un.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,s=n[0],o=n[4],a=n[8],l=n[12],c=n[1],u=n[5],f=n[9],h=n[13],d=n[2],g=n[6],_=n[10],m=n[14],p=n[3],x=n[7],S=n[11],v=n[15],b=i[0],w=i[4],E=i[8],y=i[12],A=i[1],N=i[5],P=i[9],D=i[13],W=i[2],R=i[6],I=i[10],k=i[14],z=i[3],te=i[7],Y=i[11],Q=i[15];return r[0]=s*b+o*A+a*W+l*z,r[4]=s*w+o*N+a*R+l*te,r[8]=s*E+o*P+a*I+l*Y,r[12]=s*y+o*D+a*k+l*Q,r[1]=c*b+u*A+f*W+h*z,r[5]=c*w+u*N+f*R+h*te,r[9]=c*E+u*P+f*I+h*Y,r[13]=c*y+u*D+f*k+h*Q,r[2]=d*b+g*A+_*W+m*z,r[6]=d*w+g*N+_*R+m*te,r[10]=d*E+g*P+_*I+m*Y,r[14]=d*y+g*D+_*k+m*Q,r[3]=p*b+x*A+S*W+v*z,r[7]=p*w+x*N+S*R+v*te,r[11]=p*E+x*P+S*I+v*Y,r[15]=p*y+x*D+S*k+v*Q,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[12],s=e[1],o=e[5],a=e[9],l=e[13],c=e[2],u=e[6],f=e[10],h=e[14],d=e[3],g=e[7],_=e[11],m=e[15],p=a*h-l*f,x=o*h-l*u,S=o*f-a*u,v=s*h-l*c,b=s*f-a*c,w=s*u-o*c;return t*(g*p-_*x+m*S)-n*(d*p-_*v+m*b)+i*(d*x-g*v+m*w)-r*(d*S-g*b+_*w)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[1],s=e[5],o=e[9],a=e[2],l=e[6],c=e[10];return t*(s*c-o*l)-n*(r*c-o*a)+i*(r*l-s*a)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;if(e.isVector3)i[12]=e.x,i[13]=e.y,i[14]=e.z;else i[12]=e,i[13]=t,i[14]=n;return this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],s=e[4],o=e[5],a=e[6],l=e[7],c=e[8],u=e[9],f=e[10],h=e[11],d=e[12],g=e[13],_=e[14],m=e[15],p=t*o-n*s,x=t*a-i*s,S=t*l-r*s,v=n*a-i*o,b=n*l-r*o,w=i*l-r*a,E=c*g-u*d,y=c*_-f*d,A=c*m-h*d,N=u*_-f*g,P=u*m-h*g,D=f*m-h*_,W=p*D-x*P+S*N+v*A-b*y+w*E;if(W===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let R=1/W;return e[0]=(o*D-a*P+l*N)*R,e[1]=(i*P-n*D-r*N)*R,e[2]=(g*w-_*b+m*v)*R,e[3]=(f*b-u*w-h*v)*R,e[4]=(a*A-s*D-l*y)*R,e[5]=(t*D-i*A+r*y)*R,e[6]=(_*S-d*w-m*x)*R,e[7]=(c*w-f*S+h*x)*R,e[8]=(s*P-o*A+l*E)*R,e[9]=(n*A-t*P-r*E)*R,e[10]=(d*b-g*S+m*p)*R,e[11]=(u*S-c*b-h*p)*R,e[12]=(o*y-s*N-a*E)*R,e[13]=(t*N-n*y+i*E)*R,e[14]=(g*x-d*v-_*p)*R,e[15]=(c*v-u*x+f*p)*R,this}scale(e){let t=this.elements,{x:n,y:i,z:r}=e;return t[0]*=n,t[4]*=i,t[8]*=r,t[1]*=n,t[5]*=i,t[9]*=r,t[2]*=n,t[6]*=i,t[10]*=r,t[3]*=n,t[7]*=i,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){if(e.isVector3)this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1);else this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1);return this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),r=1-n,{x:s,y:o,z:a}=e,l=r*s,c=r*o;return this.set(l*s+n,l*o-i*a,l*a+i*o,0,l*o+i*a,c*o+n,c*a-i*s,0,l*a-i*o,c*a+i*s,r*a*a+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,r,s){return this.set(1,n,r,0,e,1,s,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,{_x:r,_y:s,_z:o,_w:a}=t,l=r+r,c=s+s,u=o+o,f=r*l,h=r*c,d=r*u,g=s*c,_=s*u,m=o*u,p=a*l,x=a*c,S=a*u,{x:v,y:b,z:w}=n;return i[0]=(1-(g+m))*v,i[1]=(h+S)*v,i[2]=(d-x)*v,i[3]=0,i[4]=(h-S)*b,i[5]=(1-(f+m))*b,i[6]=(_+p)*b,i[7]=0,i[8]=(d+x)*w,i[9]=(_-p)*w,i[10]=(1-(f+g))*w,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements;e.x=i[12],e.y=i[13],e.z=i[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),t.identity(),this;let s=pr.set(i[0],i[1],i[2]).length(),o=pr.set(i[4],i[5],i[6]).length(),a=pr.set(i[8],i[9],i[10]).length();if(r<0)s=-s;Tn.copy(this);let l=1/s,c=1/o,u=1/a;return Tn.elements[0]*=l,Tn.elements[1]*=l,Tn.elements[2]*=l,Tn.elements[4]*=c,Tn.elements[5]*=c,Tn.elements[6]*=c,Tn.elements[8]*=u,Tn.elements[9]*=u,Tn.elements[10]*=u,t.setFromRotationMatrix(Tn),n.x=s,n.y=o,n.z=a,this}makePerspective(e,t,n,i,r,s,o=2000,a=!1){let l=this.elements,c=2*r/(t-e),u=2*r/(n-i),f=(t+e)/(t-e),h=(n+i)/(n-i),d,g;if(a)d=r/(s-r),g=s*r/(s-r);else if(o===2000)d=-(s+r)/(s-r),g=-2*s*r/(s-r);else if(o===2001)d=-s/(s-r),g=-s*r/(s-r);else throw Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=f,l[12]=0,l[1]=0,l[5]=u,l[9]=h,l[13]=0,l[2]=0,l[6]=0,l[10]=d,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,i,r,s,o=2000,a=!1){let l=this.elements,c=2/(t-e),u=2/(n-i),f=-(t+e)/(t-e),h=-(n+i)/(n-i),d,g;if(a)d=1/(s-r),g=s/(s-r);else if(o===2000)d=-2/(s-r),g=-(s+r)/(s-r);else if(o===2001)d=-1/(s-r),g=-r/(s-r);else throw Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=0,l[12]=f,l[1]=0,l[5]=u,l[9]=0,l[13]=h,l[2]=0,l[6]=0,l[10]=d,l[14]=g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}var pr=new L,Tn=new Je,Wv=new L(0,0,0),Xv=new L(1,1,1),pi=new L,Io=new L,un=new L,rp=new Je,sp=new Gt;class Gn{constructor(e=0,t=0,n=0,i=Gn.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let i=e.elements,r=i[0],s=i[4],o=i[8],a=i[1],l=i[5],c=i[9],u=i[2],f=i[6],h=i[10];switch(t){case"XYZ":if(this._y=Math.asin(He(o,-1,1)),Math.abs(o)<0.9999999)this._x=Math.atan2(-c,h),this._z=Math.atan2(-s,r);else this._x=Math.atan2(f,l),this._z=0;break;case"YXZ":if(this._x=Math.asin(-He(c,-1,1)),Math.abs(c)<0.9999999)this._y=Math.atan2(o,h),this._z=Math.atan2(a,l);else this._y=Math.atan2(-u,r),this._z=0;break;case"ZXY":if(this._x=Math.asin(He(f,-1,1)),Math.abs(f)<0.9999999)this._y=Math.atan2(-u,h),this._z=Math.atan2(-s,l);else this._y=0,this._z=Math.atan2(a,r);break;case"ZYX":if(this._y=Math.asin(-He(u,-1,1)),Math.abs(u)<0.9999999)this._x=Math.atan2(f,h),this._z=Math.atan2(a,r);else this._x=0,this._z=Math.atan2(-s,l);break;case"YZX":if(this._z=Math.asin(He(a,-1,1)),Math.abs(a)<0.9999999)this._x=Math.atan2(-c,l),this._y=Math.atan2(-u,r);else this._x=0,this._y=Math.atan2(o,h);break;case"XZY":if(this._z=Math.asin(-He(s,-1,1)),Math.abs(s)<0.9999999)this._x=Math.atan2(f,l),this._y=Math.atan2(o,r);else this._x=Math.atan2(-c,h),this._y=0;break;default:Ie("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}if(this._order=t,n===!0)this._onChangeCallback();return this}setFromQuaternion(e,t,n){return rp.makeRotationFromQuaternion(e),this.setFromRotationMatrix(rp,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return sp.setFromEuler(this),this.setFromQuaternion(sp,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){if(this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0)this._order=e[3];return this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Gn.DEFAULT_ORDER="XYZ";class Ns{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}var qv=0,op=new L,mr=new Gt,Jn=new Je,Lo=new L,ls=new L,jv=new L,Yv=new Gt,ap=new L(1,0,0),lp=new L(0,1,0),cp=new L(0,0,1),hp={type:"added"},$v={type:"removed"},gr={type:"childadded",child:null},Wl={type:"childremoved",child:null};class Et extends Vn{constructor(){super();this.isObject3D=!0,Object.defineProperty(this,"id",{value:qv++}),this.uuid=ni(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Et.DEFAULT_UP.clone();let e=new L,t=new Gn,n=new Gt,i=new L(1,1,1);function r(){n.setFromEuler(t,!1)}function s(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(s),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Je},normalMatrix:{value:new Be}}),this.matrix=new Je,this.matrixWorld=new Je,this.matrixAutoUpdate=Et.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Et.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Ns,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){if(this.matrixAutoUpdate)this.updateMatrix();this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return mr.setFromAxisAngle(e,t),this.quaternion.multiply(mr),this}rotateOnWorldAxis(e,t){return mr.setFromAxisAngle(e,t),this.quaternion.premultiply(mr),this}rotateX(e){return this.rotateOnAxis(ap,e)}rotateY(e){return this.rotateOnAxis(lp,e)}rotateZ(e){return this.rotateOnAxis(cp,e)}translateOnAxis(e,t){return op.copy(e).applyQuaternion(this.quaternion),this.position.add(op.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(ap,e)}translateY(e){return this.translateOnAxis(lp,e)}translateZ(e){return this.translateOnAxis(cp,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Jn.copy(this.matrixWorld).invert())}lookAt(e,t,n){if(e.isVector3)Lo.copy(e);else Lo.set(e,t,n);let i=this.parent;if(this.updateWorldMatrix(!0,!1),ls.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight)Jn.lookAt(ls,Lo,this.up);else Jn.lookAt(Lo,ls,this.up);if(this.quaternion.setFromRotationMatrix(Jn),i)Jn.extractRotation(i.matrixWorld),mr.setFromRotationMatrix(Jn),this.quaternion.premultiply(mr.invert())}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}if(e===this)return Ne("Object3D.add: object can't be added as a child of itself.",e),this;if(e&&e.isObject3D)e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(hp),gr.child=e,this.dispatchEvent(gr),gr.child=null;else Ne("Object3D.add: object not an instance of THREE.Object3D.",e);return this}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);if(t!==-1)e.parent=null,this.children.splice(t,1),e.dispatchEvent($v),Wl.child=e,this.dispatchEvent(Wl),Wl.child=null;return this}removeFromParent(){let e=this.parent;if(e!==null)e.remove(this);return this}clear(){return this.remove(...this.children)}attach(e){if(this.updateWorldMatrix(!0,!1),Jn.copy(this.matrixWorld).invert(),e.parent!==null)e.parent.updateWorldMatrix(!0,!1),Jn.multiply(e.parent.matrixWorld);return e.applyMatrix4(Jn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(hp),gr.child=e,this.dispatchEvent(gr),gr.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let s=this.children[n].getObjectByProperty(e,t);if(s!==void 0)return s}return}getObjectsByProperty(e,t,n=[]){if(this[e]===t)n.push(this);let i=this.children;for(let r=0,s=i.length;r<s;r++)i[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ls,e,jv),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ls,Yv,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;if(t!==null)e(t),t.traverseAncestors(e)}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let{x:t,y:n,z:i}=e,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*i,r[13]+=n-r[1]*t-r[5]*n-r[9]*i,r[14]+=i-r[2]*t-r[6]*n-r[10]*i}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldNeedsUpdate||e){if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);this.matrixWorldNeedsUpdate=!1,e=!0}let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let i=this.parent;if(e===!0&&i!==null)i.updateWorldMatrix(!0,!1);if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldNeedsUpdate||n){if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);this.matrixWorldNeedsUpdate=!1,n=!0}if(t===!0){let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e==="string",n={};if(t)e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"};let i={};if(i.uuid=this.uuid,i.type=this.type,i.name=this.name,i.castShadow=this.castShadow,i.receiveShadow=this.receiveShadow,i.visible=this.visible,i.frustumCulled=this.frustumCulled,i.renderOrder=this.renderOrder,i.static=this.static,i.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0)i.userData=this.userData;if(i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.pivot!==null)i.pivot=this.pivot.toArray();if(this.morphTargetDictionary!==void 0)i.morphTargetDictionary=Object.assign({},this.morphTargetDictionary);if(this.morphTargetInfluences!==void 0)i.morphTargetInfluences=this.morphTargetInfluences.slice();if(this.isInstancedMesh){if(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null)i.instanceColor=this.instanceColor.toJSON()}if(this.isBatchedMesh){if(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map((o)=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map((o)=>({...o})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(e),i.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null)i.colorsTexture=this._colorsTexture.toJSON(e);if(this.boundingSphere!==null)i.boundingSphere=this.boundingSphere.toJSON();if(this.boundingBox!==null)i.boundingBox=this.boundingBox.toJSON()}function r(o,a){if(o[a.uuid]===void 0)o[a.uuid]=a.toJSON(e);return a.uuid}if(this.isScene){if(this.background){if(this.background.isColor)i.background=this.background.toJSON();else if(this.background.isTexture)i.background=this.background.toJSON(e).uuid}if(this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0)i.environment=this.environment.toJSON(e).uuid}else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let a=o.shapes;if(Array.isArray(a))for(let l=0,c=a.length;l<c;l++){let u=a[l];r(e.shapes,u)}else r(e.shapes,a)}}if(this.isSkinnedMesh){if(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0)r(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid}if(this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let a=0,l=this.material.length;a<l;a++)o.push(r(e.materials,this.material[a]));i.material=o}else i.material=r(e.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){let a=this.animations[o];i.animations.push(r(e.animations,a))}}if(t){let o=s(e.geometries),a=s(e.materials),l=s(e.textures),c=s(e.images),u=s(e.shapes),f=s(e.skeletons),h=s(e.animations),d=s(e.nodes);if(o.length>0)n.geometries=o;if(a.length>0)n.materials=a;if(l.length>0)n.textures=l;if(c.length>0)n.images=c;if(u.length>0)n.shapes=u;if(f.length>0)n.skeletons=f;if(h.length>0)n.animations=h;if(d.length>0)n.nodes=d}return n.object=i,n;function s(o){let a=[];for(let l in o){let c=o[l];delete c.metadata,a.push(c)}return a}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}}Et.DEFAULT_UP=new L(0,1,0);Et.DEFAULT_MATRIX_AUTO_UPDATE=!0;Et.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class zn extends Et{constructor(){super();this.isGroup=!0,this.type="Group"}}var Zv={type:"move"};class Os{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){if(this._hand===null)this._hand=new zn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1};return this._hand}getTargetRaySpace(){if(this._targetRay===null)this._targetRay=new zn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new L,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new L;return this._targetRay}getGripSpace(){if(this._grip===null)this._grip=new zn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new L,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new L,this._grip.eventsEnabled=!1;return this._grip}dispatchEvent(e){if(this._targetRay!==null)this._targetRay.dispatchEvent(e);if(this._grip!==null)this._grip.dispatchEvent(e);if(this._hand!==null)this._hand.dispatchEvent(e);return this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){if(this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null)this._targetRay.visible=!1;if(this._grip!==null)this._grip.visible=!1;if(this._hand!==null)this._hand.visible=!1;return this}update(e,t,n){let i=null,r=null,s=null,o=this._targetRay,a=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){s=!0;for(let g of e.hand.values()){let _=t.getJointPose(g,n),m=this._getHandJoint(l,g);if(_!==null)m.matrix.fromArray(_.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=_.radius;m.visible=_!==null}let c=l.joints["index-finger-tip"],u=l.joints["thumb-tip"],f=c.position.distanceTo(u.position),h=0.02,d=0.005;if(l.inputState.pinching&&f>h+d)l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this});else if(!l.inputState.pinching&&f<=h-d)l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this})}else if(a!==null&&e.gripSpace){if(r=t.getPose(e.gripSpace,n),r!==null){if(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity)a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity);else a.hasLinearVelocity=!1;if(r.angularVelocity)a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity);else a.hasAngularVelocity=!1;if(a.eventsEnabled)a.dispatchEvent({type:"gripUpdated",data:e,target:this})}}if(o!==null){if(i=t.getPose(e.targetRaySpace,n),i===null&&r!==null)i=r;if(i!==null){if(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity)o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity);else o.hasLinearVelocity=!1;if(i.angularVelocity)o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity);else o.hasAngularVelocity=!1;this.dispatchEvent(Zv)}}}if(o!==null)o.visible=i!==null;if(a!==null)a.visible=r!==null;if(l!==null)l.visible=s!==null;return this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new zn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}var Dm={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},mi={h:0,s:0,l:0},Do={h:0,s:0,l:0};function Xl(e,t,n){if(n<0)n+=1;if(n>1)n-=1;if(n<0.16666666666666666)return e+(t-e)*6*n;if(n<0.5)return t;if(n<0.6666666666666666)return e+(t-e)*6*(0.6666666666666666-n);return e}class Le{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let i=e;if(i&&i.isColor)this.copy(i);else if(typeof i==="number")this.setHex(i);else if(typeof i==="string")this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t="srgb"){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,We.colorSpaceToWorking(this,t),this}setRGB(e,t,n,i=We.workingColorSpace){return this.r=e,this.g=t,this.b=n,We.colorSpaceToWorking(this,i),this}setHSL(e,t,n,i=We.workingColorSpace){if(e=sh(e,1),t=He(t,0,1),n=He(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=0.5?n*(1+t):n+t-n*t,s=2*n-r;this.r=Xl(s,r,e+0.3333333333333333),this.g=Xl(s,r,e),this.b=Xl(s,r,e-0.3333333333333333)}return We.colorSpaceToWorking(this,i),this}setStyle(e,t="srgb"){function n(r){if(r===void 0)return;if(parseFloat(r)<1)Ie("Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,s=i[1],o=i[2];switch(s){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Ie("Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=i[1],s=r.length;if(s===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);else if(s===6)return this.setHex(parseInt(r,16),t);else Ie("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t="srgb"){let n=Dm[e.toLowerCase()];if(n!==void 0)this.setHex(n,t);else Ie("Color: Unknown color "+e);return this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=ii(e.r),this.g=ii(e.g),this.b=ii(e.b),this}copyLinearToSRGB(e){return this.r=Ir(e.r),this.g=Ir(e.g),this.b=Ir(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e="srgb"){return We.workingToColorSpace(Xt.copy(this),e),Math.round(He(Xt.r*255,0,255))*65536+Math.round(He(Xt.g*255,0,255))*256+Math.round(He(Xt.b*255,0,255))}getHexString(e="srgb"){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=We.workingColorSpace){We.workingToColorSpace(Xt.copy(this),t);let{r:n,g:i,b:r}=Xt,s=Math.max(n,i,r),o=Math.min(n,i,r),a,l,c=(o+s)/2;if(o===s)a=0,l=0;else{let u=s-o;switch(l=c<=0.5?u/(s+o):u/(2-s-o),s){case n:a=(i-r)/u+(i<r?6:0);break;case i:a=(r-n)/u+2;break;case r:a=(n-i)/u+4;break}a/=6}return e.h=a,e.s=l,e.l=c,e}getRGB(e,t=We.workingColorSpace){return We.workingToColorSpace(Xt.copy(this),t),e.r=Xt.r,e.g=Xt.g,e.b=Xt.b,e}getStyle(e="srgb"){We.workingToColorSpace(Xt.copy(this),e);let{r:t,g:n,b:i}=Xt;if(e!=="srgb")return`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`;return`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(mi),this.setHSL(mi.h+e,mi.s+t,mi.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(mi),e.getHSL(Do);let n=_s(mi.h,Do.h,t),i=_s(mi.s,Do.s,t),r=_s(mi.l,Do.l,t);return this.setHSL(n,i,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,i=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*i,this.g=r[1]*t+r[4]*n+r[7]*i,this.b=r[2]*t+r[5]*n+r[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}var Xt=new Le;Le.NAMES=Dm;class Us extends Et{constructor(){super();if(this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Gn,this.environmentIntensity=1,this.environmentRotation=new Gn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){if(super.copy(e,t),e.background!==null)this.background=e.background.clone();if(e.environment!==null)this.environment=e.environment.clone();if(e.fog!==null)this.fog=e.fog.clone();if(this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null)this.overrideMaterial=e.overrideMaterial.clone();return this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);if(this.fog!==null)t.object.fog=this.fog.toJSON();return t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}}var En=new L,Kn=new L,ql=new L,Qn=new L,_r=new L,vr=new L,up=new L,jl=new L,Yl=new L,$l=new L,Zl=new gt,Jl=new gt,Kl=new gt;class dn{constructor(e=new L,t=new L,n=new L){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),En.subVectors(e,t),i.cross(En);let r=i.lengthSq();if(r>0)return i.multiplyScalar(1/Math.sqrt(r));return i.set(0,0,0)}static getBarycoord(e,t,n,i,r){En.subVectors(i,t),Kn.subVectors(n,t),ql.subVectors(e,t);let s=En.dot(En),o=En.dot(Kn),a=En.dot(ql),l=Kn.dot(Kn),c=Kn.dot(ql),u=s*l-o*o;if(u===0)return r.set(0,0,0),null;let f=1/u,h=(l*a-o*c)*f,d=(s*c-o*a)*f;return r.set(1-h-d,d,h)}static containsPoint(e,t,n,i){if(this.getBarycoord(e,t,n,i,Qn)===null)return!1;return Qn.x>=0&&Qn.y>=0&&Qn.x+Qn.y<=1}static getInterpolation(e,t,n,i,r,s,o,a){if(this.getBarycoord(e,t,n,i,Qn)===null){if(a.x=0,a.y=0,"z"in a)a.z=0;if("w"in a)a.w=0;return null}return a.setScalar(0),a.addScaledVector(r,Qn.x),a.addScaledVector(s,Qn.y),a.addScaledVector(o,Qn.z),a}static getInterpolatedAttribute(e,t,n,i,r,s){return Zl.setScalar(0),Jl.setScalar(0),Kl.setScalar(0),Zl.fromBufferAttribute(e,t),Jl.fromBufferAttribute(e,n),Kl.fromBufferAttribute(e,i),s.setScalar(0),s.addScaledVector(Zl,r.x),s.addScaledVector(Jl,r.y),s.addScaledVector(Kl,r.z),s}static isFrontFacing(e,t,n,i){return En.subVectors(n,t),Kn.subVectors(e,t),En.cross(Kn).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return En.subVectors(this.c,this.b),Kn.subVectors(this.a,this.b),En.cross(Kn).length()*0.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(0.3333333333333333)}getNormal(e){return dn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return dn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,i,r){return dn.getInterpolation(e,this.a,this.b,this.c,t,n,i,r)}containsPoint(e){return dn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return dn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,i=this.b,r=this.c,s,o;_r.subVectors(i,n),vr.subVectors(r,n),jl.subVectors(e,n);let a=_r.dot(jl),l=vr.dot(jl);if(a<=0&&l<=0)return t.copy(n);Yl.subVectors(e,i);let c=_r.dot(Yl),u=vr.dot(Yl);if(c>=0&&u<=c)return t.copy(i);let f=a*u-c*l;if(f<=0&&a>=0&&c<=0)return s=a/(a-c),t.copy(n).addScaledVector(_r,s);$l.subVectors(e,r);let h=_r.dot($l),d=vr.dot($l);if(d>=0&&h<=d)return t.copy(r);let g=h*l-a*d;if(g<=0&&l>=0&&d<=0)return o=l/(l-d),t.copy(n).addScaledVector(vr,o);let _=c*d-h*u;if(_<=0&&u-c>=0&&h-d>=0)return up.subVectors(r,i),o=(u-c)/(u-c+(h-d)),t.copy(i).addScaledVector(up,o);let m=1/(_+g+f);return s=g*m,o=f*m,t.copy(n).addScaledVector(_r,s).addScaledVector(vr,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class Ln{constructor(e=new L(1/0,1/0,1/0),t=new L(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(An.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(An.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=An.copy(t).multiplyScalar(0.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(0.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let s=0,o=r.count;s<o;s++){if(e.isMesh===!0)e.getVertexPosition(s,An);else An.fromBufferAttribute(r,s);An.applyMatrix4(e.matrixWorld),this.expandByPoint(An)}else{if(e.boundingBox!==void 0){if(e.boundingBox===null)e.computeBoundingBox();No.copy(e.boundingBox)}else{if(n.boundingBox===null)n.computeBoundingBox();No.copy(n.boundingBox)}No.applyMatrix4(e.matrixWorld),this.union(No)}}let i=e.children;for(let r=0,s=i.length;r<s;r++)this.expandByObject(i[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,An),An.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;if(e.normal.x>0)t=e.normal.x*this.min.x,n=e.normal.x*this.max.x;else t=e.normal.x*this.max.x,n=e.normal.x*this.min.x;if(e.normal.y>0)t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y;else t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y;if(e.normal.z>0)t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z;else t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z;return t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(cs),Oo.subVectors(this.max,cs),yr.subVectors(e.a,cs),xr.subVectors(e.b,cs),br.subVectors(e.c,cs),gi.subVectors(xr,yr),_i.subVectors(br,xr),Ui.subVectors(yr,br);let t=[0,-gi.z,gi.y,0,-_i.z,_i.y,0,-Ui.z,Ui.y,gi.z,0,-gi.x,_i.z,0,-_i.x,Ui.z,0,-Ui.x,-gi.y,gi.x,0,-_i.y,_i.x,0,-Ui.y,Ui.x,0];if(!Ql(t,yr,xr,br,Oo))return!1;if(t=[1,0,0,0,1,0,0,0,1],!Ql(t,yr,xr,br,Oo))return!1;return Uo.crossVectors(gi,_i),t=[Uo.x,Uo.y,Uo.z],Ql(t,yr,xr,br,Oo)}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,An).distanceTo(e)}getBoundingSphere(e){if(this.isEmpty())e.makeEmpty();else this.getCenter(e.center),e.radius=this.getSize(An).length()*0.5;return e}intersect(e){if(this.min.max(e.min),this.max.min(e.max),this.isEmpty())this.makeEmpty();return this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){if(this.isEmpty())return this;return ei[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),ei[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),ei[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),ei[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),ei[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),ei[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),ei[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),ei[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(ei),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}var ei=[new L,new L,new L,new L,new L,new L,new L,new L],An=new L,No=new Ln,yr=new L,xr=new L,br=new L,gi=new L,_i=new L,Ui=new L,cs=new L,Oo=new L,Uo=new L,Fi=new L;function Ql(e,t,n,i,r){for(let s=0,o=e.length-3;s<=o;s+=3){Fi.fromArray(e,s);let a=r.x*Math.abs(Fi.x)+r.y*Math.abs(Fi.y)+r.z*Math.abs(Fi.z),l=t.dot(Fi),c=n.dot(Fi),u=i.dot(Fi);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>a)return!1}return!0}var Tt=new L,Fo=new ne,Jv=0;class Qt extends Vn{constructor(e,t,n=!1){super();if(Array.isArray(e))throw TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Jv++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=35044,this.updateRanges=[],this.gpuType=1015,this.version=0}onUploadCallback(){}set needsUpdate(e){if(e===!0)this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Fo.fromBufferAttribute(this,t),Fo.applyMatrix3(e),this.setXY(t,Fo.x,Fo.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Tt.fromBufferAttribute(this,t),Tt.applyMatrix3(e),this.setXYZ(t,Tt.x,Tt.y,Tt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Tt.fromBufferAttribute(this,t),Tt.applyMatrix4(e),this.setXYZ(t,Tt.x,Tt.y,Tt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Tt.fromBufferAttribute(this,t),Tt.applyNormalMatrix(e),this.setXYZ(t,Tt.x,Tt.y,Tt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Tt.fromBufferAttribute(this,t),Tt.transformDirection(e),this.setXYZ(t,Tt.x,Tt.y,Tt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];if(this.normalized)n=Cn(n,this.array);return n}setComponent(e,t,n){if(this.normalized)n=ot(n,this.array);return this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];if(this.normalized)t=Cn(t,this.array);return t}setX(e,t){if(this.normalized)t=ot(t,this.array);return this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];if(this.normalized)t=Cn(t,this.array);return t}setY(e,t){if(this.normalized)t=ot(t,this.array);return this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];if(this.normalized)t=Cn(t,this.array);return t}setZ(e,t){if(this.normalized)t=ot(t,this.array);return this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];if(this.normalized)t=Cn(t,this.array);return t}setW(e,t){if(this.normalized)t=ot(t,this.array);return this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){if(e*=this.itemSize,this.normalized)t=ot(t,this.array),n=ot(n,this.array);return this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){if(e*=this.itemSize,this.normalized)t=ot(t,this.array),n=ot(n,this.array),i=ot(i,this.array);return this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,r){if(e*=this.itemSize,this.normalized)t=ot(t,this.array),n=ot(n,this.array),i=ot(i,this.array),r=ot(r,this.array);return this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}}class xa extends Qt{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class ba extends Qt{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class rt extends Qt{constructor(e,t,n){super(new Float32Array(e),t,n)}}var Kv=new Ln,hs=new L,ec=new L;class Yi{constructor(e=new L,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;if(t!==void 0)n.copy(t);else Kv.setFromPoints(e).getCenter(n);let i=0;for(let r=0,s=e.length;r<s;r++)i=Math.max(i,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);if(t.copy(e),n>this.radius*this.radius)t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center);return t}getBoundingBox(e){if(this.isEmpty())return e.makeEmpty(),e;return e.set(this.center,this.center),e.expandByScalar(this.radius),e}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;hs.subVectors(e,this.center);let t=hs.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*0.5;this.center.addScaledVector(hs,i/n),this.radius+=i}return this}union(e){if(e.isEmpty())return this;if(this.isEmpty())return this.copy(e),this;if(this.center.equals(e.center)===!0)this.radius=Math.max(this.radius,e.radius);else ec.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(hs.copy(e.center).add(ec)),this.expandByPoint(hs.copy(e.center).sub(ec));return this}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}var Qv=0,yn=new Je,tc=new Et,Sr=new L,fn=new Ln,us=new Ln,Ut=new L;class xt extends Vn{constructor(){super();this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Qv++}),this.uuid=ni(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){if(Array.isArray(e))this.index=new((Mv(e))?ba:xa)(e,1);else this.index=e;return this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;if(t!==void 0)t.applyMatrix4(e),t.needsUpdate=!0;let n=this.attributes.normal;if(n!==void 0){let r=new Be().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}let i=this.attributes.tangent;if(i!==void 0)i.transformDirection(e),i.needsUpdate=!0;if(this.boundingBox!==null)this.computeBoundingBox();if(this.boundingSphere!==null)this.computeBoundingSphere();return this._transformed=!0,this}applyQuaternion(e){return yn.makeRotationFromQuaternion(e),this.applyMatrix4(yn),this}rotateX(e){return yn.makeRotationX(e),this.applyMatrix4(yn),this}rotateY(e){return yn.makeRotationY(e),this.applyMatrix4(yn),this}rotateZ(e){return yn.makeRotationZ(e),this.applyMatrix4(yn),this}translate(e,t,n){return yn.makeTranslation(e,t,n),this.applyMatrix4(yn),this}scale(e,t,n){return yn.makeScale(e,t,n),this.applyMatrix4(yn),this}lookAt(e){return tc.lookAt(e),tc.updateMatrix(),this.applyMatrix4(tc.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Sr).negate(),this.translate(Sr.x,Sr.y,Sr.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let i=0,r=e.length;i<r;i++){let s=e[i];n.push(s.x,s.y,s.z||0)}this.setAttribute("position",new rt(n,3))}else{let n=Math.min(e.length,t.count);for(let i=0;i<n;i++){let r=e[i];t.setXYZ(i,r.x,r.y,r.z||0)}if(e.length>t.count)Ie("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.");t.needsUpdate=!0}return this}computeBoundingBox(){if(this.boundingBox===null)this.boundingBox=new Ln;let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ne("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new L(-1/0,-1/0,-1/0),new L(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let r=t[n];if(fn.setFromBufferAttribute(r),this.morphTargetsRelative)Ut.addVectors(this.boundingBox.min,fn.min),this.boundingBox.expandByPoint(Ut),Ut.addVectors(this.boundingBox.max,fn.max),this.boundingBox.expandByPoint(Ut);else this.boundingBox.expandByPoint(fn.min),this.boundingBox.expandByPoint(fn.max)}}else this.boundingBox.makeEmpty();if(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))Ne('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){if(this.boundingSphere===null)this.boundingSphere=new Yi;let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ne("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new L,1/0);return}if(e){let n=this.boundingSphere.center;if(fn.setFromBufferAttribute(e),t)for(let r=0,s=t.length;r<s;r++){let o=t[r];if(us.setFromBufferAttribute(o),this.morphTargetsRelative)Ut.addVectors(fn.min,us.min),fn.expandByPoint(Ut),Ut.addVectors(fn.max,us.max),fn.expandByPoint(Ut);else fn.expandByPoint(us.min),fn.expandByPoint(us.max)}fn.getCenter(n);let i=0;for(let r=0,s=e.count;r<s;r++)Ut.fromBufferAttribute(e,r),i=Math.max(i,n.distanceToSquared(Ut));if(t)for(let r=0,s=t.length;r<s;r++){let o=t[r],a=this.morphTargetsRelative;for(let l=0,c=o.count;l<c;l++){if(Ut.fromBufferAttribute(o,l),a)Sr.fromBufferAttribute(e,l),Ut.add(Sr);i=Math.max(i,n.distanceToSquared(Ut))}}if(this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius))Ne('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ne("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let{position:n,normal:i,uv:r}=t,s=this.getAttribute("tangent");if(s===void 0||s.count!==n.count)s=new Qt(new Float32Array(4*n.count),4),this.setAttribute("tangent",s);let o=[],a=[];for(let E=0;E<n.count;E++)o[E]=new L,a[E]=new L;let l=new L,c=new L,u=new L,f=new ne,h=new ne,d=new ne,g=new L,_=new L;function m(E,y,A){l.fromBufferAttribute(n,E),c.fromBufferAttribute(n,y),u.fromBufferAttribute(n,A),f.fromBufferAttribute(r,E),h.fromBufferAttribute(r,y),d.fromBufferAttribute(r,A),c.sub(l),u.sub(l),h.sub(f),d.sub(f);let N=1/(h.x*d.y-d.x*h.y);if(!isFinite(N))return;g.copy(c).multiplyScalar(d.y).addScaledVector(u,-h.y).multiplyScalar(N),_.copy(u).multiplyScalar(h.x).addScaledVector(c,-d.x).multiplyScalar(N),o[E].add(g),o[y].add(g),o[A].add(g),a[E].add(_),a[y].add(_),a[A].add(_)}let p=this.groups;if(p.length===0)p=[{start:0,count:e.count}];for(let E=0,y=p.length;E<y;++E){let A=p[E],{start:N,count:P}=A;for(let D=N,W=N+P;D<W;D+=3)m(e.getX(D+0),e.getX(D+1),e.getX(D+2))}let x=new L,S=new L,v=new L,b=new L;function w(E){v.fromBufferAttribute(i,E),b.copy(v);let y=o[E];x.copy(y),x.sub(v.multiplyScalar(v.dot(y))).normalize(),S.crossVectors(b,y);let N=S.dot(a[E])<0?-1:1;s.setXYZW(E,x.x,x.y,x.z,N)}for(let E=0,y=p.length;E<y;++E){let A=p[E],{start:N,count:P}=A;for(let D=N,W=N+P;D<W;D+=3)w(e.getX(D+0)),w(e.getX(D+1)),w(e.getX(D+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new Qt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let f=0,h=n.count;f<h;f++)n.setXYZ(f,0,0,0);let i=new L,r=new L,s=new L,o=new L,a=new L,l=new L,c=new L,u=new L;if(e)for(let f=0,h=e.count;f<h;f+=3){let d=e.getX(f+0),g=e.getX(f+1),_=e.getX(f+2);i.fromBufferAttribute(t,d),r.fromBufferAttribute(t,g),s.fromBufferAttribute(t,_),c.subVectors(s,r),u.subVectors(i,r),c.cross(u),o.fromBufferAttribute(n,d),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,_),o.add(c),a.add(c),l.add(c),n.setXYZ(d,o.x,o.y,o.z),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(_,l.x,l.y,l.z)}else for(let f=0,h=t.count;f<h;f+=3)i.fromBufferAttribute(t,f+0),r.fromBufferAttribute(t,f+1),s.fromBufferAttribute(t,f+2),c.subVectors(s,r),u.subVectors(i,r),c.cross(u),n.setXYZ(f+0,c.x,c.y,c.z),n.setXYZ(f+1,c.x,c.y,c.z),n.setXYZ(f+2,c.x,c.y,c.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Ut.fromBufferAttribute(e,t),Ut.normalize(),e.setXYZ(t,Ut.x,Ut.y,Ut.z)}toNonIndexed(){function e(o,a){let{array:l,itemSize:c,normalized:u}=o,f=new l.constructor(a.length*c),h=0,d=0;for(let g=0,_=a.length;g<_;g++){if(o.isInterleavedBufferAttribute)h=a[g]*o.data.stride+o.offset;else h=a[g]*c;for(let m=0;m<c;m++)f[d++]=l[h++]}return new Qt(f,c,u)}if(this.index===null)return Ie("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new xt,n=this.index.array,i=this.attributes;for(let o in i){let a=i[o],l=e(a,n);t.setAttribute(o,l)}let r=this.morphAttributes;for(let o in r){let a=[],l=r[o];for(let c=0,u=l.length;c<u;c++){let f=l[c],h=e(f,n);a.push(h)}t.morphAttributes[o]=a}t.morphTargetsRelative=this.morphTargetsRelative;let s=this.groups;for(let o=0,a=s.length;o<a;o++){let l=s[o];t.addGroup(l.start,l.count,l.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0)e.userData=this.userData;if(this.parameters!==void 0&&this._transformed!==!0){let a=this.parameters;for(let l in a)if(a[l]!==void 0)e[l]=a[l];return e}e.data={attributes:{}};let t=this.index;if(t!==null)e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)};let n=this.attributes;for(let a in n){let l=n[a];e.data.attributes[a]=l.toJSON(e.data)}let i={},r=!1;for(let a in this.morphAttributes){let l=this.morphAttributes[a],c=[];for(let u=0,f=l.length;u<f;u++){let h=l[u];c.push(h.toJSON(e.data))}if(c.length>0)i[a]=c,r=!0}if(r)e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative;let s=this.groups;if(s.length>0)e.data.groups=JSON.parse(JSON.stringify(s));let o=this.boundingSphere;if(o!==null)e.data.boundingSphere=o.toJSON();return e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;if(n!==null)this.setIndex(n.clone());let i=e.attributes;for(let l in i){let c=i[l];this.setAttribute(l,c.clone(t))}let r=e.morphAttributes;for(let l in r){let c=[],u=r[l];for(let f=0,h=u.length;f<h;f++)c.push(u[f].clone(t));this.morphAttributes[l]=c}this.morphTargetsRelative=e.morphTargetsRelative;let s=e.groups;for(let l=0,c=s.length;l<c;l++){let u=s[l];this.addGroup(u.start,u.count,u.materialIndex)}let o=e.boundingBox;if(o!==null)this.boundingBox=o.clone();let a=e.boundingSphere;if(a!==null)this.boundingSphere=a.clone();return this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}class ch{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=35044,this.updateRanges=[],this.version=0,this.uuid=ni()}onUploadCallback(){}set needsUpdate(e){if(e===!0)this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,r=this.stride;i<r;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){if(e.arrayBuffers===void 0)e.arrayBuffers={};if(this.array.buffer._uuid===void 0)this.array.buffer._uuid=ni();if(e.arrayBuffers[this.array.buffer._uuid]===void 0)e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer;let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){if(e.arrayBuffers===void 0)e.arrayBuffers={};if(this.array.buffer._uuid===void 0)this.array.buffer._uuid=ni();if(e.arrayBuffers[this.array.buffer._uuid]===void 0)e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer));let t={uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride};return t.usage=this.usage,t}}var Kt=new L;class bs{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Kt.fromBufferAttribute(this,t),Kt.applyMatrix4(e),this.setXYZ(t,Kt.x,Kt.y,Kt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Kt.fromBufferAttribute(this,t),Kt.applyNormalMatrix(e),this.setXYZ(t,Kt.x,Kt.y,Kt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Kt.fromBufferAttribute(this,t),Kt.transformDirection(e),this.setXYZ(t,Kt.x,Kt.y,Kt.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];if(this.normalized)n=Cn(n,this.array);return n}setComponent(e,t,n){if(this.normalized)n=ot(n,this.array);return this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){if(this.normalized)t=ot(t,this.array);return this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){if(this.normalized)t=ot(t,this.array);return this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){if(this.normalized)t=ot(t,this.array);return this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){if(this.normalized)t=ot(t,this.array);return this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];if(this.normalized)t=Cn(t,this.array);return t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];if(this.normalized)t=Cn(t,this.array);return t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];if(this.normalized)t=Cn(t,this.array);return t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];if(this.normalized)t=Cn(t,this.array);return t}setXY(e,t,n){if(e=e*this.data.stride+this.offset,this.normalized)t=ot(t,this.array),n=ot(n,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){if(e=e*this.data.stride+this.offset,this.normalized)t=ot(t,this.array),n=ot(n,this.array),i=ot(i,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,r){if(e=e*this.data.stride+this.offset,this.normalized)t=ot(t,this.array),n=ot(n,this.array),i=ot(i,this.array),r=ot(r,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=r,this}clone(e){if(e===void 0){xs("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return new Qt(new this.array.constructor(t),this.itemSize,this.normalized)}else{if(e.interleavedBuffers===void 0)e.interleavedBuffers={};if(e.interleavedBuffers[this.data.uuid]===void 0)e.interleavedBuffers[this.data.uuid]=this.data.clone(e);return new bs(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}}toJSON(e){if(e===void 0){xs("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else{if(e.interleavedBuffers===void 0)e.interleavedBuffers={};if(e.interleavedBuffers[this.data.uuid]===void 0)e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e);return{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}}var nc=new L,ey=new L,ty=new Be;class on{constructor(e=new L(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=nc.subVectors(n,t).cross(ey.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let i=e.delta(nc),r=this.normal.dot(i);if(r===0){if(this.distanceToPoint(e.start)===0)return t.copy(e.start);return null}let s=-(e.start.dot(this.normal)+this.constant)/r;if(n===!0&&(s<0||s>1))return null;return t.copy(e.start).addScaledVector(i,s)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||ty.getNormalMatrix(e),i=this.coplanarPoint(nc).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}}var ny=0;class Dn extends Vn{constructor(){super();this.isMaterial=!0,Object.defineProperty(this,"id",{value:ny++}),this.uuid=ni(),this.name="",this.type="Material",this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Le(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=7680,this.stencilZFail=7680,this.stencilZPass=7680,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){if(this._alphaTest>0!==e>0)this.version++;this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e===void 0)return;for(let t in e){let n=e[t];if(n===void 0){Ie(`Material: parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){Ie(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}if(i&&i.isColor)i.set(n);else if(i&&i.isVector2&&(n&&n.isVector2)||i&&i.isEuler&&(n&&n.isEuler)||i&&i.isVector3&&(n&&n.isVector3))i.copy(n);else this[t]=n}}toJSON(e){let t=e===void 0||typeof e==="string";if(t)e={textures:{},images:{}};let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};if(n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor)n.color=this.color.getHex();if(this.roughness!==void 0)n.roughness=this.roughness;if(this.metalness!==void 0)n.metalness=this.metalness;if(this.sheen!==void 0)n.sheen=this.sheen;if(this.sheenColor&&this.sheenColor.isColor)n.sheenColor=this.sheenColor.getHex();if(this.sheenRoughness!==void 0)n.sheenRoughness=this.sheenRoughness;if(this.emissive&&this.emissive.isColor)n.emissive=this.emissive.getHex();if(this.emissiveIntensity!==void 0)n.emissiveIntensity=this.emissiveIntensity;if(this.specular&&this.specular.isColor)n.specular=this.specular.getHex();if(this.specularIntensity!==void 0)n.specularIntensity=this.specularIntensity;if(this.specularColor&&this.specularColor.isColor)n.specularColor=this.specularColor.getHex();if(this.shininess!==void 0)n.shininess=this.shininess;if(this.clearcoat!==void 0)n.clearcoat=this.clearcoat;if(this.clearcoatRoughness!==void 0)n.clearcoatRoughness=this.clearcoatRoughness;if(this.clearcoatMap&&this.clearcoatMap.isTexture)n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid;if(this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture)n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid;if(this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture)n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray();if(this.sheenColorMap&&this.sheenColorMap.isTexture)n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid;if(this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture)n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid;if(this.dispersion!==void 0)n.dispersion=this.dispersion;if(this.retroreflectivity!==void 0)n.retroreflectivity=this.retroreflectivity;if(this.iridescence!==void 0)n.iridescence=this.iridescence;if(this.iridescenceIOR!==void 0)n.iridescenceIOR=this.iridescenceIOR;if(this.iridescenceThicknessRange!==void 0)n.iridescenceThicknessRange=this.iridescenceThicknessRange;if(this.iridescenceMap&&this.iridescenceMap.isTexture)n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid;if(this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture)n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid;if(this.anisotropy!==void 0)n.anisotropy=this.anisotropy;if(this.anisotropyRotation!==void 0)n.anisotropyRotation=this.anisotropyRotation;if(this.anisotropyMap&&this.anisotropyMap.isTexture)n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid;if(this.map&&this.map.isTexture)n.map=this.map.toJSON(e).uuid;if(this.matcap&&this.matcap.isTexture)n.matcap=this.matcap.toJSON(e).uuid;if(this.alphaMap&&this.alphaMap.isTexture)n.alphaMap=this.alphaMap.toJSON(e).uuid;if(this.lightMap&&this.lightMap.isTexture)n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity;if(this.aoMap&&this.aoMap.isTexture)n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity;if(this.bumpMap&&this.bumpMap.isTexture)n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale;if(this.normalMap&&this.normalMap.isTexture)n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray();if(this.displacementMap&&this.displacementMap.isTexture)n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias;if(this.roughnessMap&&this.roughnessMap.isTexture)n.roughnessMap=this.roughnessMap.toJSON(e).uuid;if(this.metalnessMap&&this.metalnessMap.isTexture)n.metalnessMap=this.metalnessMap.toJSON(e).uuid;if(this.emissiveMap&&this.emissiveMap.isTexture)n.emissiveMap=this.emissiveMap.toJSON(e).uuid;if(this.specularMap&&this.specularMap.isTexture)n.specularMap=this.specularMap.toJSON(e).uuid;if(this.specularIntensityMap&&this.specularIntensityMap.isTexture)n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid;if(this.specularColorMap&&this.specularColorMap.isTexture)n.specularColorMap=this.specularColorMap.toJSON(e).uuid;if(this.envMap&&this.envMap.isTexture){if(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0)n.combine=this.combine}if(this.envMapRotation!==void 0)n.envMapRotation=this.envMapRotation.toArray();if(this.envMapIntensity!==void 0)n.envMapIntensity=this.envMapIntensity;if(this.reflectivity!==void 0)n.reflectivity=this.reflectivity;if(this.refractionRatio!==void 0)n.refractionRatio=this.refractionRatio;if(this.gradientMap&&this.gradientMap.isTexture)n.gradientMap=this.gradientMap.toJSON(e).uuid;if(this.transmission!==void 0)n.transmission=this.transmission;if(this.transmissionMap&&this.transmissionMap.isTexture)n.transmissionMap=this.transmissionMap.toJSON(e).uuid;if(this.thickness!==void 0)n.thickness=this.thickness;if(this.thicknessMap&&this.thicknessMap.isTexture)n.thicknessMap=this.thicknessMap.toJSON(e).uuid;if(this.attenuationDistance!==void 0)n.attenuationDistance=this.attenuationDistance;if(this.attenuationColor!==void 0)n.attenuationColor=this.attenuationColor.getHex();if(this.size!==void 0)n.size=this.size;if(this.sizeAttenuation!==void 0)n.sizeAttenuation=this.sizeAttenuation;if(Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0)n.clippingPlanes=this.clippingPlanes.map((r)=>r.toJSON());if(this.rotation!==void 0)n.rotation=this.rotation;if(this.depthPacking!==void 0)n.depthPacking=this.depthPacking;if(this.linewidth!==void 0)n.linewidth=this.linewidth;if(this.linecap!==void 0)n.linecap=this.linecap;if(this.linejoin!==void 0)n.linejoin=this.linejoin;if(this.dashSize!==void 0)n.dashSize=this.dashSize;if(this.gapSize!==void 0)n.gapSize=this.gapSize;if(this.scale!==void 0)n.scale=this.scale;if(this.wireframe!==void 0)n.wireframe=this.wireframe;if(this.wireframeLinewidth!==void 0)n.wireframeLinewidth=this.wireframeLinewidth;if(this.wireframeLinecap!==void 0)n.wireframeLinecap=this.wireframeLinecap;if(this.wireframeLinejoin!==void 0)n.wireframeLinejoin=this.wireframeLinejoin;if(this.flatShading!==void 0)n.flatShading=this.flatShading;if(this.fog!==void 0)n.fog=this.fog;if(Object.keys(this.userData).length>0)n.userData=this.userData;function i(r){let s=[];for(let o in r){let a=r[o];delete a.metadata,s.push(a)}return s}if(t){let r=i(e.textures),s=i(e.images);if(r.length>0)n.textures=r;if(s.length>0)n.images=s}return n}fromJSON(e,t){if(e.uuid!==void 0)this.uuid=e.uuid;if(e.name!==void 0)this.name=e.name;if(e.color!==void 0&&this.color!==void 0)this.color.setHex(e.color);if(e.roughness!==void 0)this.roughness=e.roughness;if(e.metalness!==void 0)this.metalness=e.metalness;if(e.sheen!==void 0)this.sheen=e.sheen;if(e.sheenColor!==void 0)this.sheenColor=new Le().setHex(e.sheenColor);if(e.sheenRoughness!==void 0)this.sheenRoughness=e.sheenRoughness;if(e.emissive!==void 0&&this.emissive!==void 0)this.emissive.setHex(e.emissive);if(e.specular!==void 0&&this.specular!==void 0)this.specular.setHex(e.specular);if(e.specularIntensity!==void 0)this.specularIntensity=e.specularIntensity;if(e.specularColor!==void 0&&this.specularColor!==void 0)this.specularColor.setHex(e.specularColor);if(e.shininess!==void 0)this.shininess=e.shininess;if(e.clearcoat!==void 0)this.clearcoat=e.clearcoat;if(e.clearcoatRoughness!==void 0)this.clearcoatRoughness=e.clearcoatRoughness;if(e.dispersion!==void 0)this.dispersion=e.dispersion;if(e.retroreflectivity!==void 0)this.retroreflectivity=e.retroreflectivity;if(e.iridescence!==void 0)this.iridescence=e.iridescence;if(e.iridescenceIOR!==void 0)this.iridescenceIOR=e.iridescenceIOR;if(e.iridescenceThicknessRange!==void 0)this.iridescenceThicknessRange=e.iridescenceThicknessRange;if(e.transmission!==void 0)this.transmission=e.transmission;if(e.thickness!==void 0)this.thickness=e.thickness;if(e.attenuationDistance!==void 0)this.attenuationDistance=e.attenuationDistance;if(e.attenuationColor!==void 0&&this.attenuationColor!==void 0)this.attenuationColor.setHex(e.attenuationColor);if(e.anisotropy!==void 0)this.anisotropy=e.anisotropy;if(e.anisotropyRotation!==void 0)this.anisotropyRotation=e.anisotropyRotation;if(e.fog!==void 0)this.fog=e.fog;if(e.flatShading!==void 0)this.flatShading=e.flatShading;if(e.blending!==void 0)this.blending=e.blending;if(e.combine!==void 0)this.combine=e.combine;if(e.side!==void 0)this.side=e.side;if(e.shadowSide!==void 0)this.shadowSide=e.shadowSide;if(e.opacity!==void 0)this.opacity=e.opacity;if(e.transparent!==void 0)this.transparent=e.transparent;if(e.alphaTest!==void 0)this.alphaTest=e.alphaTest;if(e.alphaHash!==void 0)this.alphaHash=e.alphaHash;if(e.depthFunc!==void 0)this.depthFunc=e.depthFunc;if(e.depthTest!==void 0)this.depthTest=e.depthTest;if(e.depthWrite!==void 0)this.depthWrite=e.depthWrite;if(e.colorWrite!==void 0)this.colorWrite=e.colorWrite;if(e.clippingPlanes!==void 0)this.clippingPlanes=e.clippingPlanes.map((n)=>new on().fromJSON(n));if(e.clipIntersection!==void 0)this.clipIntersection=e.clipIntersection;if(e.clipShadows!==void 0)this.clipShadows=e.clipShadows;if(e.depthPacking!==void 0)this.depthPacking=e.depthPacking;if(e.blendSrc!==void 0)this.blendSrc=e.blendSrc;if(e.blendDst!==void 0)this.blendDst=e.blendDst;if(e.blendEquation!==void 0)this.blendEquation=e.blendEquation;if(e.blendSrcAlpha!==void 0)this.blendSrcAlpha=e.blendSrcAlpha;if(e.blendDstAlpha!==void 0)this.blendDstAlpha=e.blendDstAlpha;if(e.blendEquationAlpha!==void 0)this.blendEquationAlpha=e.blendEquationAlpha;if(e.blendColor!==void 0&&this.blendColor!==void 0)this.blendColor.setHex(e.blendColor);if(e.blendAlpha!==void 0)this.blendAlpha=e.blendAlpha;if(e.stencilWriteMask!==void 0)this.stencilWriteMask=e.stencilWriteMask;if(e.stencilFunc!==void 0)this.stencilFunc=e.stencilFunc;if(e.stencilRef!==void 0)this.stencilRef=e.stencilRef;if(e.stencilFuncMask!==void 0)this.stencilFuncMask=e.stencilFuncMask;if(e.stencilFail!==void 0)this.stencilFail=e.stencilFail;if(e.stencilZFail!==void 0)this.stencilZFail=e.stencilZFail;if(e.stencilZPass!==void 0)this.stencilZPass=e.stencilZPass;if(e.stencilWrite!==void 0)this.stencilWrite=e.stencilWrite;if(e.wireframe!==void 0)this.wireframe=e.wireframe;if(e.wireframeLinewidth!==void 0)this.wireframeLinewidth=e.wireframeLinewidth;if(e.wireframeLinecap!==void 0)this.wireframeLinecap=e.wireframeLinecap;if(e.wireframeLinejoin!==void 0)this.wireframeLinejoin=e.wireframeLinejoin;if(e.rotation!==void 0)this.rotation=e.rotation;if(e.linewidth!==void 0)this.linewidth=e.linewidth;if(e.linecap!==void 0)this.linecap=e.linecap;if(e.linejoin!==void 0)this.linejoin=e.linejoin;if(e.dashSize!==void 0)this.dashSize=e.dashSize;if(e.gapSize!==void 0)this.gapSize=e.gapSize;if(e.scale!==void 0)this.scale=e.scale;if(e.polygonOffset!==void 0)this.polygonOffset=e.polygonOffset;if(e.polygonOffsetFactor!==void 0)this.polygonOffsetFactor=e.polygonOffsetFactor;if(e.polygonOffsetUnits!==void 0)this.polygonOffsetUnits=e.polygonOffsetUnits;if(e.dithering!==void 0)this.dithering=e.dithering;if(e.alphaToCoverage!==void 0)this.alphaToCoverage=e.alphaToCoverage;if(e.premultipliedAlpha!==void 0)this.premultipliedAlpha=e.premultipliedAlpha;if(e.forceSinglePass!==void 0)this.forceSinglePass=e.forceSinglePass;if(e.allowOverride!==void 0)this.allowOverride=e.allowOverride;if(e.visible!==void 0)this.visible=e.visible;if(e.toneMapped!==void 0)this.toneMapped=e.toneMapped;if(e.userData!==void 0)this.userData=e.userData;if(e.vertexColors!==void 0)if(typeof e.vertexColors==="number")this.vertexColors=e.vertexColors>0;else this.vertexColors=e.vertexColors;if(e.size!==void 0)this.size=e.size;if(e.sizeAttenuation!==void 0)this.sizeAttenuation=e.sizeAttenuation;if(e.map!==void 0)this.map=t[e.map]||null;if(e.matcap!==void 0)this.matcap=t[e.matcap]||null;if(e.alphaMap!==void 0)this.alphaMap=t[e.alphaMap]||null;if(e.bumpMap!==void 0)this.bumpMap=t[e.bumpMap]||null;if(e.bumpScale!==void 0)this.bumpScale=e.bumpScale;if(e.normalMap!==void 0)this.normalMap=t[e.normalMap]||null;if(e.normalMapType!==void 0)this.normalMapType=e.normalMapType;if(e.normalScale!==void 0){let n=e.normalScale;if(Array.isArray(n)===!1)n=[n,n];this.normalScale=new ne().fromArray(n)}if(e.displacementMap!==void 0)this.displacementMap=t[e.displacementMap]||null;if(e.displacementScale!==void 0)this.displacementScale=e.displacementScale;if(e.displacementBias!==void 0)this.displacementBias=e.displacementBias;if(e.roughnessMap!==void 0)this.roughnessMap=t[e.roughnessMap]||null;if(e.metalnessMap!==void 0)this.metalnessMap=t[e.metalnessMap]||null;if(e.emissiveMap!==void 0)this.emissiveMap=t[e.emissiveMap]||null;if(e.emissiveIntensity!==void 0)this.emissiveIntensity=e.emissiveIntensity;if(e.specularMap!==void 0)this.specularMap=t[e.specularMap]||null;if(e.specularIntensityMap!==void 0)this.specularIntensityMap=t[e.specularIntensityMap]||null;if(e.specularColorMap!==void 0)this.specularColorMap=t[e.specularColorMap]||null;if(e.envMap!==void 0)this.envMap=t[e.envMap]||null;if(e.envMapRotation!==void 0)this.envMapRotation.fromArray(e.envMapRotation);if(e.envMapIntensity!==void 0)this.envMapIntensity=e.envMapIntensity;if(e.reflectivity!==void 0)this.reflectivity=e.reflectivity;if(e.refractionRatio!==void 0)this.refractionRatio=e.refractionRatio;if(e.lightMap!==void 0)this.lightMap=t[e.lightMap]||null;if(e.lightMapIntensity!==void 0)this.lightMapIntensity=e.lightMapIntensity;if(e.aoMap!==void 0)this.aoMap=t[e.aoMap]||null;if(e.aoMapIntensity!==void 0)this.aoMapIntensity=e.aoMapIntensity;if(e.gradientMap!==void 0)this.gradientMap=t[e.gradientMap]||null;if(e.clearcoatMap!==void 0)this.clearcoatMap=t[e.clearcoatMap]||null;if(e.clearcoatRoughnessMap!==void 0)this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null;if(e.clearcoatNormalMap!==void 0)this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null;if(e.clearcoatNormalScale!==void 0)this.clearcoatNormalScale=new ne().fromArray(e.clearcoatNormalScale);if(e.iridescenceMap!==void 0)this.iridescenceMap=t[e.iridescenceMap]||null;if(e.iridescenceThicknessMap!==void 0)this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null;if(e.transmissionMap!==void 0)this.transmissionMap=t[e.transmissionMap]||null;if(e.thicknessMap!==void 0)this.thicknessMap=t[e.thicknessMap]||null;if(e.anisotropyMap!==void 0)this.anisotropyMap=t[e.anisotropyMap]||null;if(e.sheenColorMap!==void 0)this.sheenColorMap=t[e.sheenColorMap]||null;if(e.sheenRoughnessMap!==void 0)this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null;return this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let i=t.length;n=Array(i);for(let r=0;r!==i;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){if(e===!0)this.version++}}class Vr extends Dn{constructor(e){super();this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Le(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}var Mr,fs=new L,wr=new L,Tr=new L,Er=new ne,ds=new ne,Nm=new Je,Bo=new L,ps=new L,ko=new L,fp=new ne,ic=new ne,dp=new ne;class Fs extends Et{constructor(e=new Vr){super();if(this.isSprite=!0,this.type="Sprite",Mr===void 0){Mr=new xt;let t=new Float32Array([-0.5,-0.5,0,0,0,0.5,-0.5,0,1,0,0.5,0.5,0,1,1,-0.5,0.5,0,0,1]),n=new ch(t,5);Mr.setIndex([0,1,2,0,2,3]),Mr.setAttribute("position",new bs(n,3,0,!1)),Mr.setAttribute("uv",new bs(n,2,3,!1))}this.geometry=Mr,this.material=e,this.center=new ne(0.5,0.5),this.count=1}intersectsFrustum(e){return e.intersectsSprite(this)}raycast(e,t){if(e.camera===null)Ne('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.');if(wr.setFromMatrixScale(this.matrixWorld),Nm.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),Tr.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1)wr.multiplyScalar(-Tr.z);let n=this.material.rotation,i,r;if(n!==0)r=Math.cos(n),i=Math.sin(n);let s=this.center;zo(Bo.set(-0.5,-0.5,0),Tr,s,wr,i,r),zo(ps.set(0.5,-0.5,0),Tr,s,wr,i,r),zo(ko.set(0.5,0.5,0),Tr,s,wr,i,r),fp.set(0,0),ic.set(1,0),dp.set(1,1);let o=e.ray.intersectTriangle(Bo,ps,ko,!1,fs);if(o===null){if(zo(ps.set(-0.5,0.5,0),Tr,s,wr,i,r),ic.set(0,1),o=e.ray.intersectTriangle(Bo,ko,ps,!1,fs),o===null)return}let a=e.ray.origin.distanceTo(fs);if(a<e.near||a>e.far)return;t.push({distance:a,point:fs.clone(),uv:dn.getInterpolation(fs,Bo,ps,ko,fp,ic,dp,new ne),face:null,object:this})}copy(e,t){if(super.copy(e,t),e.center!==void 0)this.center.copy(e.center);return this.material=e.material,this}}function zo(e,t,n,i,r,s){if(Er.subVectors(e,n).addScalar(0.5).multiply(i),r!==void 0)ds.x=s*Er.x-r*Er.y,ds.y=r*Er.x+s*Er.y;else ds.copy(Er);e.copy(t),e.x+=ds.x,e.y+=ds.y,e.applyMatrix4(Nm)}var ti=new L,rc=new L,Go=new L,Ho=new L;class bi{constructor(e=new L,t=new L(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,ti)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);if(n<0)return t.copy(this.origin);return t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=ti.subVectors(e,this.origin).dot(this.direction);if(t<0)return this.origin.distanceToSquared(e);return ti.copy(this.origin).addScaledVector(this.direction,t),ti.distanceToSquared(e)}distanceSqToSegment(e,t,n,i){rc.copy(e).add(t).multiplyScalar(0.5),Go.copy(t).sub(e).normalize(),Ho.copy(this.origin).sub(rc);let r=e.distanceTo(t)*0.5,s=-this.direction.dot(Go),o=Ho.dot(this.direction),a=-Ho.dot(Go),l=Ho.lengthSq(),c=Math.abs(1-s*s),u,f,h,d;if(c>0)if(u=s*a-o,f=s*o-a,d=r*c,u>=0)if(f>=-d)if(f<=d){let g=1/c;u*=g,f*=g,h=u*(u+s*f+2*o)+f*(s*u+f+2*a)+l}else f=r,u=Math.max(0,-(s*f+o)),h=-u*u+f*(f+2*a)+l;else f=-r,u=Math.max(0,-(s*f+o)),h=-u*u+f*(f+2*a)+l;else if(f<=-d)u=Math.max(0,-(-s*r+o)),f=u>0?-r:Math.min(Math.max(-r,-a),r),h=-u*u+f*(f+2*a)+l;else if(f<=d)u=0,f=Math.min(Math.max(-r,-a),r),h=f*(f+2*a)+l;else u=Math.max(0,-(s*r+o)),f=u>0?r:Math.min(Math.max(-r,-a),r),h=-u*u+f*(f+2*a)+l;else f=s>0?-r:r,u=Math.max(0,-(s*f+o)),h=-u*u+f*(f+2*a)+l;if(n)n.copy(this.origin).addScaledVector(this.direction,u);if(i)i.copy(rc).addScaledVector(Go,f);return h}intersectSphere(e,t){if(e.radius<0)return null;ti.subVectors(e.center,this.origin);let n=ti.dot(this.direction),i=ti.dot(ti)-n*n,r=e.radius*e.radius;if(i>r)return null;let s=Math.sqrt(r-i),o=n-s,a=n+s;if(a<0)return null;if(o<0)return this.at(a,t);return this.at(o,t)}intersectsSphere(e){if(e.radius<0)return!1;return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0){if(e.distanceToPoint(this.origin)===0)return 0;return null}let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);if(n===null)return null;return this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);if(t===0)return!0;if(e.normal.dot(this.direction)*t<0)return!0;return!1}intersectBox(e,t){let n,i,r,s,o,a,l=1/this.direction.x,c=1/this.direction.y,u=1/this.direction.z,f=this.origin;if(l>=0)n=(e.min.x-f.x)*l,i=(e.max.x-f.x)*l;else n=(e.max.x-f.x)*l,i=(e.min.x-f.x)*l;if(c>=0)r=(e.min.y-f.y)*c,s=(e.max.y-f.y)*c;else r=(e.max.y-f.y)*c,s=(e.min.y-f.y)*c;if(n>s||r>i)return null;if(r>n||isNaN(n))n=r;if(s<i||isNaN(i))i=s;if(u>=0)o=(e.min.z-f.z)*u,a=(e.max.z-f.z)*u;else o=(e.max.z-f.z)*u,a=(e.min.z-f.z)*u;if(n>a||o>i)return null;if(o>n||n!==n)n=o;if(a<i||i!==i)i=a;if(i<0)return null;return this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,ti)!==null}intersectTriangle(e,t,n,i,r){let s=this.origin,o=this.direction,{x:a,y:l,z:c}=o,u=e.x-s.x,f=e.y-s.y,h=e.z-s.z,d=t.x-s.x,g=t.y-s.y,_=t.z-s.z,m=n.x-s.x,p=n.y-s.y,x=n.z-s.z,S=Math.abs(a),v=Math.abs(l),b=Math.abs(c),w,E,y,A,N,P,D,W,R,I,k,z;if(S>=v&&S>=b)if(y=a,P=u,R=d,z=m,a>=0)w=l,E=c,A=f,N=h,D=g,W=_,I=p,k=x;else w=c,E=l,A=h,N=f,D=_,W=g,I=x,k=p;else if(v>=b)if(y=l,P=f,R=g,z=p,l>=0)w=c,E=a,A=h,N=u,D=_,W=d,I=x,k=m;else w=a,E=c,A=u,N=h,D=d,W=_,I=m,k=x;else if(y=c,P=h,R=_,z=x,c>=0)w=a,E=l,A=u,N=f,D=d,W=g,I=m,k=p;else w=l,E=a,A=f,N=u,D=g,W=d,I=p,k=m;if(y===0)return null;let te=w/y,Y=E/y,Q=1/y,G=A-te*P,ee=N-Y*P,oe=D-te*R,Fe=W-Y*R,Re=I-te*z,X=k-Y*z,se=Re*Fe-X*oe,le=G*X-ee*Re,Pe=oe*ee-Fe*G;if(i){if(se<0||le<0||Pe<0)return null}else if((se<0||le<0||Pe<0)&&(se>0||le>0||Pe>0))return null;let Ue=se+le+Pe;if(Ue===0)return null;let Ae=Q*(se*P+le*R+Pe*z);if(Ue>0?Ae<0:Ae>0)return null;return this.at(Ae/Ue,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class si extends Dn{constructor(e){super();this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Le(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Gn,this.combine=0,this.reflectivity=1,this.refractionRatio=0.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}var pp=new Je,Bi=new bi,Vo=new Yi,mp=new L,Wo=new L,Xo=new L,qo=new L,sc=new L,jo=new L,gp=new L,Yo=new L;class Bt extends Et{constructor(e=new xt,t=new si){super();this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){if(super.copy(e,t),e.morphTargetInfluences!==void 0)this.morphTargetInfluences=e.morphTargetInfluences.slice();if(e.morphTargetDictionary!==void 0)this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary);return this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){let o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){let n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,s=n.morphTargetsRelative;t.fromBufferAttribute(i,e);let o=this.morphTargetInfluences;if(r&&o){jo.set(0,0,0);for(let a=0,l=r.length;a<l;a++){let c=o[a],u=r[a];if(c===0)continue;if(sc.fromBufferAttribute(u,e),s)jo.addScaledVector(sc,c);else jo.addScaledVector(sc.sub(t),c)}t.add(jo)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.material,r=this.matrixWorld;if(i===void 0)return;if(n.boundingSphere===null)n.computeBoundingSphere();if(Vo.copy(n.boundingSphere),Vo.applyMatrix4(r),Bi.copy(e.ray).recast(e.near),Vo.containsPoint(Bi.origin)===!1){if(Bi.intersectSphere(Vo,mp)===null)return;if(Bi.origin.distanceToSquared(mp)>(e.far-e.near)**2)return}if(pp.copy(r).invert(),Bi.copy(e.ray).applyMatrix4(pp),n.boundingBox!==null){if(Bi.intersectsBox(n.boundingBox)===!1)return}this._computeIntersections(e,t,Bi)}_computeIntersections(e,t,n){let i,r=this.geometry,s=this.material,o=r.index,a=r.attributes.position,l=r.attributes.uv,c=r.attributes.uv1,u=r.attributes.normal,{groups:f,drawRange:h}=r;if(o!==null)if(Array.isArray(s))for(let d=0,g=f.length;d<g;d++){let _=f[d],m=s[_.materialIndex],p=Math.max(_.start,h.start),x=Math.min(o.count,Math.min(_.start+_.count,h.start+h.count));for(let S=p,v=x;S<v;S+=3){let b=o.getX(S),w=o.getX(S+1),E=o.getX(S+2);if(i=$o(this,m,e,n,l,c,u,b,w,E),i)i.faceIndex=Math.floor(S/3),i.face.materialIndex=_.materialIndex,t.push(i)}}else{let d=Math.max(0,h.start),g=Math.min(o.count,h.start+h.count);for(let _=d,m=g;_<m;_+=3){let p=o.getX(_),x=o.getX(_+1),S=o.getX(_+2);if(i=$o(this,s,e,n,l,c,u,p,x,S),i)i.faceIndex=Math.floor(_/3),t.push(i)}}else if(a!==void 0)if(Array.isArray(s))for(let d=0,g=f.length;d<g;d++){let _=f[d],m=s[_.materialIndex],p=Math.max(_.start,h.start),x=Math.min(a.count,Math.min(_.start+_.count,h.start+h.count));for(let S=p,v=x;S<v;S+=3){let b=S,w=S+1,E=S+2;if(i=$o(this,m,e,n,l,c,u,b,w,E),i)i.faceIndex=Math.floor(S/3),i.face.materialIndex=_.materialIndex,t.push(i)}}else{let d=Math.max(0,h.start),g=Math.min(a.count,h.start+h.count);for(let _=d,m=g;_<m;_+=3){let p=_,x=_+1,S=_+2;if(i=$o(this,s,e,n,l,c,u,p,x,S),i)i.faceIndex=Math.floor(_/3),t.push(i)}}}}function iy(e,t,n,i,r,s,o,a){let l;if(t.side===1)l=i.intersectTriangle(o,s,r,!0,a);else l=i.intersectTriangle(r,s,o,t.side===0,a);if(l===null)return null;Yo.copy(a),Yo.applyMatrix4(e.matrixWorld);let c=n.ray.origin.distanceTo(Yo);if(c<n.near||c>n.far)return null;return{distance:c,point:Yo.clone(),object:e}}function $o(e,t,n,i,r,s,o,a,l,c){e.getVertexPosition(a,Wo),e.getVertexPosition(l,Xo),e.getVertexPosition(c,qo);let u=iy(e,t,n,i,Wo,Xo,qo,gp);if(u){let f=new L;if(dn.getBarycoord(gp,Wo,Xo,qo,f),r)u.uv=dn.getInterpolatedAttribute(r,a,l,c,f,new ne);if(s)u.uv1=dn.getInterpolatedAttribute(s,a,l,c,f,new ne);if(o){if(u.normal=dn.getInterpolatedAttribute(o,a,l,c,f,new L),u.normal.dot(i.direction)>0)u.normal.multiplyScalar(-1)}let h={a,b:l,c,normal:new L,materialIndex:0};dn.getNormal(Wo,Xo,qo,h.normal),u.face=h,u.barycoord=f}return u}class hh extends Ft{constructor(e=null,t=1,n=1,i,r,s,o,a,l=1003,c=1003,u,f){super(null,s,o,a,l,c,i,r,u,f);this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}var ki=new Yi,ry=new ne(0.5,0.5),Zo=new L;class Bs{constructor(e=new on,t=new on,n=new on,i=new on,r=new on,s=new on){this.planes=[e,t,n,i,r,s]}set(e,t,n,i,r,s){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(i),o[4].copy(r),o[5].copy(s),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=2000,n=!1){let i=this.planes,r=e.elements,s=r[0],o=r[1],a=r[2],l=r[3],c=r[4],u=r[5],f=r[6],h=r[7],d=r[8],g=r[9],_=r[10],m=r[11],p=r[12],x=r[13],S=r[14],v=r[15];if(i[0].setComponents(l-s,h-c,m-d,v-p).normalize(),i[1].setComponents(l+s,h+c,m+d,v+p).normalize(),i[2].setComponents(l+o,h+u,m+g,v+x).normalize(),i[3].setComponents(l-o,h-u,m-g,v-x).normalize(),n)i[4].setComponents(a,f,_,S).normalize(),i[5].setComponents(l-a,h-f,m-_,v-S).normalize();else if(i[4].setComponents(l-a,h-f,m-_,v-S).normalize(),t===2000)i[5].setComponents(l+a,h+f,m+_,v+S).normalize();else if(t===2001)i[5].setComponents(a,f,_,S).normalize();else throw Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0){if(e.boundingSphere===null)e.computeBoundingSphere();ki.copy(e.boundingSphere).applyMatrix4(e.matrixWorld)}else{let t=e.geometry;if(t.boundingSphere===null)t.computeBoundingSphere();ki.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(ki)}intersectsSprite(e){ki.center.set(0,0,0);let t=ry.distanceTo(e.center);return ki.radius=0.7071067811865476+t,ki.applyMatrix4(e.matrixWorld),this.intersectsSphere(ki)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(Zo.x=i.normal.x>0?e.max.x:e.min.x,Zo.y=i.normal.y>0?e.max.y:e.min.y,Zo.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(Zo)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Wr extends Dn{constructor(e){super();this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Le(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}var ra=new L,sa=new L,_p=new Je,ms=new bi,Jo=new Yi,oc=new L,vp=new L;class Xr extends Et{constructor(e=new xt,t=new Wr){super();this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,r=t.count;i<r;i++)ra.fromBufferAttribute(t,i-1),sa.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=ra.distanceTo(sa);e.setAttribute("lineDistance",new rt(n,1))}else Ie("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Line.threshold,s=n.drawRange;if(n.boundingSphere===null)n.computeBoundingSphere();if(Jo.copy(n.boundingSphere),Jo.applyMatrix4(i),Jo.radius+=r,e.ray.intersectsSphere(Jo)===!1)return;_p.copy(i).invert(),ms.copy(e.ray).applyMatrix4(_p);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),a=o*o,l=this.isLineSegments?2:1,c=n.index,f=n.attributes.position;if(c!==null){let h=Math.max(0,s.start),d=Math.min(c.count,s.start+s.count);for(let g=h,_=d-1;g<_;g+=l){let m=c.getX(g),p=c.getX(g+1),x=Ko(this,e,ms,a,m,p,g);if(x)t.push(x)}if(this.isLineLoop){let g=c.getX(d-1),_=c.getX(h),m=Ko(this,e,ms,a,g,_,d-1);if(m)t.push(m)}}else{let h=Math.max(0,s.start),d=Math.min(f.count,s.start+s.count);for(let g=h,_=d-1;g<_;g+=l){let m=Ko(this,e,ms,a,g,g+1,g);if(m)t.push(m)}if(this.isLineLoop){let g=Ko(this,e,ms,a,d-1,h,d-1);if(g)t.push(g)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){let o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Ko(e,t,n,i,r,s,o){let a=e.geometry.attributes.position;if(ra.fromBufferAttribute(a,r),sa.fromBufferAttribute(a,s),n.distanceSqToSegment(ra,sa,oc,vp)>i)return;oc.applyMatrix4(e.matrixWorld);let c=t.ray.origin.distanceTo(oc);if(c<t.near||c>t.far)return;return{distance:c,point:vp.clone().applyMatrix4(e.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:e}}class uh extends Xr{constructor(e,t){super(e,t);this.isLineLoop=!0,this.type="LineLoop"}}class Sa extends Dn{constructor(e){super();this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Le(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}var yp=new Je,fc=new bi,Qo=new Yi,ea=new L;class fh extends Et{constructor(e=new xt,t=new Sa){super();this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Points.threshold,s=n.drawRange;if(n.boundingSphere===null)n.computeBoundingSphere();if(Qo.copy(n.boundingSphere),Qo.applyMatrix4(i),Qo.radius+=r,e.ray.intersectsSphere(Qo)===!1)return;yp.copy(i).invert(),fc.copy(e.ray).applyMatrix4(yp);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),a=o*o,l=n.index,u=n.attributes.position;if(l!==null){let f=Math.max(0,s.start),h=Math.min(l.count,s.start+s.count);for(let d=f,g=h;d<g;d++){let _=l.getX(d);ea.fromBufferAttribute(u,_),xp(ea,_,a,i,e,t,this)}}else{let f=Math.max(0,s.start),h=Math.min(u.count,s.start+s.count);for(let d=f,g=h;d<g;d++)ea.fromBufferAttribute(u,d),xp(ea,d,a,i,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){let o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function xp(e,t,n,i,r,s,o){let a=fc.distanceSqToPoint(e);if(a<n){let l=new L;fc.closestPointToPoint(e,l),l.applyMatrix4(i);let c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;s.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}class Ma extends Ft{constructor(e=[],t=301,n,i,r,s,o,a,l,c){super(e,t,n,i,r,s,o,a,l,c);this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class ks extends Ft{constructor(e,t,n,i,r,s,o,a,l){super(e,t,n,i,r,s,o,a,l);this.isCanvasTexture=!0,this.needsUpdate=!0}}class $i extends Ft{constructor(e,t,n=1014,i,r,s,o=1003,a=1003,l,c=1026,u=1){if(c!==1026&&c!==1027)throw Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let f={width:e,height:t,depth:u};super(f,i,r,s,o,a,c,n,l);this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Ds(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}}class dh extends $i{constructor(e,t=1014,n=301,i,r,s=1003,o=1003,a,l=1026){let c={width:e,height:e,depth:1},u=[c,c,c,c,c,c];super(e,e,t,n,i,r,s,o,a,l);this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class wa extends Ft{constructor(e=null){super();this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Zi extends xt{constructor(e=1,t=1,n=1,i=1,r=1,s=1){super();this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:r,depthSegments:s};let o=this;i=Math.floor(i),r=Math.floor(r),s=Math.floor(s);let a=[],l=[],c=[],u=[],f=0,h=0;d("z","y","x",-1,-1,n,t,e,s,r,0),d("z","y","x",1,-1,n,t,-e,s,r,1),d("x","z","y",1,1,e,n,t,i,s,2),d("x","z","y",1,-1,e,n,-t,i,s,3),d("x","y","z",1,-1,e,t,n,i,r,4),d("x","y","z",-1,-1,e,t,-n,i,r,5),this.setIndex(a),this.setAttribute("position",new rt(l,3)),this.setAttribute("normal",new rt(c,3)),this.setAttribute("uv",new rt(u,2));function d(g,_,m,p,x,S,v,b,w,E,y){let A=S/w,N=v/E,P=S/2,D=v/2,W=b/2,R=w+1,I=E+1,k=0,z=0,te=new L;for(let Y=0;Y<I;Y++){let Q=Y*N-D;for(let G=0;G<R;G++){let ee=G*A-P;te[g]=ee*p,te[_]=Q*x,te[m]=W,l.push(te.x,te.y,te.z),te[g]=0,te[_]=0,te[m]=b>0?1:-1,c.push(te.x,te.y,te.z),u.push(G/w),u.push(1-Y/E),k+=1}}for(let Y=0;Y<E;Y++)for(let Q=0;Q<w;Q++){let G=f+Q+R*Y,ee=f+Q+R*(Y+1),oe=f+(Q+1)+R*(Y+1),Fe=f+(Q+1)+R*Y;a.push(G,ee,Fe),a.push(ee,oe,Fe),z+=6}o.addGroup(h,z,y),h+=z,f+=k}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Zi(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class Ji extends xt{constructor(e=1,t=1,n=1,i=32,r=1,s=!1,o=0,a=Math.PI*2){super();this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:r,openEnded:s,thetaStart:o,thetaLength:a};let l=this;i=Math.floor(i),r=Math.floor(r);let c=[],u=[],f=[],h=[],d=0,g=[],_=n/2,m=0;if(p(),s===!1){if(e>0)x(!0);if(t>0)x(!1)}this.setIndex(c),this.setAttribute("position",new rt(u,3)),this.setAttribute("normal",new rt(f,3)),this.setAttribute("uv",new rt(h,2));function p(){let S=new L,v=new L,b=0,w=(t-e)/n;for(let E=0;E<=r;E++){let y=[],A=E/r,N=A*(t-e)+e;for(let P=0;P<=i;P++){let D=P/i,W=D*a+o,R=Math.sin(W),I=Math.cos(W);v.x=N*R,v.y=-A*n+_,v.z=N*I,u.push(v.x,v.y,v.z),S.set(R,w,I).normalize(),f.push(S.x,S.y,S.z),h.push(D,1-A),y.push(d++)}g.push(y)}for(let E=0;E<i;E++)for(let y=0;y<r;y++){let A=g[y][E],N=g[y+1][E],P=g[y+1][E+1],D=g[y][E+1];if(e>0||y!==0)c.push(A,N,D),b+=3;if(t>0||y!==r-1)c.push(N,P,D),b+=3}l.addGroup(m,b,0),m+=b}function x(S){let v=d,b=new ne,w=new L,E=0,y=S===!0?e:t,A=S===!0?1:-1;for(let P=1;P<=i;P++)u.push(0,_*A,0),f.push(0,A,0),h.push(0.5,0.5),d++;let N=d;for(let P=0;P<=i;P++){let W=P/i*a+o,R=Math.cos(W),I=Math.sin(W);w.x=y*I,w.y=_*A,w.z=y*R,u.push(w.x,w.y,w.z),f.push(0,A,0),b.x=R*0.5+0.5,b.y=I*0.5*A+0.5,h.push(b.x,b.y),d++}for(let P=0;P<i;P++){let D=v+P,W=N+P;if(S===!0)c.push(W,W+1,D);else c.push(W+1,W,D);E+=3}l.addGroup(m,E,S===!0?1:2),m+=E}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ji(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class zs extends Ji{constructor(e=1,t=1,n=32,i=1,r=!1,s=0,o=Math.PI*2){super(0,e,t,n,i,r,s,o);this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:s,thetaLength:o}}static fromJSON(e){return new zs(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Nn{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Ie("Curve: .getPoint() not implemented.")}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,i=this.getPoint(0),r=0;t.push(0);for(let s=1;s<=e;s++)n=this.getPoint(s/e),r+=n.distanceTo(i),t.push(r),i=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),i=0,r=n.length,s;if(t)s=t;else s=e*n[r-1];let o=0,a=r-1,l;while(o<=a)if(i=Math.floor(o+(a-o)/2),l=n[i]-s,l<0)o=i+1;else if(l>0)a=i-1;else{a=i;break}if(i=a,n[i]===s)return i/(r-1);let c=n[i],f=n[i+1]-c,h=(s-c)/f;return(i+h)/(r-1)}getTangent(e,t){let i=e-0.0001,r=e+0.0001;if(i<0)i=0;if(r>1)r=1;let s=this.getPoint(i),o=this.getPoint(r),a=t||(s.isVector2?new ne:new L);return a.copy(o).sub(s).normalize(),a}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new L,i=[],r=[],s=[],o=new L,a=new Je;for(let h=0;h<=e;h++){let d=h/e;i[h]=this.getTangentAt(d,new L)}r[0]=new L,s[0]=new L;let l=Number.MAX_VALUE,c=Math.abs(i[0].x),u=Math.abs(i[0].y),f=Math.abs(i[0].z);if(c<=l)l=c,n.set(1,0,0);if(u<=l)l=u,n.set(0,1,0);if(f<=l)n.set(0,0,1);o.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],o),s[0].crossVectors(i[0],r[0]);for(let h=1;h<=e;h++){if(r[h]=r[h-1].clone(),s[h]=s[h-1].clone(),o.crossVectors(i[h-1],i[h]),o.length()>Number.EPSILON){o.normalize();let d=Math.acos(He(i[h-1].dot(i[h]),-1,1));r[h].applyMatrix4(a.makeRotationAxis(o,d))}s[h].crossVectors(i[h],r[h])}if(t===!0){let h=Math.acos(He(r[0].dot(r[e]),-1,1));if(h/=e,i[0].dot(o.crossVectors(r[0],r[e]))>0)h=-h;for(let d=1;d<=e;d++)r[d].applyMatrix4(a.makeRotationAxis(i[d],h*d)),s[d].crossVectors(i[d],r[d])}return{tangents:i,normals:r,binormals:s}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}}class Ta extends Nn{constructor(e=0,t=0,n=1,i=1,r=0,s=Math.PI*2,o=!1,a=0){super();this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=s,this.aClockwise=o,this.aRotation=a}getPoint(e,t=new ne){let n=t,i=Math.PI*2,r=this.aEndAngle-this.aStartAngle,s=Math.abs(r)<Number.EPSILON;while(r<0)r+=i;while(r>i)r-=i;if(r<Number.EPSILON)if(s)r=0;else r=i;if(this.aClockwise===!0&&!s)if(r===i)r=-i;else r=r-i;let o=this.aStartAngle+e*r,a=this.aX+this.xRadius*Math.cos(o),l=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let c=Math.cos(this.aRotation),u=Math.sin(this.aRotation),f=a-this.aX,h=l-this.aY;a=f*c-h*u+this.aX,l=f*u+h*c+this.aY}return n.set(a,l)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}}class ph extends Ta{constructor(e,t,n,i,r,s){super(e,t,n,n,i,r,s);this.isArcCurve=!0,this.type="ArcCurve"}}function mh(){let e=0,t=0,n=0,i=0;function r(s,o,a,l){e=s,t=a,n=-3*s+3*o-2*a-l,i=2*s-2*o+a+l}return{initCatmullRom:function(s,o,a,l,c){r(o,a,c*(a-s),c*(l-o))},initNonuniformCatmullRom:function(s,o,a,l,c,u,f){let h=(o-s)/c-(a-s)/(c+u)+(a-o)/u,d=(a-o)/u-(l-o)/(u+f)+(l-a)/f;h*=u,d*=u,r(o,a,h,d)},calc:function(s){let o=s*s,a=o*s;return e+t*s+n*o+i*a}}}var bp=new L,Sp=new L,ac=new mh,lc=new mh,cc=new mh;class gh extends Nn{constructor(e=[],t=!1,n="centripetal",i=0.5){super();this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=i}getPoint(e,t=new L){let n=t,i=this.points,r=i.length,s=(r-(this.closed?0:1))*e,o=Math.floor(s),a=s-o;if(this.closed)o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r;else if(a===0&&o===r-1)o=r-2,a=1;let l,c;if(this.closed||o>0)l=i[(o-1)%r];else Sp.subVectors(i[0],i[1]).add(i[0]),l=Sp;let u=i[o%r],f=i[(o+1)%r];if(this.closed||o+2<r)c=i[(o+2)%r];else bp.subVectors(i[r-1],i[r-2]).add(i[r-1]),c=bp;if(this.curveType==="centripetal"||this.curveType==="chordal"){let h=this.curveType==="chordal"?0.5:0.25,d=Math.pow(l.distanceToSquared(u),h),g=Math.pow(u.distanceToSquared(f),h),_=Math.pow(f.distanceToSquared(c),h);if(g<0.0001)g=1;if(d<0.0001)d=g;if(_<0.0001)_=g;ac.initNonuniformCatmullRom(l.x,u.x,f.x,c.x,d,g,_),lc.initNonuniformCatmullRom(l.y,u.y,f.y,c.y,d,g,_),cc.initNonuniformCatmullRom(l.z,u.z,f.z,c.z,d,g,_)}else if(this.curveType==="catmullrom")ac.initCatmullRom(l.x,u.x,f.x,c.x,this.tension),lc.initCatmullRom(l.y,u.y,f.y,c.y,this.tension),cc.initCatmullRom(l.z,u.z,f.z,c.z,this.tension);return n.set(ac.calc(a),lc.calc(a),cc.calc(a)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new L().fromArray(i))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}}function Mp(e,t,n,i,r){let s=(i-t)*0.5,o=(r-n)*0.5,a=e*e,l=e*a;return(2*n-2*i+s+o)*l+(-3*n+3*i-2*s-o)*a+s*e+n}function sy(e,t){let n=1-e;return n*n*t}function oy(e,t){return 2*(1-e)*e*t}function ay(e,t){return e*e*t}function vs(e,t,n,i){return sy(e,t)+oy(e,n)+ay(e,i)}function ly(e,t){let n=1-e;return n*n*n*t}function cy(e,t){let n=1-e;return 3*n*n*e*t}function hy(e,t){return 3*(1-e)*e*e*t}function uy(e,t){return e*e*e*t}function ys(e,t,n,i,r){return ly(e,t)+cy(e,n)+hy(e,i)+uy(e,r)}class _h extends Nn{constructor(e=new ne,t=new ne,n=new ne,i=new ne){super();this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new ne){let n=t,i=this.v0,r=this.v1,s=this.v2,o=this.v3;return n.set(ys(e,i.x,r.x,s.x,o.x),ys(e,i.y,r.y,s.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class Gs extends Nn{constructor(e=new L,t=new L,n=new L,i=new L){super();this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new L){let n=t,i=this.v0,r=this.v1,s=this.v2,o=this.v3;return n.set(ys(e,i.x,r.x,s.x,o.x),ys(e,i.y,r.y,s.y,o.y),ys(e,i.z,r.z,s.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class vh extends Nn{constructor(e=new ne,t=new ne){super();this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new ne){let n=t;if(e===1)n.copy(this.v2);else n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1);return n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new ne){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class yh extends Nn{constructor(e=new L,t=new L){super();this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new L){let n=t;if(e===1)n.copy(this.v2);else n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1);return n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new L){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class xh extends Nn{constructor(e=new ne,t=new ne,n=new ne){super();this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new ne){let n=t,i=this.v0,r=this.v1,s=this.v2;return n.set(vs(e,i.x,r.x,s.x),vs(e,i.y,r.y,s.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class qr extends Nn{constructor(e=new L,t=new L,n=new L){super();this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new L){let n=t,i=this.v0,r=this.v1,s=this.v2;return n.set(vs(e,i.x,r.x,s.x),vs(e,i.y,r.y,s.y),vs(e,i.z,r.z,s.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class bh extends Nn{constructor(e=[]){super();this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new ne){let n=t,i=this.points,r=(i.length-1)*e,s=Math.floor(r),o=r-s,a=i[s===0?s:s-1],l=i[s],c=i[s>i.length-2?i.length-1:s+1],u=i[s>i.length-3?i.length-1:s+2];return n.set(Mp(o,a.x,l.x,c.x,u.x),Mp(o,a.y,l.y,c.y,u.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new ne().fromArray(i))}return this}}var fy=Object.freeze({__proto__:null,ArcCurve:ph,CatmullRomCurve3:gh,CubicBezierCurve:_h,CubicBezierCurve3:Gs,EllipseCurve:Ta,LineCurve:vh,LineCurve3:yh,QuadraticBezierCurve:xh,QuadraticBezierCurve3:qr,SplineCurve:bh});class Hs extends xt{constructor(e=1,t=1,n=1,i=1){super();this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let r=e/2,s=t/2,o=Math.floor(n),a=Math.floor(i),l=o+1,c=a+1,u=e/o,f=t/a,h=[],d=[],g=[],_=[];for(let m=0;m<c;m++){let p=m*f-s;for(let x=0;x<l;x++){let S=x*u-r;d.push(S,-p,0),g.push(0,0,1),_.push(x/o),_.push(1-m/a)}}for(let m=0;m<a;m++)for(let p=0;p<o;p++){let x=p+l*m,S=p+l*(m+1),v=p+1+l*(m+1),b=p+1+l*m;h.push(x,S,b),h.push(S,v,b)}this.setIndex(h),this.setAttribute("position",new rt(d,3)),this.setAttribute("normal",new rt(g,3)),this.setAttribute("uv",new rt(_,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Hs(e.width,e.height,e.widthSegments,e.heightSegments)}}class Ea extends xt{constructor(e=0.5,t=1,n=32,i=1,r=0,s=Math.PI*2){super();this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:i,thetaStart:r,thetaLength:s},n=Math.max(3,n),i=Math.max(1,i);let o=[],a=[],l=[],c=[],u=e,f=(t-e)/i,h=new L,d=new ne;for(let g=0;g<=i;g++){for(let _=0;_<=n;_++){let m=r+_/n*s;h.x=u*Math.cos(m),h.y=u*Math.sin(m),a.push(h.x,h.y,h.z),l.push(0,0,1),d.x=(h.x/t+1)/2,d.y=(h.y/t+1)/2,c.push(d.x,d.y)}u+=f}for(let g=0;g<i;g++){let _=g*(n+1);for(let m=0;m<n;m++){let p=m+_,x=p,S=p+n+1,v=p+n+2,b=p+1;o.push(x,S,b),o.push(S,v,b)}}this.setIndex(o),this.setAttribute("position",new rt(a,3)),this.setAttribute("normal",new rt(l,3)),this.setAttribute("uv",new rt(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ea(e.innerRadius,e.outerRadius,e.thetaSegments,e.phiSegments,e.thetaStart,e.thetaLength)}}class Si extends xt{constructor(e=1,t=32,n=16,i=0,r=Math.PI*2,s=0,o=Math.PI){super();this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:i,phiLength:r,thetaStart:s,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let a=Math.min(s+o,Math.PI),l=0,c=[],u=new L,f=new L,h=[],d=[],g=[],_=[];for(let m=0;m<=n;m++){let p=[],x=m/n,S=s+x*o,v=e*Math.cos(S),b=Math.sqrt(e*e-v*v),w=0;if(m===0&&s===0)w=0.5/t;else if(m===n&&a===Math.PI)w=-0.5/t;for(let E=0;E<=t;E++){let y=E/t,A=i+y*r;u.x=-b*Math.cos(A),u.y=v,u.z=b*Math.sin(A),d.push(u.x,u.y,u.z),f.copy(u).normalize(),g.push(f.x,f.y,f.z),_.push(y+w,1-x),p.push(l++)}c.push(p)}for(let m=0;m<n;m++)for(let p=0;p<t;p++){let x=c[m][p+1],S=c[m][p],v=c[m+1][p],b=c[m+1][p+1];if(m!==0||s>0)h.push(x,S,b);if(m!==n-1||a<Math.PI)h.push(S,v,b)}this.setIndex(h),this.setAttribute("position",new rt(d,3)),this.setAttribute("normal",new rt(g,3)),this.setAttribute("uv",new rt(_,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Si(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class Aa extends xt{constructor(e=1,t=0.4,n=12,i=48,r=Math.PI*2,s=0,o=Math.PI*2){super();this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:i,arc:r,thetaStart:s,thetaLength:o},n=Math.floor(n),i=Math.floor(i);let a=[],l=[],c=[],u=[],f=new L,h=new L,d=new L;for(let g=0;g<=n;g++){let _=s+g/n*o;for(let m=0;m<=i;m++){let p=m/i*r;h.x=(e+t*Math.cos(_))*Math.cos(p),h.y=(e+t*Math.cos(_))*Math.sin(p),h.z=t*Math.sin(_),l.push(h.x,h.y,h.z),f.x=e*Math.cos(p),f.y=e*Math.sin(p),d.subVectors(h,f).normalize(),c.push(d.x,d.y,d.z),u.push(m/i),u.push(g/n)}}for(let g=1;g<=n;g++)for(let _=1;_<=i;_++){let m=(i+1)*g+_-1,p=(i+1)*(g-1)+_-1,x=(i+1)*(g-1)+_,S=(i+1)*g+_;a.push(m,p,S),a.push(p,x,S)}this.setIndex(a),this.setAttribute("position",new rt(l,3)),this.setAttribute("normal",new rt(c,3)),this.setAttribute("uv",new rt(u,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Aa(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc,e.thetaStart,e.thetaLength)}}class Vs extends xt{constructor(e=new qr(new L(-1,-1,0),new L(-1,1,0),new L(1,1,0)),t=64,n=1,i=8,r=!1){super();this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:i,closed:r};let s=e.computeFrenetFrames(t,r);this.tangents=s.tangents,this.normals=s.normals,this.binormals=s.binormals;let o=new L,a=new L,l=new ne,c=new L,u=[],f=[],h=[],d=[];g(),this.setIndex(d),this.setAttribute("position",new rt(u,3)),this.setAttribute("normal",new rt(f,3)),this.setAttribute("uv",new rt(h,2));function g(){for(let x=0;x<t;x++)_(x);_(r===!1?t:0),p(),m()}function _(x){c=e.getPointAt(x/t,c);let S=s.normals[x],v=s.binormals[x];for(let b=0;b<=i;b++){let w=b/i*Math.PI*2,E=Math.sin(w),y=-Math.cos(w);a.x=y*S.x+E*v.x,a.y=y*S.y+E*v.y,a.z=y*S.z+E*v.z,a.normalize(),f.push(a.x,a.y,a.z),o.x=c.x+n*a.x,o.y=c.y+n*a.y,o.z=c.z+n*a.z,u.push(o.x,o.y,o.z)}}function m(){for(let x=1;x<=t;x++)for(let S=1;S<=i;S++){let v=(i+1)*(x-1)+(S-1),b=(i+1)*x+(S-1),w=(i+1)*x+S,E=(i+1)*(x-1)+S;d.push(v,b,E),d.push(b,w,E)}}function p(){for(let x=0;x<=t;x++)for(let S=0;S<=i;S++)l.x=x/t,l.y=S/i,h.push(l.x,l.y)}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new Vs(new fy[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}}function Ki(e){let t={};for(let n in e){t[n]={};for(let i in e[n]){let r=e[n][i];if(wp(r))if(r.isRenderTargetTexture)Ie("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[n][i]=null;else t[n][i]=r.clone();else if(Array.isArray(r))if(wp(r[0])){let s=[];for(let o=0,a=r.length;o<a;o++)s[o]=r[o].clone();t[n][i]=s}else t[n][i]=r.slice();else t[n][i]=r}}return t}function Yt(e){let t={};for(let n=0;n<e.length;n++){let i=Ki(e[n]);for(let r in i)t[r]=i[r]}return t}function wp(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function dy(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function Sh(e){let t=e.getRenderTarget();if(t===null)return e.outputColorSpace;if(t.isXRRenderTarget===!0)return t.texture.colorSpace;return We.workingColorSpace}var oi={clone:Ki,merge:Yt},py=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,my=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class At extends Dn{constructor(e){super();if(this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=py,this.fragmentShader=my,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0)this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ki(e.uniforms),this.uniformsGroups=dy(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let s=this.uniforms[i].value;if(s&&s.isTexture)t.uniforms[i]={type:"t",value:s.toJSON(e).uuid};else if(s&&s.isColor)t.uniforms[i]={type:"c",value:s.getHex()};else if(s&&s.isVector2)t.uniforms[i]={type:"v2",value:s.toArray()};else if(s&&s.isVector3)t.uniforms[i]={type:"v3",value:s.toArray()};else if(s&&s.isVector4)t.uniforms[i]={type:"v4",value:s.toArray()};else if(s&&s.isMatrix3)t.uniforms[i]={type:"m3",value:s.toArray()};else if(s&&s.isMatrix4)t.uniforms[i]={type:"m4",value:s.toArray()};else t.uniforms[i]={value:s}}if(Object.keys(this.defines).length>0)t.defines=this.defines;t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let i in this.extensions)if(this.extensions[i]===!0)n[i]=!0;if(Object.keys(n).length>0)t.extensions=n;return t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let i=e.uniforms[n];switch(this.uniforms[n]={},i.type){case"t":this.uniforms[n].value=t[i.value]||null;break;case"c":this.uniforms[n].value=new Le().setHex(i.value);break;case"v2":this.uniforms[n].value=new ne().fromArray(i.value);break;case"v3":this.uniforms[n].value=new L().fromArray(i.value);break;case"v4":this.uniforms[n].value=new gt().fromArray(i.value);break;case"m3":this.uniforms[n].value=new Be().fromArray(i.value);break;case"m4":this.uniforms[n].value=new Je().fromArray(i.value);break;default:this.uniforms[n].value=i.value}}if(e.defines!==void 0)this.defines=e.defines;if(e.vertexShader!==void 0)this.vertexShader=e.vertexShader;if(e.fragmentShader!==void 0)this.fragmentShader=e.fragmentShader;if(e.glslVersion!==void 0)this.glslVersion=e.glslVersion;if(e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];if(e.lights!==void 0)this.lights=e.lights;if(e.clipping!==void 0)this.clipping=e.clipping;return this}}class Ws extends At{constructor(e){super(e);this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class Mh extends Dn{constructor(e){super();this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Le(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Le(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new ne(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Gn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class Ca extends Dn{constructor(e){super();this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Le(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Le(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new ne(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Gn,this.combine=0,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=0.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class wh extends Dn{constructor(e){super();this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=3200,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Th extends Dn{constructor(e){super();this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}function Ar(e,t){if(!e||e.constructor===t)return e;if(typeof t.BYTES_PER_ELEMENT==="number")return new t(e);return Array.prototype.slice.call(e)}function hc(e){return e!==void 0&&e.inTangents!==void 0&&e.outTangents!==void 0}class Qi{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],r=t[n-1];e:{t:{let s;n:{i:if(!(e<i)){for(let o=n+2;;){if(i===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=i,i=t[++n],e<i)break t}s=t.length;break n}if(!(e>=r)){let o=t[1];if(e<o)n=2,r=o;for(let a=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(i=r,r=t[--n-1],e>=r)break t}s=n,n=0;break n}break e}while(n<s){let o=n+s>>>1;if(e<t[o])s=o;else n=o+1}if(i=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,i)}return this.interpolate_(n,r,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i;for(let s=0;s!==i;++s)t[s]=n[r+s];return t}interpolate_(){throw Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}}class Eh extends Qi{constructor(e,t,n,i){super(e,t,n,i);this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:2400,endingEnd:2400}}intervalChanged_(e,t,n){let i=this.parameterPositions,r=e-2,s=e+1,o=i[r],a=i[s];if(o===void 0)switch(this.getSettings_().endingStart){case 2401:r=e,o=2*t-n;break;case 2402:r=i.length-2,o=t+i[r]-i[r+1];break;default:r=e,o=n}if(a===void 0)switch(this.getSettings_().endingEnd){case 2401:s=e,a=2*n-t;break;case 2402:s=1,a=n+i[1]-i[0];break;default:s=e-1,a=t}let l=(n-t)*0.5,c=this.valueSize;this._weightPrev=l/(t-o),this._weightNext=l/(a-n),this._offsetPrev=r*c,this._offsetNext=s*c}interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,c=this._offsetPrev,u=this._offsetNext,f=this._weightPrev,h=this._weightNext,d=(n-t)/(i-t),g=d*d,_=g*d,m=-f*_+2*f*g-f*d,p=(1+f)*_+(-1.5-2*f)*g+(-0.5+f)*d+1,x=(-1-h)*_+(1.5+h)*g+0.5*d,S=h*_-h*g;for(let v=0;v!==o;++v)r[v]=m*s[c+v]+p*s[l+v]+x*s[a+v]+S*s[u+v];return r}}class Ah extends Qi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,c=(n-t)/(i-t),u=1-c;for(let f=0;f!==o;++f)r[f]=s[l+f]*u+s[a+f]*c;return r}}class Ch extends Qi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}}class Rh extends Qi{interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,c=this.inTangents,u=this.outTangents;if(!c||!u){let d=(n-t)/(i-t),g=1-d;for(let _=0;_!==o;++_)r[_]=s[l+_]*g+s[a+_]*d;return r}let f=o*2,h=e-1;for(let d=0;d!==o;++d){let g=s[l+d],_=s[a+d],m=h*f+d*2,p=u[m],x=u[m+1],S=e*f+d*2,v=c[S],b=c[S+1],w=_y(n,t,p,v,i);r[d]=Om(w,g,x,b,_)}return r}}function Om(e,t,n,i,r){let s=1-e;return s*s*s*t+3*s*s*e*n+3*s*e*e*i+e*e*e*r}function gy(e,t,n,i,r){let s=1-e;return 3*s*s*(n-t)+6*s*e*(i-n)+3*e*e*(r-i)}function _y(e,t,n,i,r){let s=(e-t)/(r-t);for(let o=0;o<8;o++){let a=Om(s,t,n,i,r)-e;if(Math.abs(a)<0.0000000001)break;let l=gy(s,t,n,i,r);if(Math.abs(l)<0.0000000001)break;s=Math.max(0,Math.min(1,s-a/l))}return s}class Sn{constructor(e,t,n,i){if(e===void 0)throw Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Ar(t,this.TimeBufferType),this.values=Ar(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Ar(e.times,Array),values:Ar(e.values,Array)};let i=e.getInterpolation();if(i!==e.DefaultInterpolation)n.interpolation=i;if(hc(e.settings))n.settings={inTangents:Ar(e.settings.inTangents,Array),outTangents:Ar(e.settings.outTangents,Array)}}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Ch(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Ah(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Eh(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new Rh(this.times,this.values,this.getValueSize(),e);if(this.settings)t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents;return t}setInterpolation(e){let t;switch(e){case 2300:t=this.InterpolantFactoryMethodDiscrete;break;case 2301:t=this.InterpolantFactoryMethodLinear;break;case 2302:t=this.InterpolantFactoryMethodSmooth;break;case 2303:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(n);return Ie("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return 2300;case this.InterpolantFactoryMethodLinear:return 2301;case this.InterpolantFactoryMethodSmooth:return 2302;case this.InterpolantFactoryMethodBezier:return 2303}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e;if(hc(this.settings))Tp(this.settings.inTangents,e),Tp(this.settings.outTangents,e)}return this}trim(e,t){let n=this.times,i=n.length,r=0,s=i-1;while(r!==i&&n[r]<e)++r;while(s!==-1&&n[s]>t)--s;if(++s,r!==0||s!==i){if(r>=s)s=Math.max(s,1),r=s-1;let o=this.getValueSize();this.times=n.slice(r,s),this.values=this.values.slice(r*o,s*o)}return this}validate(){let e=!0,t=this.getValueSize();if(t-Math.floor(t)!==0)Ne("KeyframeTrack: Invalid value size in track.",this),e=!1;let n=this.times,i=this.values,r=n.length;if(r===0)Ne("KeyframeTrack: Track is empty.",this),e=!1;let s=null;for(let o=0;o!==r;o++){let a=n[o];if(typeof a==="number"&&isNaN(a)){Ne("KeyframeTrack: Time is not a valid number.",this,o,a),e=!1;break}if(s!==null&&s>a){Ne("KeyframeTrack: Out of order keys.",this,o,a,s),e=!1;break}s=a}if(i!==void 0){if(wv(i))for(let o=0,a=i.length;o!==a;++o){let l=i[o];if(isNaN(l)){Ne("KeyframeTrack: Value is not a valid number.",this,o,l),e=!1;break}}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===2302,r=e.length-1,s=1;for(let o=1;o<r;++o){let a=!1,l=e[o],c=e[o+1];if(l!==c&&(o!==1||l!==e[0]))if(!i){let u=o*n,f=u-n,h=u+n;for(let d=0;d!==n;++d){let g=t[u+d];if(g!==t[f+d]||g!==t[h+d]){a=!0;break}}}else a=!0;if(a){if(o!==s){e[s]=e[o];let u=o*n,f=s*n;for(let h=0;h!==n;++h)t[f+h]=t[u+h]}++s}}if(r>0){e[s]=e[r];for(let o=r*n,a=s*n,l=0;l!==n;++l)t[a+l]=t[o+l];++s}if(s!==e.length)this.times=e.slice(0,s),this.values=t.slice(0,s*n);else this.times=e,this.values=t;return this}clone(){let e=this.times.slice(),t=this.values.slice(),i=new this.constructor(this.name,e,t);if(i.createInterpolant=this.createInterpolant,hc(this.settings))i.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()};return i}}function Tp(e,t){for(let n=0,i=e.length;n!==i;n+=2)e[n]*=t}Sn.prototype.ValueTypeName="";Sn.prototype.TimeBufferType=Float32Array;Sn.prototype.ValueBufferType=Float32Array;Sn.prototype.DefaultInterpolation=2301;class er extends Sn{constructor(e,t,n){super(e,t,n)}}er.prototype.ValueTypeName="bool";er.prototype.ValueBufferType=Array;er.prototype.DefaultInterpolation=2300;er.prototype.InterpolantFactoryMethodLinear=void 0;er.prototype.InterpolantFactoryMethodSmooth=void 0;class Ph extends Sn{constructor(e,t,n,i){super(e,t,n,i)}}Ph.prototype.ValueTypeName="color";class Ih extends Sn{constructor(e,t,n,i){super(e,t,n,i)}}Ih.prototype.ValueTypeName="number";class Lh extends Qi{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=(n-t)/(i-t),l=e*o;for(let c=l+o;l!==c;l+=4)Gt.slerpFlat(r,0,s,l-o,s,l,a);return r}}class Ra extends Sn{constructor(e,t,n,i){super(e,t,n,i)}InterpolantFactoryMethodLinear(e){return new Lh(this.times,this.values,this.getValueSize(),e)}}Ra.prototype.ValueTypeName="quaternion";Ra.prototype.InterpolantFactoryMethodSmooth=void 0;class tr extends Sn{constructor(e,t,n){super(e,t,n)}}tr.prototype.ValueTypeName="string";tr.prototype.ValueBufferType=Array;tr.prototype.DefaultInterpolation=2300;tr.prototype.InterpolantFactoryMethodLinear=void 0;tr.prototype.InterpolantFactoryMethodSmooth=void 0;class Dh extends Sn{constructor(e,t,n,i){super(e,t,n,i)}}Dh.prototype.ValueTypeName="vector";var ia={enabled:!1,files:{},add:function(e,t){if(this.enabled===!1)return;if(Ep(e))return;this.files[e]=t},get:function(e){if(this.enabled===!1)return;if(Ep(e))return;return this.files[e]},remove:function(e){delete this.files[e]},clear:function(){this.files={}}};function Ep(e){try{let t=e.slice(e.indexOf(":")+1);return new URL(t).protocol==="blob:"}catch(t){return!1}}class Nh{constructor(e,t,n){let i=this,r=!1,s=0,o=0,a=void 0,l=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(c){if(o++,r===!1){if(i.onStart!==void 0)i.onStart(c,s,o)}r=!0},this.itemEnd=function(c){if(s++,i.onProgress!==void 0)i.onProgress(c,s,o);if(s===o){if(r=!1,i.onLoad!==void 0)i.onLoad()}},this.itemError=function(c){if(i.onError!==void 0)i.onError(c)},this.resolveURL=function(c){if(c=c.normalize("NFC"),a)return a(c);return c},this.setURLModifier=function(c){return a=c,this},this.addHandler=function(c,u){return l.push(c,u),this},this.removeHandler=function(c){let u=l.indexOf(c);if(u!==-1)l.splice(u,2);return this},this.getHandler=function(c){for(let u=0,f=l.length;u<f;u+=2){let h=l[u],d=l[u+1];if(h.global)h.lastIndex=0;if(h.test(c))return d}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){if(!this._abortController)this._abortController=new AbortController;return this._abortController}}var Um=new Nh;class Xs{constructor(e){if(this.manager=e!==void 0?e:Um,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,r){n.load(e,i,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}}Xs.DEFAULT_MATERIAL_NAME="__DEFAULT";var Cr=new WeakMap;class Oh extends Xs{constructor(e){super(e)}load(e,t,n,i){if(this.path!==void 0)e=this.path+e;e=this.manager.resolveURL(e);let r=this,s=ia.get(`image:${e}`);if(s!==void 0){if(s.complete===!0)r.manager.itemStart(e),setTimeout(function(){if(t)t(s);r.manager.itemEnd(e)},0);else{let u=Cr.get(s);if(u===void 0)u=[],Cr.set(s,u);u.push({onLoad:t,onError:i})}return s}let o=Lr("img");function a(){if(c(),t)t(this);let u=Cr.get(this)||[];for(let f=0;f<u.length;f++){let h=u[f];if(h.onLoad)h.onLoad(this)}Cr.delete(this),r.manager.itemEnd(e)}function l(u){if(c(),i)i(u);ia.remove(`image:${e}`);let f=Cr.get(this)||[];for(let h=0;h<f.length;h++){let d=f[h];if(d.onError)d.onError(u)}Cr.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function c(){o.removeEventListener("load",a,!1),o.removeEventListener("error",l,!1)}if(o.addEventListener("load",a,!1),o.addEventListener("error",l,!1),e.slice(0,5)!=="data:"){if(this.crossOrigin!==void 0)o.crossOrigin=this.crossOrigin}return ia.add(`image:${e}`,o),r.manager.itemStart(e),o.src=e,o}}class Pa extends Xs{constructor(e){super(e)}load(e,t,n,i){let r=new Ft,s=new Oh(this.manager);return s.setCrossOrigin(this.crossOrigin),s.setPath(this.path),s.load(e,function(o){if(r.image=o,r.needsUpdate=!0,t!==void 0)t(r)},n,i),r}}class qs extends Et{constructor(e,t=1){super();this.isLight=!0,this.type="Light",this.color=new Le(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}}var uc=new Je,Ap=new L,Cp=new L;class Ia{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ne(512,512),this.mapType=1009,this.map=null,this.mapPass=null,this.matrix=new Je,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Bs,this._frameExtents=new ne(1,1),this._viewportCount=1,this._viewports=[new gt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;Ap.setFromMatrixPosition(e.matrixWorld),t.position.copy(Ap),Cp.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Cp),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,i){uc.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(uc,e.coordinateSystem,e.reversedDepth);let r=this._frameExtents,s=i?i.z/r.x:1,o=i?i.w/r.y:1,a=i?i.x/r.x:0,l=i?i.y/r.y:0;if(e.coordinateSystem===2001||e.reversedDepth)t.set(0.5*s,0,0,0.5*s+a,0,0.5*o,0,0.5*o+l,0,0,1,0,0,0,0,1);else t.set(0.5*s,0,0,0.5*s+a,0,0.5*o,0,0.5*o+l,0,0,0.5,0.5,0,0,0,1);t.multiply(uc)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){if(this.map)this.map.dispose();if(this.mapPass)this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}var ta=new L,na=new Gt,kn=new L;class La extends Et{constructor(){super();this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Je,this.projectionMatrix=new Je,this.projectionMatrixInverse=new Je,this.coordinateSystem=2000,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){if(super.updateMatrixWorld(e),this.matrixWorld.decompose(ta,na,kn),kn.x===1&&kn.y===1&&kn.z===1)this.matrixWorldInverse.copy(this.matrixWorld).invert();else this.matrixWorldInverse.compose(ta,na,kn.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){if(super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(ta,na,kn),kn.x===1&&kn.y===1&&kn.z===1)this.matrixWorldInverse.copy(this.matrixWorld).invert();else this.matrixWorldInverse.compose(ta,na,kn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}var vi=new L,Rp=new ne,Pp=new ne;class zt extends La{constructor(e=50,t=1,n=0.1,i=2000){super();this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=0.5*this.getFilmHeight()/e;this.fov=Nr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(gs*0.5*this.fov);return 0.5*this.getFilmHeight()/e}getEffectiveFOV(){return Nr*2*Math.atan(Math.tan(gs*0.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){vi.set(-1,-1,0.5).applyMatrix4(this.projectionMatrixInverse),t.set(vi.x,vi.y).multiplyScalar(-e/vi.z),vi.set(1,1,0.5).applyMatrix4(this.projectionMatrixInverse),n.set(vi.x,vi.y).multiplyScalar(-e/vi.z)}getViewSize(e,t){return this.getViewBounds(e,Rp,Pp),t.subVectors(Pp,Rp)}setViewOffset(e,t,n,i,r,s){if(this.aspect=e/t,this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(gs*0.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,r=-0.5*i,s=this.view;if(this.view!==null&&this.view.enabled){let{fullWidth:a,fullHeight:l}=s;r+=s.offsetX*i/a,t-=s.offsetY*n/l,i*=s.width/a,n*=s.height/l}let o=this.filmOffset;if(o!==0)r+=e*o/this.getFilmWidth();this.projectionMatrix.makePerspective(r,r+i,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);if(t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null)t.object.view=Object.assign({},this.view);return t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class Fm extends Ia{constructor(){super(new zt(90,1,0.5,500));this.isPointLightShadow=!0}}class Uh extends qs{constructor(e,t,n=0,i=2){super(e,t);this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new Fm}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}}class nr extends La{constructor(e=-1,t=1,n=1,i=-1,r=0.1,s=2000){super();this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=r,this.far=s,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,r,s){if(this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,r=n-e,s=n+e,o=i+t,a=i-t;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,c=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,s=r+l*this.view.width,o-=c*this.view.offsetY,a=o-c*this.view.height}this.projectionMatrix.makeOrthographic(r,s,o,a,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);if(t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null)t.object.view=Object.assign({},this.view);return t}}class Bm extends Ia{constructor(){super(new nr(-5,5,5,-5,0.5,500));this.isDirectionalLightShadow=!0}}class Da extends qs{constructor(e,t){super(e,t);this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Et.DEFAULT_UP),this.updateMatrix(),this.target=new Et,this.shadow=new Bm}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}}class js extends qs{constructor(e,t){super(e,t);this.isAmbientLight=!0,this.type="AmbientLight"}}var Rr=-90,Pr=1;class Fh extends Et{constructor(e,t,n){super();this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let i=new zt(Rr,Pr,e,t);i.layers=this.layers,this.add(i);let r=new zt(Rr,Pr,e,t);r.layers=this.layers,this.add(r);let s=new zt(Rr,Pr,e,t);s.layers=this.layers,this.add(s);let o=new zt(Rr,Pr,e,t);o.layers=this.layers,this.add(o);let a=new zt(Rr,Pr,e,t);a.layers=this.layers,this.add(a);let l=new zt(Rr,Pr,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,i,r,s,o,a]=t;for(let l of t)this.remove(l);if(e===2000)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),s.up.set(0,0,1),s.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),a.up.set(0,1,0),a.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),s.up.set(0,0,-1),s.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),a.up.set(0,-1,0),a.lookAt(0,0,-1);else throw Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let l of t)this.add(l),l.updateMatrixWorld()}update(e,t){if(this.parent===null)this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:i}=this;if(this.coordinateSystem!==e.coordinateSystem)this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem();let[r,s,o,a,l,c]=this.children,u=e.getRenderTarget(),f=e.getActiveCubeFace(),h=e.getActiveMipmapLevel(),d=e.xr.enabled;e.xr.enabled=!1;let g=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let _=!1;if(e.isWebGLRenderer===!0)_=e.state.buffers.depth.getReversed();else _=e.reversedDepthBuffer;if(e.setRenderTarget(n,0,i),_&&e.autoClear===!1)e.clearDepth();if(e.render(t,r),e.setRenderTarget(n,1,i),_&&e.autoClear===!1)e.clearDepth();if(e.render(t,s),e.setRenderTarget(n,2,i),_&&e.autoClear===!1)e.clearDepth();if(e.render(t,o),e.setRenderTarget(n,3,i),_&&e.autoClear===!1)e.clearDepth();if(e.render(t,a),e.setRenderTarget(n,4,i),_&&e.autoClear===!1)e.clearDepth();if(e.render(t,l),n.texture.generateMipmaps=g,e.setRenderTarget(n,5,i),_&&e.autoClear===!1)e.clearDepth();e.render(t,c),e.setRenderTarget(u,f,h),e.xr.enabled=d,n.texture.needsPMREMUpdate=!0}}class Bh extends zt{constructor(e=[]){super();this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class jr{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){if(this._document=e,e.hidden!==void 0)this._pageVisibilityHandler=vy.bind(this),e.addEventListener("visibilitychange",this._pageVisibilityHandler,!1)}disconnect(){if(this._pageVisibilityHandler!==null)this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null;this._document=null}getDelta(){return this._delta/1000}getElapsed(){return this._elapsed/1000}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){if(this._pageVisibilityHandler!==null&&this._document.hidden===!0)this._delta=0;else this._previousTime=this._currentTime,this._currentTime=(e!==void 0?e:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta;return this}}function vy(){if(this._document.hidden===!1)this.reset()}var kh="\\[\\]\\.:\\/",yy=new RegExp("["+kh+"]","g"),zh="[^"+kh+"]",xy="[^"+kh.replace("\\.","")+"]",by=/((?:WC+[\/:])*)/.source.replace("WC",zh),Sy=/(WCOD+)?/.source.replace("WCOD",xy),My=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",zh),wy=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",zh),Ty=new RegExp("^"+by+Sy+My+wy+"$"),Ey=["material","materials","bones","map"];class km{constructor(e,t,n){let i=n||at.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];if(i!==void 0)i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=n.length;i!==r;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}}class at{constructor(e,t,n){this.path=t,this.parsedPath=n||at.parseTrackName(t),this.node=at.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){if(!(e&&e.isAnimationObjectGroup))return new at(e,t,n);else return new at.Composite(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(yy,"")}static parseTrackName(e){let t=Ty.exec(e);if(t===null)throw Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let r=n.nodeName.substring(i+1);if(Ey.indexOf(r)!==-1)n.nodeName=n.nodeName.substring(0,i),n.objectName=r}if(n.propertyName===null||n.propertyName.length===0)throw Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(r){for(let s=0;s<r.length;s++){let o=r[s];if(o.name===t||o.uuid===t)return o;let a=n(o.children);if(a)return a}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,{objectName:n,propertyName:i,propertyIndex:r}=t;if(!e)e=at.findNode(this.rootNode,t.nodeName),this.node=e;if(this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Ie("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let l=t.objectIndex;switch(n){case"materials":if(!e.material){Ne("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ne("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ne("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let c=0;c<e.length;c++)if(e[c].name===l){l=c;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ne("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ne("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){Ne("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(l!==void 0){if(e[l]===void 0){Ne("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[l]}}let s=e[i];if(s===void 0){let l=t.nodeName;Ne("PropertyBinding: Trying to update property for track: "+l+"."+i+" but it wasn't found.",e);return}let o=this.Versioning.None;if(this.targetObject=e,e.isMaterial===!0)o=this.Versioning.NeedsUpdate;else if(e.isObject3D===!0)o=this.Versioning.MatrixWorldNeedsUpdate;let a=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){Ne("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ne("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}if(e.morphTargetDictionary[r]!==void 0)r=e.morphTargetDictionary[r]}a=this.BindingType.ArrayElement,this.resolvedProperty=s,this.propertyIndex=r}else if(s.fromArray!==void 0&&s.toArray!==void 0)a=this.BindingType.HasFromToArray,this.resolvedProperty=s;else if(Array.isArray(s))a=this.BindingType.EntireArray,this.resolvedProperty=s;else this.propertyName=i;this.getValue=this.GetterByBindingType[a],this.setValue=this.SetterByBindingTypeAndVersioning[a][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}at.Composite=km;at.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};at.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};at.prototype.GetterByBindingType=[at.prototype._getValue_direct,at.prototype._getValue_array,at.prototype._getValue_arrayElement,at.prototype._getValue_toArray];at.prototype.SetterByBindingTypeAndVersioning=[[at.prototype._setValue_direct,at.prototype._setValue_direct_setNeedsUpdate,at.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[at.prototype._setValue_array,at.prototype._setValue_array_setNeedsUpdate,at.prototype._setValue_array_setMatrixWorldNeedsUpdate],[at.prototype._setValue_arrayElement,at.prototype._setValue_arrayElement_setNeedsUpdate,at.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[at.prototype._setValue_fromArray,at.prototype._setValue_fromArray_setNeedsUpdate,at.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var eR=new Float32Array(1);var Ip=new Je;class ir{constructor(e,t,n=0,i=1/0){this.ray=new bi(e,t),this.near=n,this.far=i,this.camera=null,this.layers=new Ns,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){if(t.isPerspectiveCamera)this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,0.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t;else if(t.isOrthographicCamera)this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t;else Ne("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return Ip.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Ip),this}intersectObject(e,t=!0,n=[]){return dc(e,this,n,t),n.sort(Lp),n}intersectObjects(e,t=!0,n=[]){for(let i=0,r=e.length;i<r;i++)dc(e[i],this,n,t);return n.sort(Lp),n}}function Lp(e,t){return e.distance-t.distance}function dc(e,t,n,i){let r=!0;if(e.layers.test(t.layers)){if(e.raycast(t,n)===!1)r=!1}if(r===!0&&i===!0){let s=e.children;for(let o=0,a=s.length;o<a;o++)dc(s[o],t,n,!0)}}class Ys{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=He(this.phi,0.000001,Math.PI-0.000001),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){if(this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0)this.theta=0,this.phi=0;else this.theta=Math.atan2(e,n),this.phi=Math.acos(He(t/this.radius,-1,1));return this}clone(){return new this.constructor().copy(this)}}class Gh{static{Gh.prototype.isMatrix2=!0}constructor(e,t,n,i){if(this.elements=[1,0,0,1],e!==void 0)this.set(e,t,n,i)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,i){let r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=i,this}}class Wn extends Vn{constructor(e,t=null){super();this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(this.domElement!==null)this.disconnect();this.domElement=e}disconnect(){}dispose(){}update(){}}function Hh(e,t,n,i){let r=Ay(i);switch(n){case 1021:return e*t;case 1028:return e*t/r.components*r.byteLength;case 1029:return e*t/r.components*r.byteLength;case 1030:return e*t*2/r.components*r.byteLength;case 1031:return e*t*2/r.components*r.byteLength;case 1022:return e*t*3/r.components*r.byteLength;case 1023:return e*t*4/r.components*r.byteLength;case 1033:return e*t*4/r.components*r.byteLength;case 33776:case 33777:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case 33778:case 33779:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 35841:case 35843:return Math.max(e,16)*Math.max(t,8)/4;case 35840:case 35842:return Math.max(e,8)*Math.max(t,8)/2;case 36196:case 37492:case 37488:case 37489:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case 37496:case 37490:case 37491:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 37808:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 37809:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case 37810:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case 37811:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case 37812:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case 37813:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case 37814:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case 37815:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case 37816:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case 37817:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case 37818:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case 37819:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case 37820:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case 37821:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case 36492:case 36494:case 36495:return Math.ceil(e/4)*Math.ceil(t/4)*16;case 36283:case 36284:return Math.ceil(e/4)*Math.ceil(t/4)*8;case 36285:case 36286:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function Ay(e){switch(e){case 1009:case 1010:return{byteLength:1,components:1};case 1012:case 1011:case 1016:return{byteLength:2,components:1};case 1017:case 1018:return{byteLength:2,components:4};case 1014:case 1013:case 1015:return{byteLength:4,components:1};case 35902:case 35899:return{byteLength:4,components:3}}throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}if(typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));if(typeof window<"u")if(window.__THREE__)Ie("WARNING: Multiple instances of Three.js being imported.");else window.__THREE__="186";function ag(){let e=null,t=!1,n=null,i=null;function r(s,o){i=e.requestAnimationFrame(r),n(s,o)}return{start:function(){if(t===!0)return;if(n===null)return;if(e===null)return;i=e.requestAnimationFrame(r),t=!0},stop:function(){if(e!==null)e.cancelAnimationFrame(i);t=!1},setAnimationLoop:function(s){n=s},setContext:function(s){e=s}}}function Cy(e){let t=new WeakMap;function n(a,l){let{array:c,usage:u}=a,f=c.byteLength,h=e.createBuffer();e.bindBuffer(l,h),e.bufferData(l,c,u),a.onUploadCallback();let d;if(c instanceof Float32Array)d=e.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)d=e.HALF_FLOAT;else if(c instanceof Uint16Array)if(a.isFloat16BufferAttribute)d=e.HALF_FLOAT;else d=e.UNSIGNED_SHORT;else if(c instanceof Int16Array)d=e.SHORT;else if(c instanceof Uint32Array)d=e.UNSIGNED_INT;else if(c instanceof Int32Array)d=e.INT;else if(c instanceof Int8Array)d=e.BYTE;else if(c instanceof Uint8Array)d=e.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)d=e.UNSIGNED_BYTE;else throw Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:h,type:d,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function i(a,l,c){let{array:u,updateRanges:f}=l;if(e.bindBuffer(c,a),f.length===0)e.bufferSubData(c,0,u);else{f.sort((d,g)=>d.start-g.start);let h=0;for(let d=1;d<f.length;d++){let g=f[h],_=f[d];if(_.start<=g.start+g.count+1)g.count=Math.max(g.count,_.start+_.count-g.start);else++h,f[h]=_}f.length=h+1;for(let d=0,g=f.length;d<g;d++){let _=f[d];e.bufferSubData(c,_.start*u.BYTES_PER_ELEMENT,u,_.start,_.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(a){if(a.isInterleavedBufferAttribute)a=a.data;return t.get(a)}function s(a){if(a.isInterleavedBufferAttribute)a=a.data;let l=t.get(a);if(l)e.deleteBuffer(l.buffer),t.delete(a)}function o(a,l){if(a.isInterleavedBufferAttribute)a=a.data;if(a.isGLBufferAttribute){let u=t.get(a);if(!u||u.version<a.version)t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=t.get(a);if(c===void 0)t.set(a,n(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:r,remove:s,update:o}}var Ry=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Py=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Iy=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Ly=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Dy=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Ny=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Oy=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Uy=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Fy=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,By=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,ky=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,zy=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Gy=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Hy=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Vy=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Wy=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Xy=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,qy=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,jy=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Yy=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,$y=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Zy=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Jy=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Ky=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Qy=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,ex=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,tx=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,nx=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,ix=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,rx=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,sx="gl_FragColor = linearToOutputTexel( gl_FragColor );",ox=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,ax=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,lx=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,cx=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,hx=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,ux=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fx=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,dx=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,px=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,mx=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gx=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,_x=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,vx=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,yx=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,xx=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,bx=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,Sx=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Mx=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,wx=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Tx=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Ex=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Ax=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Cx=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Rx=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Px=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Ix=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Lx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Dx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Nx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Ox=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Ux=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Fx=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Bx=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,kx=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,zx=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Gx=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Hx=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Vx=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Wx=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Xx=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,qx=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,jx=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Yx=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,$x=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Zx=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Jx=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Kx=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Qx=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,eb=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,tb=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,nb=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,ib=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,rb=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,sb=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,ob=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,ab=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,lb=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,cb=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,hb=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,ub=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,fb=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,db=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,pb=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,mb=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,gb=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,_b=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,vb=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,yb=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,xb=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,bb=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Sb=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Mb=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,wb=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Tb=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Eb=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Ab=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`;var Cb=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,Rb=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Pb=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Ib=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Lb=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Db=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Nb=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Ob=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Ub=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Fb=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Bb=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,kb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,zb=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Gb=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Hb=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Vb=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Wb=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Xb=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,qb=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,jb=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Yb=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,$b=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Zb=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Jb=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Kb=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Qb=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,eS=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,tS=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,nS=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,iS=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,rS=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sS=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,oS=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,aS=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,lS=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ve={alphahash_fragment:Ry,alphahash_pars_fragment:Py,alphamap_fragment:Iy,alphamap_pars_fragment:Ly,alphatest_fragment:Dy,alphatest_pars_fragment:Ny,aomap_fragment:Oy,aomap_pars_fragment:Uy,batching_pars_vertex:Fy,batching_vertex:By,begin_vertex:ky,beginnormal_vertex:zy,bsdfs:Gy,iridescence_fragment:Hy,bumpmap_pars_fragment:Vy,clipping_planes_fragment:Wy,clipping_planes_pars_fragment:Xy,clipping_planes_pars_vertex:qy,clipping_planes_vertex:jy,color_fragment:Yy,color_pars_fragment:$y,color_pars_vertex:Zy,color_vertex:Jy,common:Ky,cube_uv_reflection_fragment:Qy,defaultnormal_vertex:ex,displacementmap_pars_vertex:tx,displacementmap_vertex:nx,emissivemap_fragment:ix,emissivemap_pars_fragment:rx,colorspace_fragment:sx,colorspace_pars_fragment:ox,envmap_fragment:ax,envmap_common_pars_fragment:lx,envmap_pars_fragment:cx,envmap_pars_vertex:hx,envmap_physical_pars_fragment:bx,envmap_vertex:ux,fog_vertex:fx,fog_pars_vertex:dx,fog_fragment:px,fog_pars_fragment:mx,gradientmap_pars_fragment:gx,lightmap_pars_fragment:_x,lights_lambert_fragment:vx,lights_lambert_pars_fragment:yx,lights_pars_begin:xx,lights_toon_fragment:Sx,lights_toon_pars_fragment:Mx,lights_phong_fragment:wx,lights_phong_pars_fragment:Tx,lights_physical_fragment:Ex,lights_physical_pars_fragment:Ax,lights_fragment_begin:Cx,lights_fragment_maps:Rx,lights_fragment_end:Px,lightprobes_pars_fragment:Ix,logdepthbuf_fragment:Lx,logdepthbuf_pars_fragment:Dx,logdepthbuf_pars_vertex:Nx,logdepthbuf_vertex:Ox,map_fragment:Ux,map_pars_fragment:Fx,map_particle_fragment:Bx,map_particle_pars_fragment:kx,metalnessmap_fragment:zx,metalnessmap_pars_fragment:Gx,morphinstance_vertex:Hx,morphcolor_vertex:Vx,morphnormal_vertex:Wx,morphtarget_pars_vertex:Xx,morphtarget_vertex:qx,normal_fragment_begin:jx,normal_fragment_maps:Yx,normal_pars_fragment:$x,normal_pars_vertex:Zx,normal_vertex:Jx,normalmap_pars_fragment:Kx,clearcoat_normal_fragment_begin:Qx,clearcoat_normal_fragment_maps:eb,clearcoat_pars_fragment:tb,iridescence_pars_fragment:nb,opaque_fragment:ib,packing:rb,premultiplied_alpha_fragment:sb,project_vertex:ob,dithering_fragment:ab,dithering_pars_fragment:lb,roughnessmap_fragment:cb,roughnessmap_pars_fragment:hb,shadowmap_pars_fragment:ub,shadowmap_pars_vertex:fb,shadowmap_vertex:db,shadowmask_pars_fragment:pb,skinbase_vertex:mb,skinning_pars_vertex:gb,skinning_vertex:_b,skinnormal_vertex:vb,specularmap_fragment:yb,specularmap_pars_fragment:xb,tonemapping_fragment:bb,tonemapping_pars_fragment:Sb,transmission_fragment:Mb,transmission_pars_fragment:wb,uv_pars_fragment:Tb,uv_pars_vertex:Eb,uv_vertex:Ab,worldpos_vertex:Cb,background_vert:Rb,background_frag:Pb,backgroundCube_vert:Ib,backgroundCube_frag:Lb,cube_vert:Db,cube_frag:Nb,depth_vert:Ob,depth_frag:Ub,distance_vert:Fb,distance_frag:Bb,equirect_vert:kb,equirect_frag:zb,linedashed_vert:Gb,linedashed_frag:Hb,meshbasic_vert:Vb,meshbasic_frag:Wb,meshlambert_vert:Xb,meshlambert_frag:qb,meshmatcap_vert:jb,meshmatcap_frag:Yb,meshnormal_vert:$b,meshnormal_frag:Zb,meshphong_vert:Jb,meshphong_frag:Kb,meshphysical_vert:Qb,meshphysical_frag:eS,meshtoon_vert:tS,meshtoon_frag:nS,points_vert:iS,points_frag:rS,shadow_vert:sS,shadow_frag:oS,sprite_vert:aS,sprite_frag:lS},pe={common:{diffuse:{value:new Le(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Be},alphaMap:{value:null},alphaMapTransform:{value:new Be},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Be}},envmap:{envMap:{value:null},envMapRotation:{value:new Be},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:0.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Be}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Be}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Be},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Be},normalScale:{value:new ne(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Be},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Be}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Be}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Be}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:0.00025},fogNear:{value:1},fogFar:{value:2000},fogColor:{value:new Le(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new L},probesMax:{value:new L},probesResolution:{value:new L}},points:{diffuse:{value:new Le(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Be},alphaTest:{value:0},uvTransform:{value:new Be}},sprite:{diffuse:{value:new Le(16777215)},opacity:{value:1},center:{value:new ne(0.5,0.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Be},alphaMap:{value:null},alphaMapTransform:{value:new Be},alphaTest:{value:0}}},qn={basic:{uniforms:Yt([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.fog]),vertexShader:Ve.meshbasic_vert,fragmentShader:Ve.meshbasic_frag},lambert:{uniforms:Yt([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,pe.lights,{emissive:{value:new Le(0)},envMapIntensity:{value:1}}]),vertexShader:Ve.meshlambert_vert,fragmentShader:Ve.meshlambert_frag},phong:{uniforms:Yt([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,pe.lights,{emissive:{value:new Le(0)},specular:{value:new Le(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Ve.meshphong_vert,fragmentShader:Ve.meshphong_frag},standard:{uniforms:Yt([pe.common,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.roughnessmap,pe.metalnessmap,pe.fog,pe.lights,{emissive:{value:new Le(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ve.meshphysical_vert,fragmentShader:Ve.meshphysical_frag},toon:{uniforms:Yt([pe.common,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.gradientmap,pe.fog,pe.lights,{emissive:{value:new Le(0)}}]),vertexShader:Ve.meshtoon_vert,fragmentShader:Ve.meshtoon_frag},matcap:{uniforms:Yt([pe.common,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,{matcap:{value:null}}]),vertexShader:Ve.meshmatcap_vert,fragmentShader:Ve.meshmatcap_frag},points:{uniforms:Yt([pe.points,pe.fog]),vertexShader:Ve.points_vert,fragmentShader:Ve.points_frag},dashed:{uniforms:Yt([pe.common,pe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ve.linedashed_vert,fragmentShader:Ve.linedashed_frag},depth:{uniforms:Yt([pe.common,pe.displacementmap]),vertexShader:Ve.depth_vert,fragmentShader:Ve.depth_frag},normal:{uniforms:Yt([pe.common,pe.bumpmap,pe.normalmap,pe.displacementmap,{opacity:{value:1}}]),vertexShader:Ve.meshnormal_vert,fragmentShader:Ve.meshnormal_frag},sprite:{uniforms:Yt([pe.sprite,pe.fog]),vertexShader:Ve.sprite_vert,fragmentShader:Ve.sprite_frag},background:{uniforms:{uvTransform:{value:new Be},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ve.background_vert,fragmentShader:Ve.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Be}},vertexShader:Ve.backgroundCube_vert,fragmentShader:Ve.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ve.cube_vert,fragmentShader:Ve.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ve.equirect_vert,fragmentShader:Ve.equirect_frag},distance:{uniforms:Yt([pe.common,pe.displacementmap,{referencePosition:{value:new L},nearDistance:{value:1},farDistance:{value:1000}}]),vertexShader:Ve.distance_vert,fragmentShader:Ve.distance_frag},shadow:{uniforms:Yt([pe.lights,pe.fog,{color:{value:new Le(0)},opacity:{value:1}}]),vertexShader:Ve.shadow_vert,fragmentShader:Ve.shadow_frag}};qn.physical={uniforms:Yt([qn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Be},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Be},clearcoatNormalScale:{value:new ne(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Be},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Be},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Be},sheen:{value:0},sheenColor:{value:new Le(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Be},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Be},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Be},transmissionSamplerSize:{value:new ne},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Be},attenuationDistance:{value:0},attenuationColor:{value:new Le(0)},specularColor:{value:new Le(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Be},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Be},anisotropyVector:{value:new ne},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Be}}]),vertexShader:Ve.meshphysical_vert,fragmentShader:Ve.meshphysical_frag};var Na={r:0,b:0,g:0},cS=new Je,lg=new Be;lg.set(-1,0,0,0,1,0,0,0,1);function hS(e,t,n,i,r,s){let o=new Le(0),a=r===!0?0:1,l,c,u=null,f=0,h=null;function d(x){let S=x.isScene===!0?x.background:null;if(S&&S.isTexture){let v=x.backgroundBlurriness>0;S=t.get(S,v)}return S}function g(x){let S=!1,v=d(x);if(v===null)m(o,a);else if(v&&v.isColor)m(v,1),S=!0;let b=e.xr.getEnvironmentBlendMode();if(b==="additive")n.buffers.color.setClear(0,0,0,1,s);else if(b==="alpha-blend")n.buffers.color.setClear(0,0,0,0,s);if(e.autoClear||S)n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil)}function _(x,S){let v=d(S);if(v&&(v.isCubeTexture||v.mapping===Ps)){if(c===void 0)c=new Bt(new Zi(1,1,1),new At({name:"BackgroundCubeMaterial",uniforms:Ki(qn.backgroundCube.uniforms),vertexShader:qn.backgroundCube.vertexShader,fragmentShader:qn.backgroundCube.fragmentShader,side:qt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(b,w,E){this.matrixWorld.copyPosition(E.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c);if(c.material.uniforms.envMap.value=v,c.material.uniforms.backgroundBlurriness.value=S.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(cS.makeRotationFromEuler(S.backgroundRotation)).transpose(),v.isCubeTexture&&v.isRenderTargetTexture===!1)c.material.uniforms.backgroundRotation.value.premultiply(lg);if(c.material.toneMapped=We.getTransfer(v.colorSpace)!==lt,u!==v||f!==v.version||h!==e.toneMapping)c.material.needsUpdate=!0,u=v,f=v.version,h=e.toneMapping;c.layers.enableAll(),x.unshift(c,c.geometry,c.material,0,0,null)}else if(v&&v.isTexture){if(l===void 0)l=new Bt(new Hs(2,2),new At({name:"BackgroundMaterial",uniforms:Ki(qn.background.uniforms),vertexShader:qn.background.vertexShader,fragmentShader:qn.background.fragmentShader,side:Ur,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l);if(l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,l.material.toneMapped=We.getTransfer(v.colorSpace)!==lt,v.matrixAutoUpdate===!0)v.updateMatrix();if(l.material.uniforms.uvTransform.value.copy(v.matrix),u!==v||f!==v.version||h!==e.toneMapping)l.material.needsUpdate=!0,u=v,f=v.version,h=e.toneMapping;l.layers.enableAll(),x.unshift(l,l.geometry,l.material,0,0,null)}}function m(x,S){x.getRGB(Na,Sh(e)),n.buffers.color.setClear(Na.r,Na.g,Na.b,S,s)}function p(){if(c!==void 0)c.geometry.dispose(),c.material.dispose(),c=void 0;if(l!==void 0)l.geometry.dispose(),l.material.dispose(),l=void 0}return{getClearColor:function(){return o},setClearColor:function(x,S=1){o.set(x),a=S,m(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(x){a=x,m(o,a)},render:g,addToRenderList:_,dispose:p}}function uS(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},r=h(null),s=r,o=!1;function a(P,D,W,R,I){let k=!1,z=f(P,R,W,D);if(s!==z)s=z,c(s.object);if(k=d(P,R,W,I),k)g(P,R,W,I);if(I!==null)t.update(I,e.ELEMENT_ARRAY_BUFFER);if(k||o){if(o=!1,v(P,D,W,R),I!==null)e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(I).buffer)}}function l(){return e.createVertexArray()}function c(P){return e.bindVertexArray(P)}function u(P){return e.deleteVertexArray(P)}function f(P,D,W,R){let I=R.wireframe===!0,k=i[D.id];if(k===void 0)k={},i[D.id]=k;let z=P.isInstancedMesh===!0?P.id:0,te=k[z];if(te===void 0)te={},k[z]=te;let Y=te[W.id];if(Y===void 0)Y={},te[W.id]=Y;let Q=Y[I];if(Q===void 0)Q=h(l()),Y[I]=Q;return Q}function h(P){let D=[],W=[],R=[];for(let I=0;I<n;I++)D[I]=0,W[I]=0,R[I]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:D,enabledAttributes:W,attributeDivisors:R,object:P,attributes:{},index:null}}function d(P,D,W,R){let I=s.attributes,k=D.attributes,z=0,te=W.getAttributes();for(let Y in te)if(te[Y].location>=0){let G=I[Y],ee=k[Y];if(ee===void 0){if(Y==="instanceMatrix"&&P.instanceMatrix)ee=P.instanceMatrix;if(Y==="instanceColor"&&P.instanceColor)ee=P.instanceColor}if(G===void 0)return!0;if(G.attribute!==ee)return!0;if(ee&&G.data!==ee.data)return!0;z++}if(s.attributesNum!==z)return!0;if(s.index!==R)return!0;return!1}function g(P,D,W,R){let I={},k=D.attributes,z=0,te=W.getAttributes();for(let Y in te)if(te[Y].location>=0){let G=k[Y];if(G===void 0){if(Y==="instanceMatrix"&&P.instanceMatrix)G=P.instanceMatrix;if(Y==="instanceColor"&&P.instanceColor)G=P.instanceColor}let ee={};if(ee.attribute=G,G&&G.data)ee.data=G.data;I[Y]=ee,z++}s.attributes=I,s.attributesNum=z,s.index=R}function _(){let P=s.newAttributes;for(let D=0,W=P.length;D<W;D++)P[D]=0}function m(P){p(P,0)}function p(P,D){let W=s.newAttributes,R=s.enabledAttributes,I=s.attributeDivisors;if(W[P]=1,R[P]===0)e.enableVertexAttribArray(P),R[P]=1;if(I[P]!==D)e.vertexAttribDivisor(P,D),I[P]=D}function x(){let P=s.newAttributes,D=s.enabledAttributes;for(let W=0,R=D.length;W<R;W++)if(D[W]!==P[W])e.disableVertexAttribArray(W),D[W]=0}function S(P,D,W,R,I,k,z){if(z===!0)e.vertexAttribIPointer(P,D,W,I,k);else e.vertexAttribPointer(P,D,W,R,I,k)}function v(P,D,W,R){_();let I=R.attributes,k=W.getAttributes(),z=D.defaultAttributeValues;for(let te in k){let Y=k[te];if(Y.location>=0){let Q=I[te];if(Q===void 0){if(te==="instanceMatrix"&&P.instanceMatrix)Q=P.instanceMatrix;if(te==="instanceColor"&&P.instanceColor)Q=P.instanceColor}if(Q!==void 0){let G=Q.normalized,ee=Q.itemSize,oe=t.get(Q);if(oe===void 0)continue;let{buffer:Fe,type:Re,bytesPerElement:X}=oe,se=Re===e.INT||Re===e.UNSIGNED_INT||Q.gpuType===vc;if(Q.isInterleavedBufferAttribute){let le=Q.data,Pe=le.stride,Ue=Q.offset;if(le.isInstancedInterleavedBuffer){for(let Ae=0;Ae<Y.locationSize;Ae++)p(Y.location+Ae,le.meshPerAttribute);if(P.isInstancedMesh!==!0&&R._maxInstanceCount===void 0)R._maxInstanceCount=le.meshPerAttribute*le.count}else for(let Ae=0;Ae<Y.locationSize;Ae++)m(Y.location+Ae);e.bindBuffer(e.ARRAY_BUFFER,Fe);for(let Ae=0;Ae<Y.locationSize;Ae++)S(Y.location+Ae,ee/Y.locationSize,Re,G,Pe*X,(Ue+ee/Y.locationSize*Ae)*X,se)}else{if(Q.isInstancedBufferAttribute){for(let le=0;le<Y.locationSize;le++)p(Y.location+le,Q.meshPerAttribute);if(P.isInstancedMesh!==!0&&R._maxInstanceCount===void 0)R._maxInstanceCount=Q.meshPerAttribute*Q.count}else for(let le=0;le<Y.locationSize;le++)m(Y.location+le);e.bindBuffer(e.ARRAY_BUFFER,Fe);for(let le=0;le<Y.locationSize;le++)S(Y.location+le,ee/Y.locationSize,Re,G,ee*X,ee/Y.locationSize*le*X,se)}}else if(z!==void 0){let G=z[te];if(G!==void 0)switch(G.length){case 2:e.vertexAttrib2fv(Y.location,G);break;case 3:e.vertexAttrib3fv(Y.location,G);break;case 4:e.vertexAttrib4fv(Y.location,G);break;default:e.vertexAttrib1fv(Y.location,G)}}}}x()}function b(){A();for(let P in i){let D=i[P];for(let W in D){let R=D[W];for(let I in R){let k=R[I];for(let z in k)u(k[z].object),delete k[z];delete R[I]}}delete i[P]}}function w(P){if(i[P.id]===void 0)return;let D=i[P.id];for(let W in D){let R=D[W];for(let I in R){let k=R[I];for(let z in k)u(k[z].object),delete k[z];delete R[I]}}delete i[P.id]}function E(P){for(let D in i){let W=i[D];for(let R in W){let I=W[R];if(I[P.id]===void 0)continue;let k=I[P.id];for(let z in k)u(k[z].object),delete k[z];delete I[P.id]}}}function y(P){for(let D in i){let W=i[D],R=P.isInstancedMesh===!0?P.id:0,I=W[R];if(I===void 0)continue;for(let k in I){let z=I[k];for(let te in z)u(z[te].object),delete z[te];delete I[k]}if(delete W[R],Object.keys(W).length===0)delete i[D]}}function A(){if(N(),o=!0,s===r)return;s=r,c(s.object)}function N(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:A,resetDefaultState:N,dispose:b,releaseStatesOfGeometry:w,releaseStatesOfObject:y,releaseStatesOfProgram:E,initAttributes:_,enableAttribute:m,disableUnusedAttributes:x}}function fS(e,t,n){let i;function r(l){i=l}function s(l,c){e.drawArrays(i,l,c),n.update(c,i,1)}function o(l,c,u){if(u===0)return;e.drawArraysInstanced(i,l,c,u),n.update(c,i,u)}function a(l,c,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,u);let h=0;for(let d=0;d<u;d++)h+=c[d];n.update(h,i,1)}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a}function dS(e,t,n,i){let r;function s(){if(r!==void 0)return r;if(t.has("EXT_texture_filter_anisotropic")===!0){let E=t.get("EXT_texture_filter_anisotropic");r=e.getParameter(E.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(E){if(E!==Hn&&i.convert(E)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))return!1;return!0}function a(E){let y=E===jt&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));if(E!==In&&E!==ri&&!y&&i.convert(E)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))return!1;return!0}function l(E){if(E==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";E="mediump"}if(E==="mediump"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0)return"mediump"}return"lowp"}let c=n.precision!==void 0?n.precision:"highp",u=l(c);if(u!==c)Ie("WebGLRenderer:",c,"not supported, using",u,"instead."),c=u;let f=n.logarithmicDepthBuffer===!0,h=n.reversedDepthBuffer===!0&&t.has("EXT_clip_control");if(n.reversedDepthBuffer===!0&&h===!1)Ie("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let d=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),g=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=e.getParameter(e.MAX_TEXTURE_SIZE),m=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),p=e.getParameter(e.MAX_VERTEX_ATTRIBS),x=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),S=e.getParameter(e.MAX_VARYING_VECTORS),v=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),b=e.getParameter(e.MAX_SAMPLES),w=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:h,maxTextures:d,maxVertexTextures:g,maxTextureSize:_,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:x,maxVaryings:S,maxFragmentUniforms:v,maxSamples:b,samples:w}}function pS(e){let t=this,n=null,i=0,r=!1,s=!1,o=new on,a=new Be,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,h){let d=f.length!==0||h||i!==0||r;return r=h,i=f.length,d},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(f,h){n=u(f,h,0)},this.setState=function(f,h,d){let{clippingPlanes:g,clipIntersection:_,clipShadows:m}=f,p=e.get(f);if(!r||g===null||g.length===0||s&&!m)if(s)u(null);else c();else{let x=s?0:i,S=x*4,v=p.clippingState||null;l.value=v,v=u(g,h,S,d);for(let b=0;b!==S;++b)v[b]=n[b];p.clippingState=v,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=x}};function c(){if(l.value!==n)l.value=n,l.needsUpdate=i>0;t.numPlanes=i,t.numIntersection=0}function u(f,h,d,g){let _=f!==null?f.length:0,m=null;if(_!==0){if(m=l.value,g!==!0||m===null){let p=d+_*4,x=h.matrixWorldInverse;if(a.getNormalMatrix(x),m===null||m.length<p)m=new Float32Array(p);for(let S=0,v=d;S!==_;++S,v+=4)o.copy(f[S]).applyMatrix4(x,a),o.normal.toArray(m,v),m[v+3]=o.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,m}}var $r=4,mS=6,gS=20,_S=256,$s=new nr,zm=new Le,Vh=null,Wh=0,Xh=0,qh=!1,vS=new L,rr=new L;class $h{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=0.1,i=100,r={}){let{size:s=256,position:o=vS}=r;Vh=this._renderer.getRenderTarget(),Wh=this._renderer.getActiveCubeFace(),Xh=this._renderer.getActiveMipmapLevel(),qh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(s);let a=this._allocateTargets();if(a.depthBuffer=!0,this._sceneToCubeUV(e,n,i,a,o),t>0)this._blur(a,0,0,t);return this._applyPMREM(a),this._cleanup(a),a}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){if(this._cubemapMaterial===null)this._cubemapMaterial=Vm(),this._compileMaterial(this._cubemapMaterial)}compileEquirectangularShader(){if(this._equirectMaterial===null)this._equirectMaterial=Hm(),this._compileMaterial(this._equirectMaterial)}dispose(){if(this._dispose(),this._cubemapMaterial!==null)this._cubemapMaterial.dispose();if(this._equirectMaterial!==null)this._equirectMaterial.dispose();if(this._backgroundBox!==null)this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){if(this._blurMaterial!==null)this._blurMaterial.dispose();if(this._ggxMaterial!==null)this._ggxMaterial.dispose();if(this._pingPongRenderTarget!==null)this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Vh,Wh,Xh),this._renderer.xr.enabled=qh,e.scissorTest=!1,Yr(e,0,0,e.width,e.height)}_fromTexture(e,t){if(e.mapping===zr||e.mapping===Gi)this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width);else this._setSize(e.image.width/4);Vh=this._renderer.getRenderTarget(),Wh=this._renderer.getActiveCubeFace(),Xh=this._renderer.getActiveMipmapLevel(),qh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:an,minFilter:an,generateMipmaps:!1,type:jt,format:Hn,colorSpace:th,depthBuffer:!1},i=Gm(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){if(this._pingPongRenderTarget!==null)this._dispose();this._pingPongRenderTarget=Gm(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=yS(r)),this._blurMaterial=bS(r,e,t),this._ggxMaterial=xS(r,e,t)}return i}_compileMaterial(e){let t=new Bt(new xt,e);this._renderer.compile(t,$s)}_sceneToCubeUV(e,t,n,i,r){let a=new zt(90,1,t,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],u=this._renderer,{autoClear:f,toneMapping:h}=u;if(u.getClearColor(zm),u.toneMapping=Pn,u.autoClear=!1,u.state.buffers.depth.getReversed())u.setRenderTarget(i),u.clearDepth(),u.setRenderTarget(null);if(this._backgroundBox===null)this._backgroundBox=new Bt(new Zi,new si({name:"PMREM.Background",side:qt,depthWrite:!1,depthTest:!1}));let g=this._backgroundBox,_=g.material,m=!1,p=e.background;if(p){if(p.isColor)_.color.copy(p),e.background=null,m=!0}else _.color.copy(zm),m=!0;for(let x=0;x<6;x++){let S=x%3;if(S===0)a.up.set(0,l[x],0),a.position.set(r.x,r.y,r.z),a.lookAt(r.x+c[x],r.y,r.z);else if(S===1)a.up.set(0,0,l[x]),a.position.set(r.x,r.y,r.z),a.lookAt(r.x,r.y+c[x],r.z);else a.up.set(0,l[x],0),a.position.set(r.x,r.y,r.z),a.lookAt(r.x,r.y,r.z+c[x]);let v=this._cubeSize;if(Yr(i,S*v,x>2?v:0,v,v),u.setRenderTarget(i),m)u.render(g,a);u.render(e,a)}u.toneMapping=h,u.autoClear=f,e.background=p}_textureToCubeUV(e,t){let n=this._renderer,i=e.mapping===zr||e.mapping===Gi;if(i){if(this._cubemapMaterial===null)this._cubemapMaterial=Vm();this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1}else if(this._equirectMaterial===null)this._equirectMaterial=Hm();let r=i?this._cubemapMaterial:this._equirectMaterial,s=this._lodMeshes[0];s.material=r;let o=r.uniforms;o.envMap.value=e;let a=this._cubeSize;Yr(t,0,0,3*a,2*a),n.setRenderTarget(t),n.render(s,$s)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let i=this._lodMeshes.length;for(let r=1;r<i;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){let i=this._renderer,r=this._pingPongRenderTarget,s=this._ggxMaterial,o=this._lodMeshes[n];o.material=s;let a=s.uniforms,l=n/(this._lodMeshes.length-1),c=t/(this._lodMeshes.length-1),u=Math.sqrt(l*l-c*c),f=l*1.25,h=u*f,{_lodMax:d}=this,g=this._sizeLods[n],_=3*g*(n>d-$r?n-d+$r:0),m=4*(this._cubeSize-g);a.envMap.value=e.texture,a.roughness.value=h,a.mipInt.value=d-t,Yr(r,_,m,3*g,2*g),i.setRenderTarget(r),i.render(o,$s),a.envMap.value=r.texture,a.roughness.value=0,a.mipInt.value=d-n,Yr(e,_,m,3*g,2*g),i.setRenderTarget(e),i.render(o,$s)}_blur(e,t,n,i){let r=this._pingPongRenderTarget,s=Math.min(i,Math.PI)/Math.SQRT2;this._blurPass(e,r,t,n,s),this._blurPass(r,e,n,n,s)}_blurPass(e,t,n,i,r){let s=this._renderer,o=this._blurMaterial,a=this._lodMeshes[i];a.material=o;let l=o.uniforms;l.envMap.value=e.texture,l.sigma.value=r,l.mipInt.value=this._lodMax-n;let c=this._sizeLods[i],u=3*c*(i>this._lodMax-$r?i-this._lodMax+$r:0),f=4*(this._cubeSize-c);Yr(t,u,f,3*c,2*c),s.setRenderTarget(t),s.render(a,$s)}}function yS(e){let t=[],n=[],i=e,r=e-$r+1+mS;for(let s=0;s<r;s++){let o=Math.pow(2,i);t.push(o);let a=1/(o-2),l=-a,c=1+a,u=[l,l,c,l,c,c,l,l,c,c,l,c],f=6,h=6,d=3,g=new Float32Array(d*h*f),_=new Float32Array(d*h*f);for(let p=0;p<f;p++){let x=p%3*2/3-1,S=p>2?0:-1,v=[x,S,0,x+0.6666666666666666,S,0,x+0.6666666666666666,S+1,0,x,S,0,x+0.6666666666666666,S+1,0,x,S+1,0];g.set(v,d*h*p);for(let b=0;b<h;b++){let w=u[b*2]*2-1,E=u[b*2+1]*2-1;if(p===0)rr.set(1,E,w);else if(p===1)rr.set(-w,1,-E);else if(p===2)rr.set(-w,E,1);else if(p===3)rr.set(-1,E,-w);else if(p===4)rr.set(-w,-1,E);else rr.set(w,E,-1);rr.toArray(_,(p*h+b)*d)}}let m=new xt;if(m.setAttribute("position",new Qt(g,d)),m.setAttribute("outputDirection",new Qt(_,d)),n.push(new Bt(m,null)),i>$r)i--}return{lodMeshes:n,sizeLods:t}}function Gm(e,t,n){let i=new It(e,t,n);return i.texture.mapping=Ps,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Yr(e,t,n,i,r){e.viewport.set(t,n,i,r),e.scissor.set(t,n,i,r)}function xS(e,t,n){return new At({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:_S,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Ua(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:bn,depthTest:!1,depthWrite:!1})}function bS(e,t,n){return new At({name:"SphericalGaussianBlur",defines:{SAMPLES:gS,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Ua(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:bn,depthTest:!1,depthWrite:!1})}function Hm(){return new At({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Ua(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:bn,depthTest:!1,depthWrite:!1})}function Vm(){return new At({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Ua(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:bn,depthTest:!1,depthWrite:!1})}function Ua(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}class Kh extends It{constructor(e=1,t={}){super(e,e,t);this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];this.texture=new Ma(i),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new Zi(5,5,5),r=new At({name:"CubemapFromEquirect",uniforms:Ki(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:qt,blending:bn});r.uniforms.tEquirect.value=t;let s=new Bt(i,r),o=t.minFilter;if(t.minFilter===Hi)t.minFilter=an;return new Fh(1,10,this).update(e,s),t.minFilter=o,s.geometry.dispose(),s.material.dispose(),this}clear(e,t=!0,n=!0,i=!0){let r=e.getRenderTarget();for(let s=0;s<6;s++)e.setRenderTarget(this,s),e.clear(t,n,i);e.setRenderTarget(r)}}function SS(e){let t=new WeakMap,n=new WeakMap,i=null;function r(h,d=!1){if(h===null||h===void 0)return null;if(d)return o(h);return s(h)}function s(h){if(h&&h.isTexture){let d=h.mapping;if(d===aa||d===la)if(t.has(h)){let g=t.get(h).texture;return a(g,h.mapping)}else{let g=h.image;if(g&&g.height>0){let _=new Kh(g.height);return _.fromEquirectangularTexture(e,h),t.set(h,_),h.addEventListener("dispose",c),a(_.texture,h.mapping)}else return null}}return h}function o(h){if(h&&h.isTexture){let d=h.mapping,g=d===aa||d===la,_=d===zr||d===Gi;if(g||_){let m=n.get(h),p=m!==void 0?m.texture.pmremVersion:0;if(h.isRenderTargetTexture&&h.pmremVersion!==p){if(i===null)i=new $h(e);return m=g?i.fromEquirectangular(h,m):i.fromCubemap(h,m),m.texture.pmremVersion=h.pmremVersion,n.set(h,m),m.texture}else if(m!==void 0)return m.texture;else{let x=h.image;if(g&&x&&x.height>0||_&&x&&l(x)){if(i===null)i=new $h(e);return m=g?i.fromEquirectangular(h):i.fromCubemap(h),m.texture.pmremVersion=h.pmremVersion,n.set(h,m),h.addEventListener("dispose",u),m.texture}else return null}}}return h}function a(h,d){if(d===aa)h.mapping=zr;else if(d===la)h.mapping=Gi;return h}function l(h){let d=0,g=6;for(let _=0;_<g;_++)if(h[_]!==void 0)d++;return d===g}function c(h){let d=h.target;d.removeEventListener("dispose",c);let g=t.get(d);if(g!==void 0)t.delete(d),g.dispose()}function u(h){let d=h.target;d.removeEventListener("dispose",u);let g=n.get(d);if(g!==void 0)n.delete(d),g.dispose()}function f(){if(t=new WeakMap,n=new WeakMap,i!==null)i.dispose(),i=null}return{get:r,dispose:f}}function MS(e){let t={};function n(i){if(t[i]!==void 0)return t[i];let r=e.getExtension(i);return t[i]=r,r}return{has:function(i){return n(i)!==null},init:function(){n("EXT_color_buffer_float"),n("WEBGL_clip_cull_distance"),n("OES_texture_float_linear"),n("EXT_color_buffer_half_float"),n("WEBGL_multisampled_render_to_texture"),n("WEBGL_render_shared_exponent")},get:function(i){let r=n(i);if(r===null)zi("WebGLRenderer: "+i+" extension not supported.");return r}}}function wS(e,t,n,i){let r={},s=new WeakMap;function o(f){let h=f.target;if(h.index!==null)t.remove(h.index);for(let g in h.attributes)t.remove(h.attributes[g]);h.removeEventListener("dispose",o),delete r[h.id];let d=s.get(h);if(d)t.remove(d),s.delete(h);if(i.releaseStatesOfGeometry(h),h.isInstancedBufferGeometry===!0)delete h._maxInstanceCount;n.memory.geometries--}function a(f,h){if(r[h.id]===!0)return h;return h.addEventListener("dispose",o),r[h.id]=!0,n.memory.geometries++,h}function l(f){let h=f.attributes;for(let d in h)t.update(h[d],e.ARRAY_BUFFER)}function c(f){let h=[],d=f.index,g=f.attributes.position,_=0;if(g===void 0)return;if(d!==null){let x=d.array;_=d.version;for(let S=0,v=x.length;S<v;S+=3){let b=x[S+0],w=x[S+1],E=x[S+2];h.push(b,w,w,E,E,b)}}else{let x=g.array;_=g.version;for(let S=0,v=x.length/3-1;S<v;S+=3){let b=S+0,w=S+1,E=S+2;h.push(b,w,w,E,E,b)}}let m=new(g.count>=65535?ba:xa)(h,1);m.version=_;let p=s.get(f);if(p)t.remove(p);s.set(f,m)}function u(f){let h=s.get(f);if(h){let d=f.index;if(d!==null){if(h.version<d.version)c(f)}}else c(f);return s.get(f)}return{get:a,update:l,getWireframeAttribute:u}}function TS(e,t,n){let i;function r(f){i=f}let s,o;function a(f){s=f.type,o=f.bytesPerElement}function l(f,h){e.drawElements(i,h,s,f*o),n.update(h,i,1)}function c(f,h,d){if(d===0)return;e.drawElementsInstanced(i,h,s,f*o,d),n.update(h,i,d)}function u(f,h,d){if(d===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,h,0,s,f,0,d);let _=0;for(let m=0;m<d;m++)_+=h[m];n.update(_,i,1)}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=u}function ES(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(n.calls++,o){case e.TRIANGLES:n.triangles+=a*(s/3);break;case e.LINES:n.lines+=a*(s/2);break;case e.LINE_STRIP:n.lines+=a*(s-1);break;case e.LINE_LOOP:n.lines+=a*s;break;case e.POINTS:n.points+=a*s;break;default:Ne("WebGLInfo: Unknown draw mode:",o);break}}function r(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:r,update:i}}function AS(e,t,n){let i=new WeakMap,r=new gt;function s(o,a,l){let c=o.morphTargetInfluences,u=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=u!==void 0?u.length:0,h=i.get(a);if(h===void 0||h.count!==f){let A=function(){E.dispose(),i.delete(a),a.removeEventListener("dispose",A)};if(h!==void 0)h.texture.dispose();let d=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,_=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],p=a.morphAttributes.normal||[],x=a.morphAttributes.color||[],S=0;if(d===!0)S=1;if(g===!0)S=2;if(_===!0)S=3;let v=a.attributes.position.count*S,b=1;if(v>t.maxTextureSize)b=Math.ceil(v/t.maxTextureSize),v=t.maxTextureSize;let w=new Float32Array(v*b*4*f),E=new ya(w,v,b,f);E.type=ri,E.needsUpdate=!0;let y=S*4;for(let N=0;N<f;N++){let P=m[N],D=p[N],W=x[N],R=v*b*4*N;for(let I=0;I<P.count;I++){let k=I*y;if(d===!0)r.fromBufferAttribute(P,I),w[R+k+0]=r.x,w[R+k+1]=r.y,w[R+k+2]=r.z,w[R+k+3]=0;if(g===!0)r.fromBufferAttribute(D,I),w[R+k+4]=r.x,w[R+k+5]=r.y,w[R+k+6]=r.z,w[R+k+7]=0;if(_===!0)r.fromBufferAttribute(W,I),w[R+k+8]=r.x,w[R+k+9]=r.y,w[R+k+10]=r.z,w[R+k+11]=W.itemSize===4?r.w:1}}h={count:f,texture:E,size:new ne(v,b)},i.set(a,h),a.addEventListener("dispose",A)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(e,"morphTexture",o.morphTexture,n);else{let d=0;for(let _=0;_<c.length;_++)d+=c[_];let g=a.morphTargetsRelative?1:1-d;l.getUniforms().setValue(e,"morphTargetBaseInfluence",g),l.getUniforms().setValue(e,"morphTargetInfluences",c)}l.getUniforms().setValue(e,"morphTargetsTexture",h.texture,n),l.getUniforms().setValue(e,"morphTargetsTextureSize",h.size)}return{update:s}}function CS(e,t,n,i,r){let s=new WeakMap;function o(c){let u=r.render.frame,f=c.geometry,h=t.get(c,f);if(s.get(h)!==u)t.update(h),s.set(h,u);if(c.isInstancedMesh){if(c.hasEventListener("dispose",l)===!1)c.addEventListener("dispose",l);if(s.get(c)!==u){if(n.update(c.instanceMatrix,e.ARRAY_BUFFER),c.instanceColor!==null)n.update(c.instanceColor,e.ARRAY_BUFFER);s.set(c,u)}}if(c.isSkinnedMesh){let d=c.skeleton;if(s.get(d)!==u)d.update(),s.set(d,u)}return h}function a(){s=new WeakMap}function l(c){let u=c.target;if(u.removeEventListener("dispose",l),i.releaseStatesOfObject(u),n.remove(u.instanceMatrix),u.instanceColor!==null)n.remove(u.instanceColor)}return{update:o,dispose:a}}var RS={[Ms]:"LINEAR_TONE_MAPPING",[ws]:"REINHARD_TONE_MAPPING",[Ts]:"CINEON_TONE_MAPPING",[Es]:"ACES_FILMIC_TONE_MAPPING",[Cs]:"AGX_TONE_MAPPING",[Rs]:"NEUTRAL_TONE_MAPPING",[As]:"CUSTOM_TONE_MAPPING"};function PS(e,t,n,i,r,s){let o=new It(t,n,{type:e,depthBuffer:r,stencilBuffer:s,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,c=new xt;c.setAttribute("position",new rt([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new rt([0,2,0,0,2,0],2));let u=new Ws({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),f=new Bt(c,u),h=new nr(-1,1,1,-1,0,1),d=null,g=null,_=!1,m,p=null,x=[],S=!1;this.setSize=function(v,b){if(o.setSize(v,b),a!==null)a.setSize(v,b);if(l!==null)l.setSize(v,b);for(let w=0;w<x.length;w++){let E=x[w];if(E.setSize)E.setSize(v,b)}},this.setEffects=function(v){x=v,S=x.length>0&&x[0].isRenderPass===!0;let{width:b,height:w}=o;if(x.length>0&&a===null)a=new It(b,w,{type:jt,depthBuffer:!1,stencilBuffer:!1}),l=new It(b,w,{type:jt,depthBuffer:!1,stencilBuffer:!1});for(let E=0;E<x.length;E++){let y=x[E];if(y.setSize)y.setSize(b,w)}},this.begin=function(v,b){if(_)return!1;if(v.toneMapping===Pn&&x.length===0)return!1;if(p=b,b!==null){let{width:w,height:E}=b;if(o.width!==w||o.height!==E)this.setSize(w,E)}if(S===!1)v.setRenderTarget(o);return m=v.toneMapping,v.toneMapping=Pn,!0},this.hasRenderPass=function(){return S},this.end=function(v,b){v.toneMapping=m,_=!0;let w=o,E=a;for(let y=0;y<x.length;y++){let A=x[y];if(A.enabled===!1)continue;if(A.render(v,E,w,b),A.needsSwap!==!1)w=E,E=E===a?l:a}if(d!==v.outputColorSpace||g!==v.toneMapping){if(d=v.outputColorSpace,g=v.toneMapping,u.defines={},We.getTransfer(d)===lt)u.defines.SRGB_TRANSFER="";let y=RS[g];if(y)u.defines[y]="";u.needsUpdate=!0}u.uniforms.tDiffuse.value=w.texture,v.setRenderTarget(p),v.render(f,h),p=null,_=!1},this.isCompositing=function(){return _},this.dispose=function(){if(o.dispose(),a!==null)a.dispose();if(l!==null)l.dispose();c.dispose(),u.dispose()}}var cg=new Ft,Zh=new $i(1,1),hg=new ya,ug=new lh,fg=new Ma,Wm=[],Xm=[],qm=new Float32Array(16),jm=new Float32Array(9),Ym=new Float32Array(4);function Zr(e,t,n){let i=e[0];if(i<=0||i>0)return e;let r=t*n,s=Wm[r];if(s===void 0)s=new Float32Array(r),Wm[r]=s;if(t!==0){i.toArray(s,0);for(let o=1,a=0;o!==t;++o)a+=n,e[o].toArray(s,a)}return s}function Lt(e,t){if(e.length!==t.length)return!1;for(let n=0,i=e.length;n<i;n++)if(e[n]!==t[n])return!1;return!0}function Dt(e,t){for(let n=0,i=t.length;n<i;n++)e[n]=t[n]}function Fa(e,t){let n=Xm[t];if(n===void 0)n=new Int32Array(t),Xm[t]=n;for(let i=0;i!==t;++i)n[i]=e.allocateTextureUnit();return n}function IS(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1f(this.addr,t),n[0]=t}function LS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Lt(n,t))return;e.uniform2fv(this.addr,t),Dt(n,t)}}function DS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else if(t.r!==void 0){if(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b}else{if(Lt(n,t))return;e.uniform3fv(this.addr,t),Dt(n,t)}}function NS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Lt(n,t))return;e.uniform4fv(this.addr,t),Dt(n,t)}}function OS(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Lt(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),Dt(n,t)}else{if(Lt(n,i))return;Ym.set(i),e.uniformMatrix2fv(this.addr,!1,Ym),Dt(n,i)}}function US(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Lt(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),Dt(n,t)}else{if(Lt(n,i))return;jm.set(i),e.uniformMatrix3fv(this.addr,!1,jm),Dt(n,i)}}function FS(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Lt(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),Dt(n,t)}else{if(Lt(n,i))return;qm.set(i),e.uniformMatrix4fv(this.addr,!1,qm),Dt(n,i)}}function BS(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1i(this.addr,t),n[0]=t}function kS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Lt(n,t))return;e.uniform2iv(this.addr,t),Dt(n,t)}}function zS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else{if(Lt(n,t))return;e.uniform3iv(this.addr,t),Dt(n,t)}}function GS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Lt(n,t))return;e.uniform4iv(this.addr,t),Dt(n,t)}}function HS(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1ui(this.addr,t),n[0]=t}function VS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Lt(n,t))return;e.uniform2uiv(this.addr,t),Dt(n,t)}}function WS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else{if(Lt(n,t))return;e.uniform3uiv(this.addr,t),Dt(n,t)}}function XS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Lt(n,t))return;e.uniform4uiv(this.addr,t),Dt(n,t)}}function qS(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;let s;if(this.type===e.SAMPLER_2D_SHADOW)Zh.compareFunction=n.isReversedDepthBuffer()?va:_a,s=Zh;else s=cg;n.setTexture2D(t||s,r)}function jS(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;n.setTexture3D(t||ug,r)}function YS(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;n.setTextureCube(t||fg,r)}function $S(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;n.setTexture2DArray(t||hg,r)}function ZS(e){switch(e){case 5126:return IS;case 35664:return LS;case 35665:return DS;case 35666:return NS;case 35674:return OS;case 35675:return US;case 35676:return FS;case 5124:case 35670:return BS;case 35667:case 35671:return kS;case 35668:case 35672:return zS;case 35669:case 35673:return GS;case 5125:return HS;case 36294:return VS;case 36295:return WS;case 36296:return XS;case 35678:case 36198:case 36298:case 36306:case 35682:return qS;case 35679:case 36299:case 36307:return jS;case 35680:case 36300:case 36308:case 36293:return YS;case 36289:case 36303:case 36311:case 36292:return $S}}function JS(e,t){e.uniform1fv(this.addr,t)}function KS(e,t){let n=Zr(t,this.size,2);e.uniform2fv(this.addr,n)}function QS(e,t){let n=Zr(t,this.size,3);e.uniform3fv(this.addr,n)}function eM(e,t){let n=Zr(t,this.size,4);e.uniform4fv(this.addr,n)}function tM(e,t){let n=Zr(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function nM(e,t){let n=Zr(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function iM(e,t){let n=Zr(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function rM(e,t){e.uniform1iv(this.addr,t)}function sM(e,t){e.uniform2iv(this.addr,t)}function oM(e,t){e.uniform3iv(this.addr,t)}function aM(e,t){e.uniform4iv(this.addr,t)}function lM(e,t){e.uniform1uiv(this.addr,t)}function cM(e,t){e.uniform2uiv(this.addr,t)}function hM(e,t){e.uniform3uiv(this.addr,t)}function uM(e,t){e.uniform4uiv(this.addr,t)}function fM(e,t,n){let i=this.cache,r=t.length,s=Fa(n,r);if(!Lt(i,s))e.uniform1iv(this.addr,s),Dt(i,s);let o;if(this.type===e.SAMPLER_2D_SHADOW)o=Zh;else o=cg;for(let a=0;a!==r;++a)n.setTexture2D(t[a]||o,s[a])}function dM(e,t,n){let i=this.cache,r=t.length,s=Fa(n,r);if(!Lt(i,s))e.uniform1iv(this.addr,s),Dt(i,s);for(let o=0;o!==r;++o)n.setTexture3D(t[o]||ug,s[o])}function pM(e,t,n){let i=this.cache,r=t.length,s=Fa(n,r);if(!Lt(i,s))e.uniform1iv(this.addr,s),Dt(i,s);for(let o=0;o!==r;++o)n.setTextureCube(t[o]||fg,s[o])}function mM(e,t,n){let i=this.cache,r=t.length,s=Fa(n,r);if(!Lt(i,s))e.uniform1iv(this.addr,s),Dt(i,s);for(let o=0;o!==r;++o)n.setTexture2DArray(t[o]||hg,s[o])}function gM(e){switch(e){case 5126:return JS;case 35664:return KS;case 35665:return QS;case 35666:return eM;case 35674:return tM;case 35675:return nM;case 35676:return iM;case 5124:case 35670:return rM;case 35667:case 35671:return sM;case 35668:case 35672:return oM;case 35669:case 35673:return aM;case 5125:return lM;case 36294:return cM;case 36295:return hM;case 36296:return uM;case 35678:case 36198:case 36298:case 36306:case 35682:return fM;case 35679:case 36299:case 36307:return dM;case 35680:case 36300:case 36308:case 36293:return pM;case 36289:case 36303:case 36311:case 36292:return mM}}class dg{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=ZS(t.type)}}class pg{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=gM(t.type)}}class mg{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let i=this.seq;for(let r=0,s=i.length;r!==s;++r){let o=i[r];o.setValue(e,t[o.id],n)}}}var jh=/(\w+)(\])?(\[|\.)?/g;function $m(e,t){e.seq.push(t),e.map[t.id]=t}function _M(e,t,n){let i=e.name,r=i.length;jh.lastIndex=0;while(!0){let s=jh.exec(i),o=jh.lastIndex,a=s[1],l=s[2]==="]",c=s[3];if(l)a=a|0;if(c===void 0||c==="["&&o+2===r){$m(n,c===void 0?new dg(a,e,t):new pg(a,e,t));break}else{let f=n.map[a];if(f===void 0)f=new mg(a),$m(n,f);n=f}}}class Ks{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){let o=e.getActiveUniform(t,s),a=e.getUniformLocation(t,o.name);_M(o,a,this)}let i=[],r=[];for(let s of this.seq)if(s.type===e.SAMPLER_2D_SHADOW||s.type===e.SAMPLER_CUBE_SHADOW||s.type===e.SAMPLER_2D_ARRAY_SHADOW)i.push(s);else r.push(s);if(i.length>0)this.seq=i.concat(r)}setValue(e,t,n,i){let r=this.map[t];if(r!==void 0)r.setValue(e,n,i)}setOptional(e,t,n){let i=t[n];if(i!==void 0)this.setValue(e,n,i)}static upload(e,t,n,i){for(let r=0,s=t.length;r!==s;++r){let o=t[r],a=n[o.id];if(a.needsUpdate!==!1)o.setValue(e,a.value,i)}}static seqWithValue(e,t){let n=[];for(let i=0,r=e.length;i!==r;++i){let s=e[i];if(s.id in t)n.push(s)}return n}}function Zm(e,t,n){let i=e.createShader(t);return e.shaderSource(i,n),e.compileShader(i),i}var vM=37297,yM=0;function xM(e,t){let n=e.split(`
`),i=[],r=Math.max(t-6,0),s=Math.min(t+6,n.length);for(let o=r;o<s;o++){let a=o+1;i.push(`${a===t?">":" "} ${a}: ${n[o]}`)}return i.join(`
`)}var Jm=new Be;function bM(e){We._getMatrix(Jm,We.workingColorSpace,e);let t=`mat3( ${Jm.elements.map((n)=>n.toFixed(4))} )`;switch(We.getTransfer(e)){case nh:return[t,"LinearTransferOETF"];case lt:return[t,"sRGBTransferOETF"];default:return Ie("WebGLProgram: Unsupported color space: ",e),[t,"LinearTransferOETF"]}}function Km(e,t,n){let i=e.getShaderParameter(t,e.COMPILE_STATUS),s=(e.getShaderInfoLog(t)||"").trim();if(i&&s==="")return"";let o=/ERROR: 0:(\d+)/.exec(s);if(o){let a=parseInt(o[1]);return n.toUpperCase()+`

`+s+`

`+xM(e.getShaderSource(t),a)}else return s}function SM(e,t){let n=bM(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,"}"].join(`
`)}var MM={[Ms]:"Linear",[ws]:"Reinhard",[Ts]:"Cineon",[Es]:"ACESFilmic",[Cs]:"AgX",[Rs]:"Neutral",[As]:"Custom"};function wM(e,t){let n=MM[t];if(n===void 0)return Ie("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }";return"vec3 "+e+"( vec3 color ) { return "+n+"ToneMapping( color ); }"}var Oa=new L;function TM(){We.getLuminanceCoefficients(Oa);let e=Oa.x.toFixed(4),t=Oa.y.toFixed(4),n=Oa.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${t}, ${n} );`,"\treturn dot( weights, rgb );","}"].join(`
`)}function EM(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Js).join(`
`)}function AM(e){let t=[];for(let n in e){let i=e[n];if(i===!1)continue;t.push("#define "+n+" "+i)}return t.join(`
`)}function CM(e,t){let n={},i=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){let s=e.getActiveAttrib(t,r),o=s.name,a=1;if(s.type===e.FLOAT_MAT2)a=2;if(s.type===e.FLOAT_MAT3)a=3;if(s.type===e.FLOAT_MAT4)a=4;n[o]={type:s.type,location:e.getAttribLocation(t,o),locationSize:a}}return n}function Js(e){return e!==""}function Qm(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function eg(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var RM=/^[ \t]*#include +<([\w\d./]+)>/gm;function Jh(e){return e.replace(RM,IM)}var PM=new Map;function IM(e,t){let n=Ve[t];if(n===void 0){let i=PM.get(t);if(i!==void 0)n=Ve[i],Ie('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return Jh(n)}var LM=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function tg(e){return e.replace(LM,DM)}function DM(e,t,n,i){let r="";for(let s=parseInt(t);s<parseInt(n);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function ng(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;if(e.precision==="highp")t+=`
#define HIGH_PRECISION`;else if(e.precision==="mediump")t+=`
#define MEDIUM_PRECISION`;else if(e.precision==="lowp")t+=`
#define LOW_PRECISION`;return t}var NM={[Ss]:"SHADOWMAP_TYPE_PCF",[Or]:"SHADOWMAP_TYPE_VSM"};function OM(e){return NM[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var UM={[zr]:"ENVMAP_TYPE_CUBE",[Gi]:"ENVMAP_TYPE_CUBE",[Ps]:"ENVMAP_TYPE_CUBE_UV"};function FM(e){if(e.envMap===!1)return"ENVMAP_TYPE_CUBE";return UM[e.envMapMode]||"ENVMAP_TYPE_CUBE"}var BM={[Gi]:"ENVMAP_MODE_REFRACTION"};function kM(e){if(e.envMap===!1)return"ENVMAP_MODE_REFLECTION";return BM[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}var zM={[cm]:"ENVMAP_BLENDING_MULTIPLY",[hm]:"ENVMAP_BLENDING_MIX",[um]:"ENVMAP_BLENDING_ADD"};function GM(e){if(e.envMap===!1)return"ENVMAP_BLENDING_NONE";return zM[e.combine]||"ENVMAP_BLENDING_NONE"}function HM(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,n),112)),texelHeight:i,maxMip:n}}function VM(e,t,n,i){let r=e.getContext(),{defines:s,vertexShader:o,fragmentShader:a}=n,l=OM(n),c=FM(n),u=kM(n),f=GM(n),h=HM(n),d=EM(n),g=AM(s),_=r.createProgram(),m,p,x=n.glslVersion?"#version "+n.glslVersion+`
`:"";if(n.isRawShaderMaterial){if(m=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(Js).join(`
`),m.length>0)m+=`
`;if(p=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(Js).join(`
`),p.length>0)p+=`
`}else m=[ng(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",n.batching?"#define USE_BATCHING":"",n.batchingColor?"#define USE_BATCHING_COLOR":"",n.instancing?"#define USE_INSTANCING":"",n.instancingColor?"#define USE_INSTANCING_COLOR":"",n.instancingMorph?"#define USE_INSTANCING_MORPH":"",n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.map?"#define USE_MAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+u:"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.displacementMap?"#define USE_DISPLACEMENTMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.mapUv?"#define MAP_UV "+n.mapUv:"",n.alphaMapUv?"#define ALPHAMAP_UV "+n.alphaMapUv:"",n.lightMapUv?"#define LIGHTMAP_UV "+n.lightMapUv:"",n.aoMapUv?"#define AOMAP_UV "+n.aoMapUv:"",n.emissiveMapUv?"#define EMISSIVEMAP_UV "+n.emissiveMapUv:"",n.bumpMapUv?"#define BUMPMAP_UV "+n.bumpMapUv:"",n.normalMapUv?"#define NORMALMAP_UV "+n.normalMapUv:"",n.displacementMapUv?"#define DISPLACEMENTMAP_UV "+n.displacementMapUv:"",n.metalnessMapUv?"#define METALNESSMAP_UV "+n.metalnessMapUv:"",n.roughnessMapUv?"#define ROUGHNESSMAP_UV "+n.roughnessMapUv:"",n.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+n.anisotropyMapUv:"",n.clearcoatMapUv?"#define CLEARCOATMAP_UV "+n.clearcoatMapUv:"",n.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+n.clearcoatNormalMapUv:"",n.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+n.clearcoatRoughnessMapUv:"",n.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+n.iridescenceMapUv:"",n.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+n.iridescenceThicknessMapUv:"",n.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+n.sheenColorMapUv:"",n.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+n.sheenRoughnessMapUv:"",n.specularMapUv?"#define SPECULARMAP_UV "+n.specularMapUv:"",n.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+n.specularColorMapUv:"",n.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+n.specularIntensityMapUv:"",n.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+n.transmissionMapUv:"",n.thicknessMapUv?"#define THICKNESSMAP_UV "+n.thicknessMapUv:"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexNormals?"#define HAS_NORMAL":"",n.vertexColors?"#define USE_COLOR":"",n.vertexAlphas?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.flatShading?"#define FLAT_SHADED":"",n.skinning?"#define USE_SKINNING":"",n.morphTargets?"#define USE_MORPHTARGETS":"",n.morphNormals&&n.flatShading===!1?"#define USE_MORPHNORMALS":"",n.morphColors?"#define USE_MORPHCOLORS":"",n.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+n.morphTextureStride:"",n.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+n.morphTargetsCount:"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.sizeAttenuation?"#define USE_SIZEATTENUATION":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","\tattribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","\tattribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","\tuniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","\tattribute vec2 uv1;","#endif","#ifdef USE_UV2","\tattribute vec2 uv2;","#endif","#ifdef USE_UV3","\tattribute vec2 uv3;","#endif","#ifdef USE_TANGENT","\tattribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","\tattribute vec4 color;","#elif defined( USE_COLOR )","\tattribute vec3 color;","#endif","#ifdef USE_SKINNING","\tattribute vec4 skinIndex;","\tattribute vec4 skinWeight;","#endif",`
`].filter(Js).join(`
`),p=[ng(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",n.map?"#define USE_MAP":"",n.matcap?"#define USE_MATCAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+c:"",n.envMap?"#define "+u:"",n.envMap?"#define "+f:"",h?"#define CUBEUV_TEXEL_WIDTH "+h.texelWidth:"",h?"#define CUBEUV_TEXEL_HEIGHT "+h.texelHeight:"",h?"#define CUBEUV_MAX_MIP "+h.maxMip+".0":"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoat?"#define USE_CLEARCOAT":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.dispersion?"#define USE_DISPERSION":"",n.retroreflection?"#define USE_RETROREFLECTION":"",n.iridescence?"#define USE_IRIDESCENCE":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaTest?"#define USE_ALPHATEST":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.sheen?"#define USE_SHEEN":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexColors||n.instancingColor?"#define USE_COLOR":"",n.vertexAlphas||n.batchingColor?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.gradientMap?"#define USE_GRADIENTMAP":"",n.flatShading?"#define FLAT_SHADED":"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",n.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",n.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",n.toneMapping!==Pn?"#define TONE_MAPPING":"",n.toneMapping!==Pn?Ve.tonemapping_pars_fragment:"",n.toneMapping!==Pn?wM("toneMapping",n.toneMapping):"",n.dithering?"#define DITHERING":"",n.opaque?"#define OPAQUE":"",Ve.colorspace_pars_fragment,SM("linearToOutputTexel",n.outputColorSpace),TM(),n.useDepthPacking?"#define DEPTH_PACKING "+n.depthPacking:"",`
`].filter(Js).join(`
`);if(o=Jh(o),o=Qm(o,n),o=eg(o,n),a=Jh(a),a=Qm(a,n),a=eg(a,n),o=tg(o),a=tg(a),n.isRawShaderMaterial!==!0)x=`#version 300 es
`,m=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",n.glslVersion===ih?"":"layout(location = 0) out highp vec4 pc_fragColor;",n.glslVersion===ih?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p;let S=x+m+o,v=x+p+a,b=Zm(r,r.VERTEX_SHADER,S),w=Zm(r,r.FRAGMENT_SHADER,v);if(r.attachShader(_,b),r.attachShader(_,w),n.index0AttributeName!==void 0)r.bindAttribLocation(_,0,n.index0AttributeName);else if(n.hasPositionAttribute===!0)r.bindAttribLocation(_,0,"position");r.linkProgram(_);function E(P){if(e.debug.checkShaderErrors){let D=r.getProgramInfoLog(_)||"",W=r.getShaderInfoLog(b)||"",R=r.getShaderInfoLog(w)||"",I=D.trim(),k=W.trim(),z=R.trim(),te=!0,Y=!0;if(r.getProgramParameter(_,r.LINK_STATUS)===!1)if(te=!1,typeof e.debug.onShaderError==="function")e.debug.onShaderError(r,_,b,w);else{let Q=Km(r,b,"vertex"),G=Km(r,w,"fragment");Ne("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(_,r.VALIDATE_STATUS)+`

Material Name: `+P.name+`
Material Type: `+P.type+`

Program Info Log: `+I+`
`+Q+`
`+G)}else if(I!=="")Ie("WebGLProgram: Program Info Log:",I);else if(k===""||z==="")Y=!1;if(Y)P.diagnostics={runnable:te,programLog:I,vertexShader:{log:k,prefix:m},fragmentShader:{log:z,prefix:p}}}r.deleteShader(b),r.deleteShader(w),y=new Ks(r,_),A=CM(r,_)}let y;this.getUniforms=function(){if(y===void 0)E(this);return y};let A;this.getAttributes=function(){if(A===void 0)E(this);return A};let N=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){if(N===!1)N=r.getProgramParameter(_,vM);return N},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(_),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=yM++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=b,this.fragmentShader=w,this}var WM=0;class gg{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let i=this._getShaderCacheForMaterial(e);if(i.has(t)===!1)i.add(t),t.usedTimes++;if(i.has(n)===!1)i.add(n),n.usedTimes++;return this}remove(e){let t=this.materialCache.get(e);for(let n of t)if(n.usedTimes--,n.usedTimes===0)this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);if(n===void 0)n=new Set,t.set(e,n);return n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);if(n===void 0)n=new _g(e),t.set(e,n);return n}}class _g{constructor(e){this.id=WM++,this.code=e,this.usedTimes=0}}function XM(e){return e===Xi||e===ma||e===ga}function qM(e,t,n,i,r,s){let o=new Ns,a=new gg,l=new Set,c=[],u=new Map,{logarithmicDepthBuffer:f,precision:h}=i,d={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(y){if(l.add(y),y===0)return"uv";return`uv${y}`}function _(y,A,N,P,D,W){let R=P.fog,I=D.geometry,k=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?P.environment:null,z=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap,te=t.get(y.envMap||k,z),Y=!!te&&te.mapping===Ps?te.image.height:null,Q=d[y.type];if(y.precision!==null){if(h=i.getMaxPrecision(y.precision),h!==y.precision)Ie("WebGLProgram.getParameters:",y.precision,"not supported, using",h,"instead.")}let G=I.morphAttributes.position||I.morphAttributes.normal||I.morphAttributes.color,ee=G!==void 0?G.length:0,oe=0;if(I.morphAttributes.position!==void 0)oe=1;if(I.morphAttributes.normal!==void 0)oe=2;if(I.morphAttributes.color!==void 0)oe=3;let Fe,Re,X,se;if(Q){let ft=qn[Q];Fe=ft.vertexShader,Re=ft.fragmentShader}else{Fe=y.vertexShader,Re=y.fragmentShader;let ft=a.getVertexShaderStage(y),nt=a.getFragmentShaderStage(y);a.update(y,ft,nt),X=ft.id,se=nt.id}let le=e.getRenderTarget(),Pe=e.state.buffers.depth.getReversed(),Ue=D.isInstancedMesh===!0,Ae=D.isBatchedMesh===!0,Ct=!!y.map,qe=!!y.matcap,je=!!te,st=!!y.aoMap,Ye=!!y.lightMap,kt=!!y.bumpMap&&y.wireframe===!1,pt=!!y.normalMap,nn=!!y.displacementMap,Rt=!!y.emissiveMap,Pt=!!y.metalnessMap,U=!!y.roughnessMap,rn=y.anisotropy>0,tt=y.clearcoat>0,yt=y.dispersion>0,C=y.retroreflectivity>0,M=y.iridescence>0,O=y.sheen>0,q=y.transmission>0,re=rn&&!!y.anisotropyMap,ce=tt&&!!y.clearcoatMap,fe=tt&&!!y.clearcoatNormalMap,Z=tt&&!!y.clearcoatRoughnessMap,K=M&&!!y.iridescenceMap,ve=M&&!!y.iridescenceThicknessMap,Ee=O&&!!y.sheenColorMap,de=O&&!!y.sheenRoughnessMap,ae=!!y.specularMap,Ce=!!y.specularColorMap,De=!!y.specularIntensityMap,Ke=q&&!!y.transmissionMap,B=q&&!!y.thicknessMap,he=!!y.gradientMap,J=!!y.alphaMap,ue=y.alphaTest>0,ye=!!y.alphaHash,ie=!!y.extensions,me=Pn;if(y.toneMapped){if(le===null||le.isXRRenderTarget===!0)me=e.toneMapping}let ke={shaderID:Q,shaderType:y.type,shaderName:y.name,vertexShader:Fe,fragmentShader:Re,defines:y.defines,customVertexShaderID:X,customFragmentShaderID:se,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:h,batching:Ae,batchingColor:Ae&&D._colorsTexture!==null,instancing:Ue,instancingColor:Ue&&D.instanceColor!==null,instancingMorph:Ue&&D.morphTexture!==null,outputColorSpace:le===null?e.outputColorSpace:le.isXRRenderTarget===!0?le.texture.colorSpace:We.workingColorSpace,alphaToCoverage:!!y.alphaToCoverage,map:Ct,matcap:qe,envMap:je,envMapMode:je&&te.mapping,envMapCubeUVHeight:Y,aoMap:st,lightMap:Ye,bumpMap:kt,normalMap:pt,displacementMap:nn,emissiveMap:Rt,normalMapObjectSpace:pt&&y.normalMapType===Sm,normalMapTangentSpace:pt&&y.normalMapType===eh,packedNormalMap:pt&&y.normalMapType===eh&&XM(y.normalMap.format),metalnessMap:Pt,roughnessMap:U,anisotropy:rn,anisotropyMap:re,clearcoat:tt,clearcoatMap:ce,clearcoatNormalMap:fe,clearcoatRoughnessMap:Z,dispersion:yt,retroreflection:C,iridescence:M,iridescenceMap:K,iridescenceThicknessMap:ve,sheen:O,sheenColorMap:Ee,sheenRoughnessMap:de,specularMap:ae,specularColorMap:Ce,specularIntensityMap:De,transmission:q,transmissionMap:Ke,thicknessMap:B,gradientMap:he,opaque:y.transparent===!1&&y.blending===Fr&&y.alphaToCoverage===!1,alphaMap:J,alphaTest:ue,alphaHash:ye,combine:y.combine,mapUv:Ct&&g(y.map.channel),aoMapUv:st&&g(y.aoMap.channel),lightMapUv:Ye&&g(y.lightMap.channel),bumpMapUv:kt&&g(y.bumpMap.channel),normalMapUv:pt&&g(y.normalMap.channel),displacementMapUv:nn&&g(y.displacementMap.channel),emissiveMapUv:Rt&&g(y.emissiveMap.channel),metalnessMapUv:Pt&&g(y.metalnessMap.channel),roughnessMapUv:U&&g(y.roughnessMap.channel),anisotropyMapUv:re&&g(y.anisotropyMap.channel),clearcoatMapUv:ce&&g(y.clearcoatMap.channel),clearcoatNormalMapUv:fe&&g(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Z&&g(y.clearcoatRoughnessMap.channel),iridescenceMapUv:K&&g(y.iridescenceMap.channel),iridescenceThicknessMapUv:ve&&g(y.iridescenceThicknessMap.channel),sheenColorMapUv:Ee&&g(y.sheenColorMap.channel),sheenRoughnessMapUv:de&&g(y.sheenRoughnessMap.channel),specularMapUv:ae&&g(y.specularMap.channel),specularColorMapUv:Ce&&g(y.specularColorMap.channel),specularIntensityMapUv:De&&g(y.specularIntensityMap.channel),transmissionMapUv:Ke&&g(y.transmissionMap.channel),thicknessMapUv:B&&g(y.thicknessMap.channel),alphaMapUv:J&&g(y.alphaMap.channel),vertexTangents:!!I.attributes.tangent&&(pt||rn),vertexNormals:!!I.attributes.normal,vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!I.attributes.color&&I.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!I.attributes.uv&&(Ct||J),fog:!!R,useFog:y.fog===!0,fogExp2:!!R&&R.isFogExp2,flatShading:y.wireframe===!1&&(y.flatShading===!0||I.attributes.normal===void 0&&pt===!1&&(y.isMeshLambertMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isMeshPhysicalMaterial)),sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:Pe,skinning:D.isSkinnedMesh===!0,hasPositionAttribute:I.attributes.position!==void 0,morphTargets:I.morphAttributes.position!==void 0,morphNormals:I.morphAttributes.normal!==void 0,morphColors:I.morphAttributes.color!==void 0,morphTargetsCount:ee,morphTextureStride:oe,numSunLights:A.sun.length,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numSunLightShadows:A.sunShadowMap.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:W.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:y.dithering,shadowMapEnabled:e.shadowMap.enabled&&N.length>0,shadowMapType:e.shadowMap.type,toneMapping:me,decodeVideoTexture:Ct&&y.map.isVideoTexture===!0&&We.getTransfer(y.map.colorSpace)===lt,decodeVideoTextureEmissive:Rt&&y.emissiveMap.isVideoTexture===!0&&We.getTransfer(y.emissiveMap.colorSpace)===lt,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===Rn,flipSided:y.side===qt,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:ie&&y.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ie&&y.extensions.multiDraw===!0||Ae)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return ke.vertexUv1s=l.has(1),ke.vertexUv2s=l.has(2),ke.vertexUv3s=l.has(3),l.clear(),ke}function m(y){let A=[];if(y.shaderID)A.push(y.shaderID);else A.push(y.customVertexShaderID),A.push(y.customFragmentShaderID);if(y.defines!==void 0)for(let N in y.defines)A.push(N),A.push(y.defines[N]);if(y.isRawShaderMaterial===!1)p(A,y),x(A,y),A.push(e.outputColorSpace);return A.push(y.customProgramCacheKey),A.join()}function p(y,A){y.push(A.precision),y.push(A.outputColorSpace),y.push(A.envMapMode),y.push(A.envMapCubeUVHeight),y.push(A.mapUv),y.push(A.alphaMapUv),y.push(A.lightMapUv),y.push(A.aoMapUv),y.push(A.bumpMapUv),y.push(A.normalMapUv),y.push(A.displacementMapUv),y.push(A.emissiveMapUv),y.push(A.metalnessMapUv),y.push(A.roughnessMapUv),y.push(A.anisotropyMapUv),y.push(A.clearcoatMapUv),y.push(A.clearcoatNormalMapUv),y.push(A.clearcoatRoughnessMapUv),y.push(A.iridescenceMapUv),y.push(A.iridescenceThicknessMapUv),y.push(A.sheenColorMapUv),y.push(A.sheenRoughnessMapUv),y.push(A.specularMapUv),y.push(A.specularColorMapUv),y.push(A.specularIntensityMapUv),y.push(A.transmissionMapUv),y.push(A.thicknessMapUv),y.push(A.combine),y.push(A.fogExp2),y.push(A.sizeAttenuation),y.push(A.morphTargetsCount),y.push(A.morphAttributeCount),y.push(A.numSunLights),y.push(A.numDirLights),y.push(A.numPointLights),y.push(A.numSpotLights),y.push(A.numSpotLightMaps),y.push(A.numHemiLights),y.push(A.numRectAreaLights),y.push(A.numSunLightShadows),y.push(A.numDirLightShadows),y.push(A.numPointLightShadows),y.push(A.numSpotLightShadows),y.push(A.numSpotLightShadowsWithMaps),y.push(A.numLightProbes),y.push(A.shadowMapType),y.push(A.toneMapping),y.push(A.numClippingPlanes),y.push(A.numClipIntersection),y.push(A.depthPacking)}function x(y,A){if(o.disableAll(),A.instancing)o.enable(0);if(A.instancingColor)o.enable(1);if(A.instancingMorph)o.enable(2);if(A.matcap)o.enable(3);if(A.envMap)o.enable(4);if(A.normalMapObjectSpace)o.enable(5);if(A.normalMapTangentSpace)o.enable(6);if(A.clearcoat)o.enable(7);if(A.iridescence)o.enable(8);if(A.alphaTest)o.enable(9);if(A.vertexColors)o.enable(10);if(A.vertexAlphas)o.enable(11);if(A.vertexUv1s)o.enable(12);if(A.vertexUv2s)o.enable(13);if(A.vertexUv3s)o.enable(14);if(A.vertexTangents)o.enable(15);if(A.anisotropy)o.enable(16);if(A.alphaHash)o.enable(17);if(A.batching)o.enable(18);if(A.dispersion)o.enable(19);if(A.retroreflection)o.enable(24);if(A.batchingColor)o.enable(20);if(A.gradientMap)o.enable(21);if(A.packedNormalMap)o.enable(22);if(A.vertexNormals)o.enable(23);if(y.push(o.mask),o.disableAll(),A.fog)o.enable(0);if(A.useFog)o.enable(1);if(A.flatShading)o.enable(2);if(A.logarithmicDepthBuffer)o.enable(3);if(A.reversedDepthBuffer)o.enable(4);if(A.skinning)o.enable(5);if(A.morphTargets)o.enable(6);if(A.morphNormals)o.enable(7);if(A.morphColors)o.enable(8);if(A.premultipliedAlpha)o.enable(9);if(A.shadowMapEnabled)o.enable(10);if(A.doubleSided)o.enable(11);if(A.flipSided)o.enable(12);if(A.useDepthPacking)o.enable(13);if(A.dithering)o.enable(14);if(A.transmission)o.enable(15);if(A.sheen)o.enable(16);if(A.opaque)o.enable(17);if(A.pointsUvs)o.enable(18);if(A.decodeVideoTexture)o.enable(19);if(A.decodeVideoTextureEmissive)o.enable(20);if(A.alphaToCoverage)o.enable(21);if(A.numLightProbeGrids>0)o.enable(22);if(A.hasPositionAttribute)o.enable(23);y.push(o.mask)}function S(y){let A=d[y.type],N;if(A){let P=qn[A];N=oi.clone(P.uniforms)}else N=y.uniforms;return N}function v(y,A){let N=u.get(A);if(N!==void 0)++N.usedTimes;else N=new VM(e,A,y,r),c.push(N),u.set(A,N);return N}function b(y){if(--y.usedTimes===0){let A=c.indexOf(y);c[A]=c[c.length-1],c.pop(),u.delete(y.cacheKey),y.destroy()}}function w(y){a.remove(y)}function E(){a.dispose()}return{getParameters:_,getProgramCacheKey:m,getUniforms:S,acquireProgram:v,releaseProgram:b,releaseShaderCache:w,programs:c,dispose:E}}function jM(){let e=new WeakMap;function t(o){return e.has(o)}function n(o){let a=e.get(o);if(a===void 0)a={},e.set(o,a);return a}function i(o){e.delete(o)}function r(o,a,l){e.get(o)[a]=l}function s(){e=new WeakMap}return{has:t,get:n,remove:i,update:r,dispose:s}}function YM(e,t){if(e.groupOrder!==t.groupOrder)return e.groupOrder-t.groupOrder;else if(e.renderOrder!==t.renderOrder)return e.renderOrder-t.renderOrder;else if(e.material.id!==t.material.id)return e.material.id-t.material.id;else if(e.materialVariant!==t.materialVariant)return e.materialVariant-t.materialVariant;else if(e.z!==t.z)return e.z-t.z;else return e.id-t.id}function ig(e,t){if(e.groupOrder!==t.groupOrder)return e.groupOrder-t.groupOrder;else if(e.renderOrder!==t.renderOrder)return e.renderOrder-t.renderOrder;else if(e.z!==t.z)return t.z-e.z;else return e.id-t.id}function rg(){let e=[],t=0,n=[],i=[],r=[];function s(){t=0,n.length=0,i.length=0,r.length=0}function o(h){let d=0;if(h.isInstancedMesh)d+=2;if(h.isSkinnedMesh)d+=1;return d}function a(h,d,g,_,m,p){let x=e[t];if(x===void 0)x={id:h.id,object:h,geometry:d,material:g,materialVariant:o(h),groupOrder:_,renderOrder:h.renderOrder,z:m,group:p},e[t]=x;else x.id=h.id,x.object=h,x.geometry=d,x.material=g,x.materialVariant=o(h),x.groupOrder=_,x.renderOrder=h.renderOrder,x.z=m,x.group=p;return t++,x}function l(h,d,g,_,m,p,x){if(x.reversedDepth===!0)m=-m;let S=a(h,d,g,_,m,p);if(g.transmission>0)i.push(S);else if(g.transparent===!0)r.push(S);else n.push(S)}function c(h,d,g,_,m,p){let x=a(h,d,g,_,m,p);if(g.transmission>0)i.unshift(x);else if(g.transparent===!0)r.unshift(x);else n.unshift(x)}function u(h,d){if(n.length>1)n.sort(h||YM);if(i.length>1)i.sort(d||ig);if(r.length>1)r.sort(d||ig)}function f(){for(let h=t,d=e.length;h<d;h++){let g=e[h];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:n,transmissive:i,transparent:r,init:s,push:l,unshift:c,finish:f,sort:u}}function $M(){let e=new WeakMap;function t(i,r){let s=e.get(i),o;if(s===void 0)o=new rg,e.set(i,[o]);else if(r>=s.length)o=new rg,s.push(o);else o=s[r];return o}function n(){e=new WeakMap}return{get:t,dispose:n}}function ZM(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"SunLight":case"DirectionalLight":n={direction:new L,color:new Le};break;case"SpotLight":n={position:new L,direction:new L,color:new Le,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":n={position:new L,color:new Le,distance:0,decay:0};break;case"HemisphereLight":n={direction:new L,skyColor:new Le,groundColor:new Le};break;case"RectAreaLight":n={color:new Le,position:new L,halfWidth:new L,halfHeight:new L};break}return e[t.id]=n,n}}}function JM(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"SunLight":case"DirectionalLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ne};break;case"SpotLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ne};break;case"PointLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ne,shadowCameraNear:1,shadowCameraFar:1000};break}return e[t.id]=n,n}}}var KM=0;function QM(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+(t.map?1:0)-(e.map?1:0)}function ew(e){let t=new ZM,n=JM(),i={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new L);let r=new L,s=new Je,o=new Je;function a(c){let u=0,f=0,h=0;for(let D=0;D<9;D++)i.probe[D].set(0,0,0);let d=0,g=0,_=0,m=0,p=0,x=0,S=0,v=0,b=0,w=0,E=0,y=0,A=0,N=0;c.sort(QM);for(let D=0,W=c.length;D<W;D++){let R=c[D],{color:I,intensity:k,distance:z}=R,te=null;if(R.shadow&&R.shadow.map)if(R.shadow.map.texture.format===Xi)te=R.shadow.map.texture;else te=R.shadow.map.depthTexture||R.shadow.map.texture;if(R.isAmbientLight)u+=I.r*k,f+=I.g*k,h+=I.b*k;else if(R.isLightProbe){for(let Y=0;Y<9;Y++)i.probe[Y].addScaledVector(R.sh.coefficients[Y],k);N++}else if(R.isSunLight){let Y=t.get(R);if(Y.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){let Q=R.shadow,G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize.copy(Q.mapSize).multiply(Q.getFrameExtents()),i.sunShadow[g]=G,i.sunShadowMap[g]=te;let ee=Q.getViewportCount();for(let oe=0;oe<ee;oe++)i.sunShadowMatrix[_+oe]=Q.getMatrix(oe),i.sunShadowCascade[_+oe]=Q._cascadeData[oe];_+=ee,g++}i.sun[d]=Y,d++}else if(R.isDirectionalLight){let Y=t.get(R);if(Y.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){let Q=R.shadow,G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize=Q.mapSize,i.directionalShadow[m]=G,i.directionalShadowMap[m]=te,i.directionalShadowMatrix[m]=R.shadow.matrix,b++}i.directional[m]=Y,m++}else if(R.isSpotLight){let Y=t.get(R);Y.position.setFromMatrixPosition(R.matrixWorld),Y.color.copy(I).multiplyScalar(k),Y.distance=z,Y.coneCos=Math.cos(R.angle),Y.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),Y.decay=R.decay,i.spot[x]=Y;let Q=R.shadow;if(R.map){if(i.spotLightMap[y]=R.map,y++,Q.updateMatrices(R),R.castShadow)A++}if(i.spotLightMatrix[x]=Q.matrix,R.castShadow){let G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize=Q.mapSize,i.spotShadow[x]=G,i.spotShadowMap[x]=te,E++}x++}else if(R.isRectAreaLight){let Y=t.get(R);Y.color.copy(I).multiplyScalar(k),Y.halfWidth.set(R.width*0.5,0,0),Y.halfHeight.set(0,R.height*0.5,0),i.rectArea[S]=Y,S++}else if(R.isPointLight){let Y=t.get(R);if(Y.color.copy(R.color).multiplyScalar(R.intensity),Y.distance=R.distance,Y.decay=R.decay,R.castShadow){let Q=R.shadow,G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize=Q.mapSize,G.shadowCameraNear=Q.camera.near,G.shadowCameraFar=Q.camera.far,i.pointShadow[p]=G,i.pointShadowMap[p]=te,i.pointShadowMatrix[p]=R.shadow.matrix,w++}i.point[p]=Y,p++}else if(R.isHemisphereLight){let Y=t.get(R);Y.skyColor.copy(R.color).multiplyScalar(k),Y.groundColor.copy(R.groundColor).multiplyScalar(k),i.hemi[v]=Y,v++}}if(S>0)if(e.has("OES_texture_float_linear")===!0)i.rectAreaLTC1=pe.LTC_FLOAT_1,i.rectAreaLTC2=pe.LTC_FLOAT_2;else i.rectAreaLTC1=pe.LTC_HALF_1,i.rectAreaLTC2=pe.LTC_HALF_2;i.ambient[0]=u,i.ambient[1]=f,i.ambient[2]=h;let P=i.hash;if(P.sunLength!==d||P.directionalLength!==m||P.pointLength!==p||P.spotLength!==x||P.rectAreaLength!==S||P.hemiLength!==v||P.numSunShadows!==g||P.numDirectionalShadows!==b||P.numPointShadows!==w||P.numSpotShadows!==E||P.numSpotMaps!==y||P.numLightProbes!==N)i.sun.length=d,i.directional.length=m,i.spot.length=x,i.rectArea.length=S,i.point.length=p,i.hemi.length=v,i.sunShadow.length=g,i.sunShadowMap.length=g,i.sunShadowMatrix.length=_,i.sunShadowCascade.length=_,i.directionalShadow.length=b,i.directionalShadowMap.length=b,i.directionalShadowMatrix.length=b,i.pointShadow.length=w,i.pointShadowMap.length=w,i.pointShadowMatrix.length=w,i.spotShadow.length=E,i.spotShadowMap.length=E,i.spotLightMatrix.length=E+y-A,i.spotLightMap.length=y,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=N,P.sunLength=d,P.directionalLength=m,P.pointLength=p,P.spotLength=x,P.rectAreaLength=S,P.hemiLength=v,P.numSunShadows=g,P.numDirectionalShadows=b,P.numPointShadows=w,P.numSpotShadows=E,P.numSpotMaps=y,P.numLightProbes=N,i.version=KM++}function l(c,u){let f=0,h=0,d=0,g=0,_=0,m=0,p=u.matrixWorldInverse;for(let x=0,S=c.length;x<S;x++){let v=c[x];if(v.isSunLight){let b=i.sun[f];b.direction.setFromMatrixPosition(v.matrixWorld),b.direction.transformDirection(p),f++}else if(v.isDirectionalLight){let b=i.directional[h];b.direction.setFromMatrixPosition(v.matrixWorld),r.setFromMatrixPosition(v.target.matrixWorld),b.direction.sub(r),b.direction.transformDirection(p),h++}else if(v.isSpotLight){let b=i.spot[g];b.position.setFromMatrixPosition(v.matrixWorld),b.position.applyMatrix4(p),b.direction.setFromMatrixPosition(v.matrixWorld),r.setFromMatrixPosition(v.target.matrixWorld),b.direction.sub(r),b.direction.transformDirection(p),g++}else if(v.isRectAreaLight){let b=i.rectArea[_];b.position.setFromMatrixPosition(v.matrixWorld),b.position.applyMatrix4(p),o.identity(),s.copy(v.matrixWorld),s.premultiply(p),o.extractRotation(s),b.halfWidth.set(v.width*0.5,0,0),b.halfHeight.set(0,v.height*0.5,0),b.halfWidth.applyMatrix4(o),b.halfHeight.applyMatrix4(o),_++}else if(v.isPointLight){let b=i.point[d];b.position.setFromMatrixPosition(v.matrixWorld),b.position.applyMatrix4(p),d++}else if(v.isHemisphereLight){let b=i.hemi[m];b.direction.setFromMatrixPosition(v.matrixWorld),b.direction.transformDirection(p),m++}}}return{setup:a,setupView:l,state:i}}function sg(e){let t=new ew(e),n=[],i=[],r=[];function s(h){f.camera=h,n.length=0,i.length=0,r.length=0}function o(h){n.push(h)}function a(h){i.push(h)}function l(h){r.push(h)}function c(){t.setup(n)}function u(h){t.setupView(n,h)}let f={lightsArray:n,shadowsArray:i,lightProbeGridArray:r,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:f,setupLights:c,setupLightsView:u,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function tw(e){let t=new WeakMap;function n(r,s=0){let o=t.get(r),a;if(o===void 0)a=new sg(e),t.set(r,[a]);else if(s>=o.length)a=new sg(e),o.push(a);else a=o[s];return a}function i(){t=new WeakMap}return{get:n,dispose:i}}var nw=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,iw=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,rw=[new L(1,0,0),new L(-1,0,0),new L(0,1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1)],sw=[new L(0,-1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1),new L(0,-1,0),new L(0,-1,0)],og=new Je,Zs=new L,Yh=new L;function ow(e,t,n){let i=new Bs,r=new ne,s=new ne,o=new gt,a=new wh,l=new Th,c={},u=n.maxTextureSize,f={[Ur]:qt,[qt]:Ur,[Rn]:Rn},h=new At({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ne},radius:{value:4}},vertexShader:nw,fragmentShader:iw}),d=h.clone();d.defines.HORIZONTAL_PASS=1;let g=new xt;g.setAttribute("position",new Qt(new Float32Array([-1,-1,0.5,3,-1,0.5,-1,3,0.5]),3));let _=new Bt(g,h),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Ss;let p=this.type;this.render=function(w,E,y){if(m.enabled===!1)return;if(m.autoUpdate===!1&&m.needsUpdate===!1)return;if(w.length===0)return;if(this.type===Op)Ie("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=Ss;let A=e.getRenderTarget(),N=e.getActiveCubeFace(),P=e.getActiveMipmapLevel(),D=e.state;if(D.setBlending(bn),D.buffers.depth.getReversed()===!0)D.buffers.color.setClear(0,0,0,0);else D.buffers.color.setClear(1,1,1,1);D.buffers.depth.setTest(!0),D.setScissorTest(!1);let W=p!==this.type;if(W)E.traverse(function(R){if(R.material)if(Array.isArray(R.material))R.material.forEach((I)=>I.needsUpdate=!0);else R.material.needsUpdate=!0});for(let R=0,I=w.length;R<I;R++){let k=w[R],z=k.shadow;if(z===void 0){Ie("WebGLShadowMap:",k,"has no shadow.");continue}if(z.autoUpdate===!1&&z.needsUpdate===!1)continue;r.copy(z.mapSize);let te=z.getFrameExtents();if(r.multiply(te),s.copy(z.mapSize),r.x>u||r.y>u){if(r.x>u)s.x=Math.floor(u/te.x),r.x=s.x*te.x,z.mapSize.x=s.x;if(r.y>u)s.y=Math.floor(u/te.y),r.y=s.y*te.y,z.mapSize.y=s.y}let Y=e.state.buffers.depth.getReversed();if(z.camera._reversedDepth=Y,z.map===null||W===!0){if(z.map!==null){if(z.map.depthTexture!==null)z.map.depthTexture.dispose(),z.map.depthTexture=null;z.map.dispose()}if(this.type===Or){if(k.isPointLight){Ie("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}z.map=new It(r.x,r.y,{format:Xi,type:jt,minFilter:an,magFilter:an,generateMipmaps:!1}),z.map.texture.name=k.name+".shadowMap",z.map.depthTexture=new $i(r.x,r.y,ri),z.map.depthTexture.name=k.name+".shadowMapDepth",z.map.depthTexture.format=Vi,z.map.depthTexture.compareFunction=null,z.map.depthTexture.minFilter=yi,z.map.depthTexture.magFilter=yi}else{if(k.isPointLight)z.map=new Kh(r.x),z.map.depthTexture=new dh(r.x,xi);else z.map=new It(r.x,r.y),z.map.depthTexture=new $i(r.x,r.y,xi);if(z.map.depthTexture.name=k.name+".shadowMap",z.map.depthTexture.format=Vi,this.type===Ss)z.map.depthTexture.compareFunction=Y?va:_a,z.map.depthTexture.minFilter=an,z.map.depthTexture.magFilter=an;else z.map.depthTexture.compareFunction=null,z.map.depthTexture.minFilter=yi,z.map.depthTexture.magFilter=yi}z.camera.updateProjectionMatrix()}if(z.map.isWebGLCubeRenderTarget!==!0&&(z.map.width!==r.x||z.map.height!==r.y))z.map.setSize(r.x,r.y);let Q=z.map.isWebGLCubeRenderTarget?6:z.getViewportCount();if(k.isPointLight!==!0)z.updateMatrices(k,y);for(let G=0;G<Q;G++){let ee=z.getCamera(G);if(k.isPointLight){let{camera:oe,matrix:Fe}=z,Re=k.distance||oe.far;if(Re!==oe.far)oe.far=Re,oe.updateProjectionMatrix();Zs.setFromMatrixPosition(k.matrixWorld),oe.position.copy(Zs),Yh.copy(oe.position),Yh.add(rw[G]),oe.up.copy(sw[G]),oe.lookAt(Yh),oe.updateMatrixWorld(),Fe.makeTranslation(-Zs.x,-Zs.y,-Zs.z),og.multiplyMatrices(oe.projectionMatrix,oe.matrixWorldInverse),z._frustum.setFromProjectionMatrix(og,oe.coordinateSystem,oe.reversedDepth)}if(z.map.isWebGLCubeRenderTarget)e.setRenderTarget(z.map,G),e.clear();else{if(G===0)e.setRenderTarget(z.map),e.clear();let oe=z.getViewport(G);o.set(s.x*oe.x,s.y*oe.y,s.x*oe.z,s.y*oe.w),D.viewport(o)}i=z.getFrustum(G),v(E,y,ee,k,this.type)}if(z.isPointLightShadow!==!0&&this.type===Or)x(z,y);z.needsUpdate=!1}p=this.type,m.needsUpdate=!1,e.setRenderTarget(A,N,P)};function x(w,E){let y=t.update(_);if(h.defines.VSM_SAMPLES!==w.blurSamples)h.defines.VSM_SAMPLES=w.blurSamples,d.defines.VSM_SAMPLES=w.blurSamples,h.needsUpdate=!0,d.needsUpdate=!0;if(w.mapPass===null)w.mapPass=new It(r.x,r.y,{format:Xi,type:jt});else if(w.mapPass.width!==w.map.width||w.mapPass.height!==w.map.height)w.mapPass.setSize(w.map.width,w.map.height);h.uniforms.shadow_pass.value=w.map.depthTexture,h.uniforms.resolution.value.set(w.map.width,w.map.height),h.uniforms.radius.value=w.radius,e.setRenderTarget(w.mapPass),e.clear(),e.renderBufferDirect(E,null,y,h,_,null),d.uniforms.shadow_pass.value=w.mapPass.texture,d.uniforms.resolution.value.set(w.map.width,w.map.height),d.uniforms.radius.value=w.radius,e.setRenderTarget(w.map),e.clear(),e.renderBufferDirect(E,null,y,d,_,null)}function S(w,E,y,A){let N=null,P=y.isPointLight===!0?w.customDistanceMaterial:w.customDepthMaterial;if(P!==void 0)N=P;else if(N=y.isPointLight===!0?l:a,e.localClippingEnabled&&E.clipShadows===!0&&Array.isArray(E.clippingPlanes)&&E.clippingPlanes.length!==0||E.displacementMap&&E.displacementScale!==0||E.alphaMap&&E.alphaTest>0||E.map&&E.alphaTest>0||E.alphaToCoverage===!0){let D=N.uuid,W=E.uuid,R=c[D];if(R===void 0)R={},c[D]=R;let I=R[W];if(I===void 0)I=N.clone(),R[W]=I,E.addEventListener("dispose",b);N=I}if(N.visible=E.visible,N.wireframe=E.wireframe,A===Or)N.side=E.shadowSide!==null?E.shadowSide:E.side;else N.side=E.shadowSide!==null?E.shadowSide:f[E.side];if(N.alphaMap=E.alphaMap,N.alphaTest=E.alphaToCoverage===!0?0.5:E.alphaTest,N.map=E.map,N.clipShadows=E.clipShadows,N.clippingPlanes=E.clippingPlanes,N.clipIntersection=E.clipIntersection,N.displacementMap=E.displacementMap,N.displacementScale=E.displacementScale,N.displacementBias=E.displacementBias,N.wireframeLinewidth=E.wireframeLinewidth,N.linewidth=E.linewidth,y.isPointLight===!0&&N.isMeshDistanceMaterial===!0){let D=e.properties.get(N);D.light=y}return N}function v(w,E,y,A,N){if(w.visible===!1)return;if(w.layers.test(E.layers)&&(w.isMesh||w.isLine||w.isPoints)){if((w.castShadow||w.receiveShadow&&N===Or)&&(!w.frustumCulled||w.intersectsFrustum(i))){w.modelViewMatrix.multiplyMatrices(y.matrixWorldInverse,w.matrixWorld);let W=t.update(w),R=w.material;if(Array.isArray(R)){let I=W.groups;for(let k=0,z=I.length;k<z;k++){let te=I[k],Y=R[te.materialIndex];if(Y&&Y.visible){let Q=S(w,Y,A,N);w.onBeforeShadow(e,w,E,y,W,Q,te),e.renderBufferDirect(y,null,W,Q,w,te),w.onAfterShadow(e,w,E,y,W,Q,te)}}}else if(R.visible){let I=S(w,R,A,N);w.onBeforeShadow(e,w,E,y,W,I,null),e.renderBufferDirect(y,null,W,I,w,null),w.onAfterShadow(e,w,E,y,W,I,null)}}}let D=w.children;for(let W=0,R=D.length;W<R;W++)v(D[W],E,y,A,N)}function b(w){w.target.removeEventListener("dispose",b);for(let y in c){let A=c[y],N=w.target.uuid;if(N in A)A[N].dispose(),delete A[N]}}}function aw(e,t){function n(){let B=!1,he=new gt,J=null,ue=new gt(0,0,0,0);return{setMask:function(ye){if(J!==ye&&!B)e.colorMask(ye,ye,ye,ye),J=ye},setLocked:function(ye){B=ye},setClear:function(ye,ie,me,ke,ft){if(ft===!0)ye*=ke,ie*=ke,me*=ke;if(he.set(ye,ie,me,ke),ue.equals(he)===!1)e.clearColor(ye,ie,me,ke),ue.copy(he)},reset:function(){B=!1,J=null,ue.set(-1,0,0,0)}}}function i(){let B=!1,he=!1,J=null,ue=null,ye=null;return{setReversed:function(ie){if(he!==ie){let me=t.get("EXT_clip_control");if(ie)me.clipControlEXT(me.LOWER_LEFT_EXT,me.ZERO_TO_ONE_EXT);else me.clipControlEXT(me.LOWER_LEFT_EXT,me.NEGATIVE_ONE_TO_ONE_EXT);he=ie;let ke=ye;ye=null,this.setClear(ke)}},getReversed:function(){return he},setTest:function(ie){if(ie)le(e.DEPTH_TEST);else Pe(e.DEPTH_TEST)},setMask:function(ie){if(J!==ie&&!B)e.depthMask(ie),J=ie},setFunc:function(ie){if(he)ie=Lm[ie];if(ue!==ie){switch(ie){case nm:e.depthFunc(e.NEVER);break;case im:e.depthFunc(e.ALWAYS);break;case rm:e.depthFunc(e.LESS);break;case _c:e.depthFunc(e.LEQUAL);break;case sm:e.depthFunc(e.EQUAL);break;case om:e.depthFunc(e.GEQUAL);break;case am:e.depthFunc(e.GREATER);break;case lm:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}ue=ie}},setLocked:function(ie){B=ie},setClear:function(ie){if(ye!==ie){if(ye=ie,he)ie=1-ie;e.clearDepth(ie)}},reset:function(){B=!1,J=null,ue=null,ye=null,he=!1}}}function r(){let B=!1,he=null,J=null,ue=null,ye=null,ie=null,me=null,ke=null,ft=null;return{setTest:function(nt){if(!B)if(nt)le(e.STENCIL_TEST);else Pe(e.STENCIL_TEST)},setMask:function(nt){if(he!==nt&&!B)e.stencilMask(nt),he=nt},setFunc:function(nt,Fn,Zn){if(J!==nt||ue!==Fn||ye!==Zn)e.stencilFunc(nt,Fn,Zn),J=nt,ue=Fn,ye=Zn},setOp:function(nt,Fn,Zn){if(ie!==nt||me!==Fn||ke!==Zn)e.stencilOp(nt,Fn,Zn),ie=nt,me=Fn,ke=Zn},setLocked:function(nt){B=nt},setClear:function(nt){if(ft!==nt)e.clearStencil(nt),ft=nt},reset:function(){B=!1,he=null,J=null,ue=null,ye=null,ie=null,me=null,ke=null,ft=null}}}let s=new n,o=new i,a=new r,l=new WeakMap,c=new WeakMap,u={},f={},h={},d=new WeakMap,g=[],_=null,m=!1,p=null,x=null,S=null,v=null,b=null,w=null,E=null,y=new Le(0,0,0),A=0,N=!1,P=null,D=null,W=null,R=null,I=null,k=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),z=!1,te=0,Y=e.getParameter(e.VERSION);if(Y.indexOf("WebGL")!==-1)te=parseFloat(/^WebGL (\d)/.exec(Y)[1]),z=te>=1;else if(Y.indexOf("OpenGL ES")!==-1)te=parseFloat(/^OpenGL ES (\d)/.exec(Y)[1]),z=te>=2;let Q=null,G={},ee=e.getParameter(e.SCISSOR_BOX),oe=e.getParameter(e.VIEWPORT),Fe=new gt().fromArray(ee),Re=new gt().fromArray(oe);function X(B,he,J,ue){let ye=new Uint8Array(4),ie=e.createTexture();e.bindTexture(B,ie),e.texParameteri(B,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(B,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let me=0;me<J;me++)if(B===e.TEXTURE_3D||B===e.TEXTURE_2D_ARRAY)e.texImage3D(he,0,e.RGBA,1,1,ue,0,e.RGBA,e.UNSIGNED_BYTE,ye);else e.texImage2D(he+me,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,ye);return ie}let se={};se[e.TEXTURE_2D]=X(e.TEXTURE_2D,e.TEXTURE_2D,1),se[e.TEXTURE_CUBE_MAP]=X(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),se[e.TEXTURE_2D_ARRAY]=X(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),se[e.TEXTURE_3D]=X(e.TEXTURE_3D,e.TEXTURE_3D,1,1),s.setClear(0,0,0,1),o.setClear(1),a.setClear(0),le(e.DEPTH_TEST),o.setFunc(_c),kt(!1),pt(pc),le(e.CULL_FACE),st(bn);function le(B){if(u[B]!==!0)e.enable(B),u[B]=!0}function Pe(B){if(u[B]!==!1)e.disable(B),u[B]=!1}function Ue(B,he){if(h[B]!==he){if(e.bindFramebuffer(B,he),h[B]=he,B===e.DRAW_FRAMEBUFFER)h[e.FRAMEBUFFER]=he;if(B===e.FRAMEBUFFER)h[e.DRAW_FRAMEBUFFER]=he;return!0}return!1}function Ae(B,he){let J=g,ue=!1;if(B){if(J=d.get(he),J===void 0)J=[],d.set(he,J);let ye=B.textures;if(J.length!==ye.length||J[0]!==e.COLOR_ATTACHMENT0){for(let ie=0,me=ye.length;ie<me;ie++)J[ie]=e.COLOR_ATTACHMENT0+ie;J.length=ye.length,ue=!0}}else if(J[0]!==e.BACK)J[0]=e.BACK,ue=!0;if(ue)e.drawBuffers(J)}function Ct(B){if(_!==B)return e.useProgram(B),_=B,!0;return!1}let qe={[kr]:e.FUNC_ADD,[Fp]:e.FUNC_SUBTRACT,[Bp]:e.FUNC_REVERSE_SUBTRACT};qe[kp]=e.MIN,qe[zp]=e.MAX;let je={[Gp]:e.ZERO,[Hp]:e.ONE,[Vp]:e.SRC_COLOR,[Xp]:e.SRC_ALPHA,[Jp]:e.SRC_ALPHA_SATURATE,[$p]:e.DST_COLOR,[jp]:e.DST_ALPHA,[Wp]:e.ONE_MINUS_SRC_COLOR,[qp]:e.ONE_MINUS_SRC_ALPHA,[Zp]:e.ONE_MINUS_DST_COLOR,[Yp]:e.ONE_MINUS_DST_ALPHA,[Kp]:e.CONSTANT_COLOR,[Qp]:e.ONE_MINUS_CONSTANT_COLOR,[em]:e.CONSTANT_ALPHA,[tm]:e.ONE_MINUS_CONSTANT_ALPHA};function st(B,he,J,ue,ye,ie,me,ke,ft,nt){if(B===bn){if(m===!0)Pe(e.BLEND),m=!1;return}if(m===!1)le(e.BLEND),m=!0;if(B!==Up){if(B!==p||nt!==N){if(x!==kr||b!==kr)e.blendEquation(e.FUNC_ADD),x=kr,b=kr;if(nt)switch(B){case Fr:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Br:e.blendFunc(e.ONE,e.ONE);break;case mc:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case gc:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:Ne("WebGLState: Invalid blending: ",B);break}else switch(B){case Fr:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Br:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case mc:Ne("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case gc:Ne("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ne("WebGLState: Invalid blending: ",B);break}S=null,v=null,w=null,E=null,y.set(0,0,0),A=0,p=B,N=nt}return}if(ye=ye||he,ie=ie||J,me=me||ue,he!==x||ye!==b)e.blendEquationSeparate(qe[he],qe[ye]),x=he,b=ye;if(J!==S||ue!==v||ie!==w||me!==E)e.blendFuncSeparate(je[J],je[ue],je[ie],je[me]),S=J,v=ue,w=ie,E=me;if(ke.equals(y)===!1||ft!==A)e.blendColor(ke.r,ke.g,ke.b,ft),y.copy(ke),A=ft;p=B,N=!1}function Ye(B,he){B.side===Rn?Pe(e.CULL_FACE):le(e.CULL_FACE);let J=B.side===qt;if(he)J=!J;kt(J),B.blending===Fr&&B.transparent===!1?st(bn):st(B.blending,B.blendEquation,B.blendSrc,B.blendDst,B.blendEquationAlpha,B.blendSrcAlpha,B.blendDstAlpha,B.blendColor,B.blendAlpha,B.premultipliedAlpha),o.setFunc(B.depthFunc),o.setTest(B.depthTest),o.setMask(B.depthWrite),s.setMask(B.colorWrite);let ue=B.stencilWrite;if(a.setTest(ue),ue)a.setMask(B.stencilWriteMask),a.setFunc(B.stencilFunc,B.stencilRef,B.stencilFuncMask),a.setOp(B.stencilFail,B.stencilZFail,B.stencilZPass);Rt(B.polygonOffset,B.polygonOffsetFactor,B.polygonOffsetUnits),B.alphaToCoverage===!0?le(e.SAMPLE_ALPHA_TO_COVERAGE):Pe(e.SAMPLE_ALPHA_TO_COVERAGE)}function kt(B){if(P!==B){if(B)e.frontFace(e.CW);else e.frontFace(e.CCW);P=B}}function pt(B){if(B!==Dp){if(le(e.CULL_FACE),B!==D)if(B===pc)e.cullFace(e.BACK);else if(B===Np)e.cullFace(e.FRONT);else e.cullFace(e.FRONT_AND_BACK)}else Pe(e.CULL_FACE);D=B}function nn(B){if(B!==W){if(z)e.lineWidth(B);W=B}}function Rt(B,he,J){if(B){if(le(e.POLYGON_OFFSET_FILL),R!==he||I!==J){if(R=he,I=J,o.getReversed())he=-he;e.polygonOffset(he,J)}}else Pe(e.POLYGON_OFFSET_FILL)}function Pt(B){if(B)le(e.SCISSOR_TEST);else Pe(e.SCISSOR_TEST)}function U(B){if(B===void 0)B=e.TEXTURE0+k-1;if(Q!==B)e.activeTexture(B),Q=B}function rn(B,he,J){if(J===void 0)if(Q===null)J=e.TEXTURE0+k-1;else J=Q;let ue=G[J];if(ue===void 0)ue={type:void 0,texture:void 0},G[J]=ue;if(ue.type!==B||ue.texture!==he){if(Q!==J)e.activeTexture(J),Q=J;e.bindTexture(B,he||se[B]),ue.type=B,ue.texture=he}}function tt(){let B=G[Q];if(B!==void 0&&B.type!==void 0)e.bindTexture(B.type,null),B.type=void 0,B.texture=void 0}function yt(){try{e.compressedTexImage2D(...arguments)}catch(B){Ne("WebGLState:",B)}}function C(){try{e.compressedTexImage3D(...arguments)}catch(B){Ne("WebGLState:",B)}}function M(){try{e.texSubImage2D(...arguments)}catch(B){Ne("WebGLState:",B)}}function O(){try{e.texSubImage3D(...arguments)}catch(B){Ne("WebGLState:",B)}}function q(){try{e.compressedTexSubImage2D(...arguments)}catch(B){Ne("WebGLState:",B)}}function re(){try{e.compressedTexSubImage3D(...arguments)}catch(B){Ne("WebGLState:",B)}}function ce(){try{e.texStorage2D(...arguments)}catch(B){Ne("WebGLState:",B)}}function fe(){try{e.texStorage3D(...arguments)}catch(B){Ne("WebGLState:",B)}}function Z(){try{e.texImage2D(...arguments)}catch(B){Ne("WebGLState:",B)}}function K(){try{e.texImage3D(...arguments)}catch(B){Ne("WebGLState:",B)}}function ve(B){if(f[B]!==void 0)return f[B];else return e.getParameter(B)}function Ee(B,he){if(f[B]!==he)e.pixelStorei(B,he),f[B]=he}function de(B){if(Fe.equals(B)===!1)e.scissor(B.x,B.y,B.z,B.w),Fe.copy(B)}function ae(B){if(Re.equals(B)===!1)e.viewport(B.x,B.y,B.z,B.w),Re.copy(B)}function Ce(B,he){let J=c.get(he);if(J===void 0)J=new WeakMap,c.set(he,J);let ue=J.get(B);if(ue===void 0)ue=e.getUniformBlockIndex(he,B.name),J.set(B,ue)}function De(B,he){let ue=c.get(he).get(B);if(l.get(he)!==ue)e.uniformBlockBinding(he,ue,B.__bindingPointIndex),l.set(he,ue)}function Ke(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},f={},Q=null,G={},h={},d=new WeakMap,g=[],_=null,m=!1,p=null,x=null,S=null,v=null,b=null,w=null,E=null,y=new Le(0,0,0),A=0,N=!1,P=null,D=null,W=null,R=null,I=null,Fe.set(0,0,e.canvas.width,e.canvas.height),Re.set(0,0,e.canvas.width,e.canvas.height),s.reset(),o.reset(),a.reset()}return{buffers:{color:s,depth:o,stencil:a},enable:le,disable:Pe,bindFramebuffer:Ue,drawBuffers:Ae,useProgram:Ct,setBlending:st,setMaterial:Ye,setFlipSided:kt,setCullFace:pt,setLineWidth:nn,setPolygonOffset:Rt,setScissorTest:Pt,activeTexture:U,bindTexture:rn,unbindTexture:tt,compressedTexImage2D:yt,compressedTexImage3D:C,texImage2D:Z,texImage3D:K,pixelStorei:Ee,getParameter:ve,updateUBOMapping:Ce,uniformBlockBinding:De,texStorage2D:ce,texStorage3D:fe,texSubImage2D:M,texSubImage3D:O,compressedTexSubImage2D:q,compressedTexSubImage3D:re,scissor:de,viewport:ae,reset:Ke}}function lw(e,t,n,i,r,s,o){let a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new ne,u=new WeakMap,f=new Set,h,d=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch(C){}function _(C,M){return g?new OffscreenCanvas(C,M):Lr("canvas")}function m(C,M,O){let q=1,re=yt(C);if(re.width>O||re.height>O)q=O/Math.max(re.width,re.height);if(q<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){let ce=Math.floor(q*re.width),fe=Math.floor(q*re.height);if(h===void 0)h=_(ce,fe);let Z=M?_(ce,fe):h;return Z.width=ce,Z.height=fe,Z.getContext("2d").drawImage(C,0,0,ce,fe),Ie("WebGLRenderer: Texture has been resized from ("+re.width+"x"+re.height+") to ("+ce+"x"+fe+")."),Z}else{if("data"in C)Ie("WebGLRenderer: Image in DataTexture is too big ("+re.width+"x"+re.height+").");return C}return C}function p(C){return C.generateMipmaps}function x(C){e.generateMipmap(C)}function S(C){if(C.isWebGLCubeRenderTarget)return e.TEXTURE_CUBE_MAP;if(C.isWebGL3DRenderTarget)return e.TEXTURE_3D;if(C.isWebGLArrayRenderTarget||C.isCompressedArrayTexture)return e.TEXTURE_2D_ARRAY;return e.TEXTURE_2D}function v(C,M,O,q,re,ce=!1){if(C!==null){if(e[C]!==void 0)return e[C];Ie("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let fe;if(q){if(fe=t.get("EXT_texture_norm16"),!fe)Ie("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension")}let Z=M;if(M===e.RED){if(O===e.FLOAT)Z=e.R32F;if(O===e.HALF_FLOAT)Z=e.R16F;if(O===e.UNSIGNED_BYTE)Z=e.R8;if(O===e.UNSIGNED_SHORT&&fe)Z=fe.R16_EXT;if(O===e.SHORT&&fe)Z=fe.R16_SNORM_EXT}if(M===e.RED_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.R8UI;if(O===e.UNSIGNED_SHORT)Z=e.R16UI;if(O===e.UNSIGNED_INT)Z=e.R32UI;if(O===e.BYTE)Z=e.R8I;if(O===e.SHORT)Z=e.R16I;if(O===e.INT)Z=e.R32I}if(M===e.RG){if(O===e.FLOAT)Z=e.RG32F;if(O===e.HALF_FLOAT)Z=e.RG16F;if(O===e.UNSIGNED_BYTE)Z=e.RG8;if(O===e.UNSIGNED_SHORT&&fe)Z=fe.RG16_EXT;if(O===e.SHORT&&fe)Z=fe.RG16_SNORM_EXT}if(M===e.RG_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.RG8UI;if(O===e.UNSIGNED_SHORT)Z=e.RG16UI;if(O===e.UNSIGNED_INT)Z=e.RG32UI;if(O===e.BYTE)Z=e.RG8I;if(O===e.SHORT)Z=e.RG16I;if(O===e.INT)Z=e.RG32I}if(M===e.RGB_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.RGB8UI;if(O===e.UNSIGNED_SHORT)Z=e.RGB16UI;if(O===e.UNSIGNED_INT)Z=e.RGB32UI;if(O===e.BYTE)Z=e.RGB8I;if(O===e.SHORT)Z=e.RGB16I;if(O===e.INT)Z=e.RGB32I}if(M===e.RGBA_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.RGBA8UI;if(O===e.UNSIGNED_SHORT)Z=e.RGBA16UI;if(O===e.UNSIGNED_INT)Z=e.RGBA32UI;if(O===e.BYTE)Z=e.RGBA8I;if(O===e.SHORT)Z=e.RGBA16I;if(O===e.INT)Z=e.RGBA32I}if(M===e.RGB){if(O===e.UNSIGNED_SHORT&&fe)Z=fe.RGB16_EXT;if(O===e.SHORT&&fe)Z=fe.RGB16_SNORM_EXT;if(O===e.UNSIGNED_INT_5_9_9_9_REV)Z=e.RGB9_E5;if(O===e.UNSIGNED_INT_10F_11F_11F_REV)Z=e.R11F_G11F_B10F}if(M===e.RGBA){let K=ce?nh:We.getTransfer(re);if(O===e.FLOAT)Z=e.RGBA32F;if(O===e.HALF_FLOAT)Z=e.RGBA16F;if(O===e.UNSIGNED_BYTE)Z=K===lt?e.SRGB8_ALPHA8:e.RGBA8;if(O===e.UNSIGNED_SHORT&&fe)Z=fe.RGBA16_EXT;if(O===e.SHORT&&fe)Z=fe.RGBA16_SNORM_EXT;if(O===e.UNSIGNED_SHORT_4_4_4_4)Z=e.RGBA4;if(O===e.UNSIGNED_SHORT_5_5_5_1)Z=e.RGB5_A1}if(Z===e.R16F||Z===e.R32F||Z===e.RG16F||Z===e.RG32F||Z===e.RGBA16F||Z===e.RGBA32F)t.get("EXT_color_buffer_float");return Z}function b(C,M){let O;if(C){if(M===null||M===xi||M===Gr)O=e.DEPTH24_STENCIL8;else if(M===ri)O=e.DEPTH32F_STENCIL8;else if(M===Ls)O=e.DEPTH24_STENCIL8,Ie("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")}else if(M===null||M===xi||M===Gr)O=e.DEPTH_COMPONENT24;else if(M===ri)O=e.DEPTH_COMPONENT32F;else if(M===Ls)O=e.DEPTH_COMPONENT16;return O}function w(C,M){if(p(C)===!0||C.isFramebufferTexture&&C.minFilter!==yi&&C.minFilter!==an)return Math.log2(Math.max(M.width,M.height))+1;else if(C.mipmaps!==void 0&&C.mipmaps.length>0)return C.mipmaps.length;else if(C.isCompressedTexture&&Array.isArray(C.image))return M.mipmaps.length;else return 1}function E(C){let M=C.target;if(M.removeEventListener("dispose",E),A(M),M.isVideoTexture)u.delete(M);if(M.isHTMLTexture)f.delete(M)}function y(C){let M=C.target;M.removeEventListener("dispose",y),P(M)}function A(C){let M=i.get(C);if(M.__webglInit===void 0)return;let O=C.source,q=d.get(O);if(q){let re=q[M.__cacheKey];if(re.usedTimes--,re.usedTimes===0)N(C);if(Object.keys(q).length===0)d.delete(O)}i.remove(C)}function N(C){let M=i.get(C);e.deleteTexture(M.__webglTexture);let O=C.source,q=d.get(O);delete q[M.__cacheKey],o.memory.textures--}function P(C){let M=i.get(C);if(C.depthTexture)C.depthTexture.dispose(),i.remove(C.depthTexture);if(C.isWebGLCubeRenderTarget)for(let q=0;q<6;q++){if(Array.isArray(M.__webglFramebuffer[q]))for(let re=0;re<M.__webglFramebuffer[q].length;re++)e.deleteFramebuffer(M.__webglFramebuffer[q][re]);else e.deleteFramebuffer(M.__webglFramebuffer[q]);if(M.__webglDepthbuffer)e.deleteRenderbuffer(M.__webglDepthbuffer[q])}else{if(Array.isArray(M.__webglFramebuffer))for(let q=0;q<M.__webglFramebuffer.length;q++)e.deleteFramebuffer(M.__webglFramebuffer[q]);else e.deleteFramebuffer(M.__webglFramebuffer);if(M.__webglDepthbuffer)e.deleteRenderbuffer(M.__webglDepthbuffer);if(M.__webglMultisampledFramebuffer)e.deleteFramebuffer(M.__webglMultisampledFramebuffer);if(M.__webglColorRenderbuffer){for(let q=0;q<M.__webglColorRenderbuffer.length;q++)if(M.__webglColorRenderbuffer[q])e.deleteRenderbuffer(M.__webglColorRenderbuffer[q])}if(M.__webglDepthRenderbuffer)e.deleteRenderbuffer(M.__webglDepthRenderbuffer)}let O=C.textures;for(let q=0,re=O.length;q<re;q++){let ce=i.get(O[q]);if(ce.__webglTexture)e.deleteTexture(ce.__webglTexture),o.memory.textures--;i.remove(O[q])}i.remove(C)}let D=0;function W(){D=0}function R(){return D}function I(C){D=C}function k(){let C=D;if(C>=r.maxTextures)Ie("WebGLTextures: Trying to use "+(C+1)+" texture units while this GPU supports only "+r.maxTextures);return D+=1,C}function z(C){let M=[];return M.push(C.wrapS),M.push(C.wrapT),M.push(C.wrapR||0),M.push(C.magFilter),M.push(C.minFilter),M.push(C.anisotropy),M.push(C.internalFormat),M.push(C.format),M.push(C.type),M.push(C.generateMipmaps),M.push(C.premultiplyAlpha),M.push(C.flipY),M.push(C.unpackAlignment),M.push(C.colorSpace),M.join()}function te(C,M){let O=i.get(C);if(C.isVideoTexture)rn(C);if(C.isRenderTargetTexture===!1&&C.isExternalTexture!==!0&&C.version>0&&O.__version!==C.version){let q=C.image;if(q===null)Ie("WebGLRenderer: Texture marked for update but no image data found.");else if(q.complete===!1)Ie("WebGLRenderer: Texture marked for update but image is incomplete");else{Pe(O,C,M);return}}else if(C.isExternalTexture)O.__webglTexture=C.sourceTexture?C.sourceTexture:null;n.bindTexture(e.TEXTURE_2D,O.__webglTexture,e.TEXTURE0+M)}function Y(C,M){let O=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&O.__version!==C.version){Pe(O,C,M);return}else if(C.isExternalTexture)O.__webglTexture=C.sourceTexture?C.sourceTexture:null;n.bindTexture(e.TEXTURE_2D_ARRAY,O.__webglTexture,e.TEXTURE0+M)}function Q(C,M){let O=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&O.__version!==C.version){Pe(O,C,M);return}n.bindTexture(e.TEXTURE_3D,O.__webglTexture,e.TEXTURE0+M)}function G(C,M){let O=i.get(C);if(C.isCubeDepthTexture!==!0&&C.version>0&&O.__version!==C.version){Ue(O,C,M);return}n.bindTexture(e.TEXTURE_CUBE_MAP,O.__webglTexture,e.TEXTURE0+M)}let ee={[fm]:e.REPEAT,[ca]:e.CLAMP_TO_EDGE,[dm]:e.MIRRORED_REPEAT},oe={[yi]:e.NEAREST,[pm]:e.NEAREST_MIPMAP_NEAREST,[Is]:e.NEAREST_MIPMAP_LINEAR,[an]:e.LINEAR,[ha]:e.LINEAR_MIPMAP_NEAREST,[Hi]:e.LINEAR_MIPMAP_LINEAR},Fe={[Mm]:e.NEVER,[Cm]:e.ALWAYS,[wm]:e.LESS,[_a]:e.LEQUAL,[Tm]:e.EQUAL,[va]:e.GEQUAL,[Em]:e.GREATER,[Am]:e.NOTEQUAL};function Re(C,M){if(M.type===ri&&t.has("OES_texture_float_linear")===!1&&(M.magFilter===an||M.magFilter===ha||M.magFilter===Is||M.magFilter===Hi||M.minFilter===an||M.minFilter===ha||M.minFilter===Is||M.minFilter===Hi))Ie("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.");if(e.texParameteri(C,e.TEXTURE_WRAP_S,ee[M.wrapS]),e.texParameteri(C,e.TEXTURE_WRAP_T,ee[M.wrapT]),C===e.TEXTURE_3D||C===e.TEXTURE_2D_ARRAY)e.texParameteri(C,e.TEXTURE_WRAP_R,ee[M.wrapR]);if(e.texParameteri(C,e.TEXTURE_MAG_FILTER,oe[M.magFilter]),e.texParameteri(C,e.TEXTURE_MIN_FILTER,oe[M.minFilter]),M.compareFunction)e.texParameteri(C,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(C,e.TEXTURE_COMPARE_FUNC,Fe[M.compareFunction]);if(t.has("EXT_texture_filter_anisotropic")===!0){if(M.magFilter===yi)return;if(M.minFilter!==Is&&M.minFilter!==Hi)return;if(M.type===ri&&t.has("OES_texture_float_linear")===!1)return;if(M.anisotropy>1||i.get(M).__currentAnisotropy){let O=t.get("EXT_texture_filter_anisotropic");e.texParameterf(C,O.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(M.anisotropy,r.getMaxAnisotropy())),i.get(M).__currentAnisotropy=M.anisotropy}}}function X(C,M){let O=!1;if(C.__webglInit===void 0)C.__webglInit=!0,M.addEventListener("dispose",E);let q=M.source,re=d.get(q);if(re===void 0)re={},d.set(q,re);let ce=z(M);if(ce!==C.__cacheKey){if(re[ce]===void 0)re[ce]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,O=!0;re[ce].usedTimes++;let fe=re[C.__cacheKey];if(fe!==void 0){if(re[C.__cacheKey].usedTimes--,fe.usedTimes===0)N(M)}C.__cacheKey=ce,C.__webglTexture=re[ce].texture}return O}function se(C,M,O){return Math.floor(Math.floor(C/O)/M)}function le(C,M,O,q){let ce=C.updateRanges;if(ce.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,M.width,M.height,O,q,M.data);else{ce.sort((Ee,de)=>Ee.start-de.start);let fe=0;for(let Ee=1;Ee<ce.length;Ee++){let de=ce[fe],ae=ce[Ee],Ce=de.start+de.count,De=se(ae.start,M.width,4),Ke=se(de.start,M.width,4);if(ae.start<=Ce+1&&De===Ke&&se(ae.start+ae.count-1,M.width,4)===De)de.count=Math.max(de.count,ae.start+ae.count-de.start);else++fe,ce[fe]=ae}ce.length=fe+1;let Z=n.getParameter(e.UNPACK_ROW_LENGTH),K=n.getParameter(e.UNPACK_SKIP_PIXELS),ve=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,M.width);for(let Ee=0,de=ce.length;Ee<de;Ee++){let ae=ce[Ee],Ce=Math.floor(ae.start/4),De=Math.ceil(ae.count/4),Ke=Ce%M.width,B=Math.floor(Ce/M.width),he=De,J=1;n.pixelStorei(e.UNPACK_SKIP_PIXELS,Ke),n.pixelStorei(e.UNPACK_SKIP_ROWS,B),n.texSubImage2D(e.TEXTURE_2D,0,Ke,B,he,1,O,q,M.data)}C.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,Z),n.pixelStorei(e.UNPACK_SKIP_PIXELS,K),n.pixelStorei(e.UNPACK_SKIP_ROWS,ve)}}function Pe(C,M,O){let q=e.TEXTURE_2D;if(M.isDataArrayTexture||M.isCompressedArrayTexture)q=e.TEXTURE_2D_ARRAY;if(M.isData3DTexture)q=e.TEXTURE_3D;let re=X(C,M),ce=M.source;n.bindTexture(q,C.__webglTexture,e.TEXTURE0+O);let fe=i.get(ce);if(ce.version!==fe.__version||re===!0){if(n.activeTexture(e.TEXTURE0+O),(typeof ImageBitmap<"u"&&M.image instanceof ImageBitmap)===!1){let J=We.getPrimaries(We.workingColorSpace),ue=M.colorSpace===qi?null:We.getPrimaries(M.colorSpace),ye=M.colorSpace===qi||J===ue?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,ye)}n.pixelStorei(e.UNPACK_ALIGNMENT,M.unpackAlignment);let K=m(M.image,!1,r.maxTextureSize);K=tt(M,K);let ve=s.convert(M.format,M.colorSpace),Ee=s.convert(M.type),de=v(M.internalFormat,ve,Ee,M.normalized,M.colorSpace,M.isVideoTexture);Re(q,M);let ae,Ce=M.mipmaps,De=M.isVideoTexture!==!0,Ke=fe.__version===void 0||re===!0,B=ce.dataReady,he=w(M,K);if(M.isDepthTexture){if(de=b(M.format===Wi,M.type),Ke)if(De)n.texStorage2D(e.TEXTURE_2D,1,de,K.width,K.height);else n.texImage2D(e.TEXTURE_2D,0,de,K.width,K.height,0,ve,Ee,null)}else if(M.isDataTexture)if(Ce.length>0){if(De&&Ke)n.texStorage2D(e.TEXTURE_2D,he,de,Ce[0].width,Ce[0].height);for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],De){if(B)n.texSubImage2D(e.TEXTURE_2D,J,0,0,ae.width,ae.height,ve,Ee,ae.data)}else n.texImage2D(e.TEXTURE_2D,J,de,ae.width,ae.height,0,ve,Ee,ae.data);M.generateMipmaps=!1}else if(De){if(Ke)n.texStorage2D(e.TEXTURE_2D,he,de,K.width,K.height);if(B)le(M,K,ve,Ee)}else n.texImage2D(e.TEXTURE_2D,0,de,K.width,K.height,0,ve,Ee,K.data);else if(M.isCompressedTexture)if(M.isCompressedArrayTexture){if(De&&Ke)n.texStorage3D(e.TEXTURE_2D_ARRAY,he,de,Ce[0].width,Ce[0].height,K.depth);for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],M.format!==Hn)if(ve!==null)if(De){if(B)if(M.layerUpdates.size>0){let ye=Hh(ae.width,ae.height,M.format,M.type);for(let ie of M.layerUpdates){let me=ae.data.subarray(ie*ye/ae.data.BYTES_PER_ELEMENT,(ie+1)*ye/ae.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,J,0,0,ie,ae.width,ae.height,1,ve,me)}}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,J,0,0,0,ae.width,ae.height,K.depth,ve,ae.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,J,de,ae.width,ae.height,K.depth,0,ae.data,0,0);else Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(De){if(B)n.texSubImage3D(e.TEXTURE_2D_ARRAY,J,0,0,0,ae.width,ae.height,K.depth,ve,Ee,ae.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,J,de,ae.width,ae.height,K.depth,0,ve,Ee,ae.data);if(M.layerUpdates.size>0)M.clearLayerUpdates()}else{if(De&&Ke)n.texStorage2D(e.TEXTURE_2D,he,de,Ce[0].width,Ce[0].height);for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],M.format!==Hn)if(ve!==null)if(De){if(B)n.compressedTexSubImage2D(e.TEXTURE_2D,J,0,0,ae.width,ae.height,ve,ae.data)}else n.compressedTexImage2D(e.TEXTURE_2D,J,de,ae.width,ae.height,0,ae.data);else Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(De){if(B)n.texSubImage2D(e.TEXTURE_2D,J,0,0,ae.width,ae.height,ve,Ee,ae.data)}else n.texImage2D(e.TEXTURE_2D,J,de,ae.width,ae.height,0,ve,Ee,ae.data)}else if(M.isDataArrayTexture)if(De){if(Ke)n.texStorage3D(e.TEXTURE_2D_ARRAY,he,de,K.width,K.height,K.depth);if(B)if(M.layerUpdates.size>0){let J=Hh(K.width,K.height,M.format,M.type);for(let ue of M.layerUpdates){let ye=K.data.subarray(ue*J/K.data.BYTES_PER_ELEMENT,(ue+1)*J/K.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,ue,K.width,K.height,1,ve,Ee,ye)}M.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,K.width,K.height,K.depth,ve,Ee,K.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,de,K.width,K.height,K.depth,0,ve,Ee,K.data);else if(M.isData3DTexture)if(De){if(Ke)n.texStorage3D(e.TEXTURE_3D,he,de,K.width,K.height,K.depth);if(B)n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,K.width,K.height,K.depth,ve,Ee,K.data)}else n.texImage3D(e.TEXTURE_3D,0,de,K.width,K.height,K.depth,0,ve,Ee,K.data);else if(M.isFramebufferTexture){if(Ke)if(De)n.texStorage2D(e.TEXTURE_2D,he,de,K.width,K.height);else{let J=K.width,ue=K.height;for(let ye=0;ye<he;ye++)n.texImage2D(e.TEXTURE_2D,ye,de,J,ue,0,ve,Ee,null),J>>=1,ue>>=1}}else if(M.isHTMLTexture){if("texElementImage2D"in e){let J=e.canvas;if(!J.hasAttribute("layoutsubtree"))J.setAttribute("layoutsubtree","true");if(K.parentNode!==J){J.appendChild(K),f.add(M),J.onpaint=(ue)=>{let ye=ue.changedElements;for(let ie of f)if(ye.includes(ie.image))ie.needsUpdate=!0},J.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,K);else{let{RGBA:ye,RGBA:ie,UNSIGNED_BYTE:me}=e;e.texElementImage2D(e.TEXTURE_2D,0,ye,ie,me,K)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(Ce.length>0){if(De&&Ke){let J=yt(Ce[0]);n.texStorage2D(e.TEXTURE_2D,he,de,J.width,J.height)}for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],De){if(B)n.texSubImage2D(e.TEXTURE_2D,J,0,0,ve,Ee,ae)}else n.texImage2D(e.TEXTURE_2D,J,de,ve,Ee,ae);M.generateMipmaps=!1}else if(De){if(Ke){let J=yt(K);n.texStorage2D(e.TEXTURE_2D,he,de,J.width,J.height)}if(B)n.texSubImage2D(e.TEXTURE_2D,0,0,0,ve,Ee,K)}else n.texImage2D(e.TEXTURE_2D,0,de,ve,Ee,K);if(p(M))x(q);if(fe.__version=ce.version,M.onUpdate)M.onUpdate(M)}C.__version=M.version}function Ue(C,M,O){if(M.image.length!==6)return;let q=X(C,M),re=M.source;n.bindTexture(e.TEXTURE_CUBE_MAP,C.__webglTexture,e.TEXTURE0+O);let ce=i.get(re);if(re.version!==ce.__version||q===!0){n.activeTexture(e.TEXTURE0+O);let fe=We.getPrimaries(We.workingColorSpace),Z=M.colorSpace===qi?null:We.getPrimaries(M.colorSpace),K=M.colorSpace===qi||fe===Z?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,M.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,K);let ve=M.isCompressedTexture||M.image[0].isCompressedTexture,Ee=M.image[0]&&M.image[0].isDataTexture,de=[];for(let ie=0;ie<6;ie++){if(!ve&&!Ee)de[ie]=m(M.image[ie],!0,r.maxCubemapSize);else de[ie]=Ee?M.image[ie].image:M.image[ie];de[ie]=tt(M,de[ie])}let ae=de[0],Ce=s.convert(M.format,M.colorSpace),De=s.convert(M.type),Ke=v(M.internalFormat,Ce,De,M.normalized,M.colorSpace),B=M.isVideoTexture!==!0,he=ce.__version===void 0||q===!0,J=re.dataReady,ue=w(M,ae);Re(e.TEXTURE_CUBE_MAP,M);let ye;if(ve){if(B&&he)n.texStorage2D(e.TEXTURE_CUBE_MAP,ue,Ke,ae.width,ae.height);for(let ie=0;ie<6;ie++){ye=de[ie].mipmaps;for(let me=0;me<ye.length;me++){let ke=ye[me];if(M.format!==Hn)if(Ce!==null)if(B){if(J)n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,me,0,0,ke.width,ke.height,Ce,ke.data)}else n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,me,Ke,ke.width,ke.height,0,ke.data);else Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()");else if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,me,0,0,ke.width,ke.height,Ce,De,ke.data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,me,Ke,ke.width,ke.height,0,Ce,De,ke.data)}}}else{if(ye=M.mipmaps,B&&he){if(ye.length>0)ue++;let ie=yt(de[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,ue,Ke,ie.width,ie.height)}for(let ie=0;ie<6;ie++)if(Ee){if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,0,0,0,de[ie].width,de[ie].height,Ce,De,de[ie].data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,0,Ke,de[ie].width,de[ie].height,0,Ce,De,de[ie].data);for(let me=0;me<ye.length;me++){let ft=ye[me].image[ie].image;if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,me+1,0,0,ft.width,ft.height,Ce,De,ft.data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,me+1,Ke,ft.width,ft.height,0,Ce,De,ft.data)}}else{if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,0,0,0,Ce,De,de[ie])}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,0,Ke,Ce,De,de[ie]);for(let me=0;me<ye.length;me++){let ke=ye[me];if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,me+1,0,0,Ce,De,ke.image[ie])}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ie,me+1,Ke,Ce,De,ke.image[ie])}}}if(p(M))x(e.TEXTURE_CUBE_MAP);if(ce.__version=re.version,M.onUpdate)M.onUpdate(M)}C.__version=M.version}function Ae(C,M,O,q,re,ce){let fe=s.convert(O.format,O.colorSpace),Z=s.convert(O.type),K=v(O.internalFormat,fe,Z,O.normalized,O.colorSpace),ve=i.get(M),Ee=i.get(O);if(Ee.__renderTarget=M,!ve.__hasExternalTextures){let de=Math.max(1,M.width>>ce),ae=Math.max(1,M.height>>ce);if(re===e.TEXTURE_3D||re===e.TEXTURE_2D_ARRAY)n.texImage3D(re,ce,K,de,ae,M.depth,0,fe,Z,null);else n.texImage2D(re,ce,K,de,ae,0,fe,Z,null)}if(n.bindFramebuffer(e.FRAMEBUFFER,C),U(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,q,re,Ee.__webglTexture,0,Pt(M));else if(re===e.TEXTURE_2D||re>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&re<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)e.framebufferTexture2D(e.FRAMEBUFFER,q,re,Ee.__webglTexture,ce);n.bindFramebuffer(e.FRAMEBUFFER,null)}function Ct(C,M,O){if(e.bindRenderbuffer(e.RENDERBUFFER,C),M.depthBuffer){let q=M.depthTexture,re=q&&q.isDepthTexture?q.type:null,ce=b(M.stencilBuffer,re),fe=M.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(U(M))a.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Pt(M),ce,M.width,M.height);else if(O)e.renderbufferStorageMultisample(e.RENDERBUFFER,Pt(M),ce,M.width,M.height);else e.renderbufferStorage(e.RENDERBUFFER,ce,M.width,M.height);e.framebufferRenderbuffer(e.FRAMEBUFFER,fe,e.RENDERBUFFER,C)}else{let q=M.textures;for(let re=0;re<q.length;re++){let ce=q[re],fe=s.convert(ce.format,ce.colorSpace),Z=s.convert(ce.type),K=v(ce.internalFormat,fe,Z,ce.normalized,ce.colorSpace);if(U(M))a.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Pt(M),K,M.width,M.height);else if(O)e.renderbufferStorageMultisample(e.RENDERBUFFER,Pt(M),K,M.width,M.height);else e.renderbufferStorage(e.RENDERBUFFER,K,M.width,M.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function qe(C,M,O){let q=M.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,C),!(M.depthTexture&&M.depthTexture.isDepthTexture))throw Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let re=i.get(M.depthTexture);if(re.__renderTarget=M,!re.__webglTexture||M.depthTexture.image.width!==M.width||M.depthTexture.image.height!==M.height)M.depthTexture.image.width=M.width,M.depthTexture.image.height=M.height,M.depthTexture.needsUpdate=!0;if(q){if(re.__webglInit===void 0)re.__webglInit=!0,M.depthTexture.addEventListener("dispose",E);if(re.__webglTexture===void 0){re.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,re.__webglTexture),Re(e.TEXTURE_CUBE_MAP,M.depthTexture);let ve=s.convert(M.depthTexture.format),Ee=s.convert(M.depthTexture.type),de;if(M.depthTexture.format===Vi)de=e.DEPTH_COMPONENT24;else if(M.depthTexture.format===Wi)de=e.DEPTH24_STENCIL8;for(let ae=0;ae<6;ae++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ae,0,de,M.width,M.height,0,ve,Ee,null)}}else te(M.depthTexture,0);let ce=re.__webglTexture,fe=Pt(M),Z=q?e.TEXTURE_CUBE_MAP_POSITIVE_X+O:e.TEXTURE_2D,K=M.depthTexture.format===Wi?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(M.depthTexture.format===Vi)if(U(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,K,Z,ce,0,fe);else e.framebufferTexture2D(e.FRAMEBUFFER,K,Z,ce,0);else if(M.depthTexture.format===Wi)if(U(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,K,Z,ce,0,fe);else e.framebufferTexture2D(e.FRAMEBUFFER,K,Z,ce,0);else throw Error("THREE.WebGLTextures: Unknown depthTexture format.")}function je(C){let M=i.get(C),O=C.isWebGLCubeRenderTarget===!0;if(M.__boundDepthTexture!==C.depthTexture){let q=C.depthTexture;if(M.__depthDisposeCallback)M.__depthDisposeCallback();if(q){let re=()=>{delete M.__boundDepthTexture,delete M.__depthDisposeCallback,q.removeEventListener("dispose",re)};q.addEventListener("dispose",re),M.__depthDisposeCallback=re}M.__boundDepthTexture=q}if(C.depthTexture&&!M.__autoAllocateDepthBuffer)if(O)for(let q=0;q<6;q++)qe(M.__webglFramebuffer[q],C,q);else{let q=C.texture.mipmaps;if(q&&q.length>0)qe(M.__webglFramebuffer[0],C,0);else qe(M.__webglFramebuffer,C,0)}else if(O){M.__webglDepthbuffer=[];for(let q=0;q<6;q++)if(n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer[q]),M.__webglDepthbuffer[q]===void 0)M.__webglDepthbuffer[q]=e.createRenderbuffer(),Ct(M.__webglDepthbuffer[q],C,!1);else{let re=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ce=M.__webglDepthbuffer[q];e.bindRenderbuffer(e.RENDERBUFFER,ce),e.framebufferRenderbuffer(e.FRAMEBUFFER,re,e.RENDERBUFFER,ce)}}else{let q=C.texture.mipmaps;if(q&&q.length>0)n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer[0]);else n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer);if(M.__webglDepthbuffer===void 0)M.__webglDepthbuffer=e.createRenderbuffer(),Ct(M.__webglDepthbuffer,C,!1);else{let re=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ce=M.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,ce),e.framebufferRenderbuffer(e.FRAMEBUFFER,re,e.RENDERBUFFER,ce)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function st(C,M,O){let q=i.get(C);if(M!==void 0)Ae(q.__webglFramebuffer,C,C.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0);if(O!==void 0)je(C)}function Ye(C){let M=C.texture,O=i.get(C),q=i.get(M);C.addEventListener("dispose",y);let re=C.textures,ce=C.isWebGLCubeRenderTarget===!0,fe=re.length>1;if(!fe){if(q.__webglTexture===void 0)q.__webglTexture=e.createTexture();q.__version=M.version,o.memory.textures++}if(ce){O.__webglFramebuffer=[];for(let Z=0;Z<6;Z++)if(M.mipmaps&&M.mipmaps.length>0){O.__webglFramebuffer[Z]=[];for(let K=0;K<M.mipmaps.length;K++)O.__webglFramebuffer[Z][K]=e.createFramebuffer()}else O.__webglFramebuffer[Z]=e.createFramebuffer()}else{if(M.mipmaps&&M.mipmaps.length>0){O.__webglFramebuffer=[];for(let Z=0;Z<M.mipmaps.length;Z++)O.__webglFramebuffer[Z]=e.createFramebuffer()}else O.__webglFramebuffer=e.createFramebuffer();if(fe)for(let Z=0,K=re.length;Z<K;Z++){let ve=i.get(re[Z]);if(ve.__webglTexture===void 0)ve.__webglTexture=e.createTexture(),o.memory.textures++}if(C.samples>0&&U(C)===!1){O.__webglMultisampledFramebuffer=e.createFramebuffer(),O.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,O.__webglMultisampledFramebuffer);for(let Z=0;Z<re.length;Z++){let K=re[Z];O.__webglColorRenderbuffer[Z]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,O.__webglColorRenderbuffer[Z]);let ve=s.convert(K.format,K.colorSpace),Ee=s.convert(K.type),de=v(K.internalFormat,ve,Ee,K.normalized,K.colorSpace,C.isXRRenderTarget===!0),ae=Pt(C);e.renderbufferStorageMultisample(e.RENDERBUFFER,ae,de,C.width,C.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+Z,e.RENDERBUFFER,O.__webglColorRenderbuffer[Z])}if(e.bindRenderbuffer(e.RENDERBUFFER,null),C.depthBuffer)O.__webglDepthRenderbuffer=e.createRenderbuffer(),Ct(O.__webglDepthRenderbuffer,C,!0);n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(ce){n.bindTexture(e.TEXTURE_CUBE_MAP,q.__webglTexture),Re(e.TEXTURE_CUBE_MAP,M);for(let Z=0;Z<6;Z++)if(M.mipmaps&&M.mipmaps.length>0)for(let K=0;K<M.mipmaps.length;K++)Ae(O.__webglFramebuffer[Z][K],C,M,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,K);else Ae(O.__webglFramebuffer[Z],C,M,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0);if(p(M))x(e.TEXTURE_CUBE_MAP);n.unbindTexture()}else if(fe){for(let Z=0,K=re.length;Z<K;Z++){let ve=re[Z],Ee=i.get(ve),de=e.TEXTURE_2D;if(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)de=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY;if(n.bindTexture(de,Ee.__webglTexture),Re(de,ve),Ae(O.__webglFramebuffer,C,ve,e.COLOR_ATTACHMENT0+Z,de,0),p(ve))x(de)}n.unbindTexture()}else{let Z=e.TEXTURE_2D;if(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)Z=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY;if(n.bindTexture(Z,q.__webglTexture),Re(Z,M),M.mipmaps&&M.mipmaps.length>0)for(let K=0;K<M.mipmaps.length;K++)Ae(O.__webglFramebuffer[K],C,M,e.COLOR_ATTACHMENT0,Z,K);else Ae(O.__webglFramebuffer,C,M,e.COLOR_ATTACHMENT0,Z,0);if(p(M))x(Z);n.unbindTexture()}if(C.depthBuffer)je(C)}function kt(C){let M=C.textures;for(let O=0,q=M.length;O<q;O++){let re=M[O];if(p(re)){let ce=S(C),fe=i.get(re).__webglTexture;n.bindTexture(ce,fe),x(ce),n.unbindTexture()}}}let pt=[],nn=[];function Rt(C){if(C.samples>0){if(U(C)===!1){let{textures:M,width:O,height:q}=C,re=e.COLOR_BUFFER_BIT,ce=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,fe=i.get(C),Z=M.length>1;if(Z)for(let ve=0;ve<M.length;ve++)n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,fe.__webglMultisampledFramebuffer);let K=C.texture.mipmaps;if(K&&K.length>0)n.bindFramebuffer(e.DRAW_FRAMEBUFFER,fe.__webglFramebuffer[0]);else n.bindFramebuffer(e.DRAW_FRAMEBUFFER,fe.__webglFramebuffer);for(let ve=0;ve<M.length;ve++){if(C.resolveDepthBuffer){if(C.depthBuffer)re|=e.DEPTH_BUFFER_BIT;if(C.stencilBuffer&&C.resolveStencilBuffer)re|=e.STENCIL_BUFFER_BIT}if(Z){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,fe.__webglColorRenderbuffer[ve]);let Ee=i.get(M[ve]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,Ee,0)}if(e.blitFramebuffer(0,0,O,q,0,0,O,q,re,e.NEAREST),l===!0){if(pt.length=0,nn.length=0,pt.push(e.COLOR_ATTACHMENT0+ve),C.depthBuffer&&C.storeMultisampledDepthBuffer===!1)pt.push(ce),nn.push(ce),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,nn);e.invalidateFramebuffer(e.READ_FRAMEBUFFER,pt)}}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),Z)for(let ve=0;ve<M.length;ve++){n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.RENDERBUFFER,fe.__webglColorRenderbuffer[ve]);let Ee=i.get(M[ve]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.TEXTURE_2D,Ee,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,fe.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.storeMultisampledDepthBuffer===!1&&l){let M=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[M])}}}function Pt(C){return Math.min(r.maxSamples,C.samples)}function U(C){let M=i.get(C);return C.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&M.__useRenderToTexture!==!1}function rn(C){let M=o.render.frame;if(u.get(C)!==M)u.set(C,M),C.update()}function tt(C,M){let{colorSpace:O,format:q,type:re}=C;if(C.isCompressedTexture===!0||C.isVideoTexture===!0)return M;if(O!==th&&O!==qi)if(We.getTransfer(O)===lt){if(q!==Hn||re!==In)Ie("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.")}else Ne("WebGLTextures: Unsupported texture color space:",O);return M}function yt(C){if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement)c.width=C.naturalWidth||C.width,c.height=C.naturalHeight||C.height;else if(typeof VideoFrame<"u"&&C instanceof VideoFrame)c.width=C.displayWidth,c.height=C.displayHeight;else c.width=C.width,c.height=C.height;return c}this.allocateTextureUnit=k,this.resetTextureUnits=W,this.getTextureUnits=R,this.setTextureUnits=I,this.setTexture2D=te,this.setTexture2DArray=Y,this.setTexture3D=Q,this.setTextureCube=G,this.rebindTextures=st,this.setupRenderTarget=Ye,this.updateRenderTargetMipmap=kt,this.updateMultisampleRenderTarget=Rt,this.setupDepthRenderbuffer=je,this.setupFrameBufferTexture=Ae,this.useMultisampledRTT=U,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function cw(e,t){function n(i,r=qi){let s,o=We.getTransfer(r);if(i===In)return e.UNSIGNED_BYTE;if(i===yc)return e.UNSIGNED_SHORT_4_4_4_4;if(i===xc)return e.UNSIGNED_SHORT_5_5_5_1;if(i===_m)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===vm)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===mm)return e.BYTE;if(i===gm)return e.SHORT;if(i===Ls)return e.UNSIGNED_SHORT;if(i===vc)return e.INT;if(i===xi)return e.UNSIGNED_INT;if(i===ri)return e.FLOAT;if(i===jt)return e.HALF_FLOAT;if(i===ym)return e.ALPHA;if(i===xm)return e.RGB;if(i===Hn)return e.RGBA;if(i===Vi)return e.DEPTH_COMPONENT;if(i===Wi)return e.DEPTH_STENCIL;if(i===bm)return e.RED;if(i===bc)return e.RED_INTEGER;if(i===Xi)return e.RG;if(i===Sc)return e.RG_INTEGER;if(i===Mc)return e.RGBA_INTEGER;if(i===ua||i===fa||i===da||i===pa)if(o===lt)if(s=t.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===ua)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===fa)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===da)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===pa)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=t.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===ua)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===fa)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===da)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===pa)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===wc||i===Tc||i===Ec||i===Ac)if(s=t.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===wc)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Tc)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Ec)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Ac)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Cc||i===Rc||i===Pc||i===Ic||i===Lc||i===ma||i===Dc)if(s=t.get("WEBGL_compressed_texture_etc"),s!==null){if(i===Cc||i===Rc)return o===lt?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===Pc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(i===Ic)return s.COMPRESSED_R11_EAC;if(i===Lc)return s.COMPRESSED_SIGNED_R11_EAC;if(i===ma)return s.COMPRESSED_RG11_EAC;if(i===Dc)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Nc||i===Oc||i===Uc||i===Fc||i===Bc||i===kc||i===zc||i===Gc||i===Hc||i===Vc||i===Wc||i===Xc||i===qc||i===jc)if(s=t.get("WEBGL_compressed_texture_astc"),s!==null){if(i===Nc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Oc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Uc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Fc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Bc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===kc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===zc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Gc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Hc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Vc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Wc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Xc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===qc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===jc)return o===lt?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Yc||i===$c||i===Zc)if(s=t.get("EXT_texture_compression_bptc"),s!==null){if(i===Yc)return o===lt?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===$c)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Zc)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Jc||i===Kc||i===ga||i===Qc)if(s=t.get("EXT_texture_compression_rgtc"),s!==null){if(i===Jc)return s.COMPRESSED_RED_RGTC1_EXT;if(i===Kc)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===ga)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Qc)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;if(i===Gr)return e.UNSIGNED_INT_24_8;return e[i]!==void 0?e[i]:null}return{convert:n}}var hw=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,uw=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class vg{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new wa(e.texture);if(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)this.depthNear=e.depthNear,this.depthFar=e.depthFar;this.texture=n}}getMesh(e){if(this.texture!==null){if(this.mesh===null){let t=e.cameras[0].viewport,n=new At({vertexShader:hw,fragmentShader:uw,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Bt(new Hs(20,20),n)}}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class yg extends Vn{constructor(e,t){super();let n=this,i=null,r=1,s=null,o="local-floor",a=1,l=null,c=null,u=null,f=null,h=null,d=null,g=typeof XRWebGLBinding<"u",_=new vg,m={},p=t.getContextAttributes(),x=null,S=null,v=[],b=[],w=new ne,E=null,y=null,A=new zt;A.viewport=new gt;let N=new zt;N.viewport=new gt;let P=[A,N],D=new Bh,W=null,R=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(X){let se=v[X];if(se===void 0)se=new Os,v[X]=se;return se.getTargetRaySpace()},this.getControllerGrip=function(X){let se=v[X];if(se===void 0)se=new Os,v[X]=se;return se.getGripSpace()},this.getHand=function(X){let se=v[X];if(se===void 0)se=new Os,v[X]=se;return se.getHandSpace()};function I(X){let se=b.indexOf(X.inputSource);if(se===-1)return;let le=v[se];if(le!==void 0)le.update(X.inputSource,X.frame,l||s),le.dispatchEvent({type:X.type,data:X.inputSource})}function k(){i.removeEventListener("select",I),i.removeEventListener("selectstart",I),i.removeEventListener("selectend",I),i.removeEventListener("squeeze",I),i.removeEventListener("squeezestart",I),i.removeEventListener("squeezeend",I),i.removeEventListener("end",k),i.removeEventListener("inputsourceschange",z);for(let X=0;X<v.length;X++){let se=b[X];if(se===null)continue;b[X]=null,v[X].disconnect(se)}W=null,R=null,_.reset();for(let X in m)delete m[X];if(e.setRenderTarget(x),h=null,f=null,u=null,i=null,S=null,Re.stop(),n.isPresenting=!1,e.setPixelRatio(E),e.setSize(w.width,w.height,!1),y!==null){let X=y.camera;X.fov=y.fov,X.zoom=y.zoom,X.updateProjectionMatrix(),y=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(X){if(r=X,n.isPresenting===!0)Ie("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(X){if(o=X,n.isPresenting===!0)Ie("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||s},this.setReferenceSpace=function(X){l=X},this.getBaseLayer=function(){return f!==null?f:h},this.getBinding=function(){if(u===null&&g)u=new XRWebGLBinding(i,t);return u},this.getFrame=function(){return d},this.getSession=function(){return i},this.setSession=async function(X){if(i=X,i!==null){if(x=e.getRenderTarget(),i.addEventListener("select",I),i.addEventListener("selectstart",I),i.addEventListener("selectend",I),i.addEventListener("squeeze",I),i.addEventListener("squeezestart",I),i.addEventListener("squeezeend",I),i.addEventListener("end",k),i.addEventListener("inputsourceschange",z),p.xrCompatible!==!0)await t.makeXRCompatible();if(E=e.getPixelRatio(),e.getSize(w),!(g&&("createProjectionLayer"in XRWebGLBinding.prototype))){let le={antialias:p.antialias,alpha:!0,depth:p.depth,stencil:p.stencil,framebufferScaleFactor:r};h=new XRWebGLLayer(i,t,le),i.updateRenderState({baseLayer:h}),e.setPixelRatio(1),e.setSize(h.framebufferWidth,h.framebufferHeight,!1),S=new It(h.framebufferWidth,h.framebufferHeight,{format:Hn,type:In,colorSpace:e.outputColorSpace,stencilBuffer:p.stencil,resolveDepthBuffer:h.ignoreDepthValues===!1,resolveStencilBuffer:h.ignoreDepthValues===!1,storeMultisampledDepthBuffer:h.ignoreDepthValues===!1,storeMultisampledStencilBuffer:h.ignoreDepthValues===!1})}else{let le=null,Pe=null,Ue=null;if(p.depth)Ue=p.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,le=p.stencil?Wi:Vi,Pe=p.stencil?Gr:xi;let Ae={colorFormat:t.RGBA8,depthFormat:Ue,scaleFactor:r};u=this.getBinding(),f=u.createProjectionLayer(Ae),i.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),S=new It(f.textureWidth,f.textureHeight,{format:Hn,type:In,depthTexture:new $i(f.textureWidth,f.textureHeight,Pe,void 0,void 0,void 0,void 0,void 0,void 0,le),stencilBuffer:p.stencil,colorSpace:e.outputColorSpace,samples:p.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(a),l=null,s=await i.requestReferenceSpace(o),Re.setContext(i),Re.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return _.getDepthTexture()};function z(X){for(let se=0;se<X.removed.length;se++){let le=X.removed[se],Pe=b.indexOf(le);if(Pe>=0)b[Pe]=null,v[Pe].disconnect(le)}for(let se=0;se<X.added.length;se++){let le=X.added[se],Pe=b.indexOf(le);if(Pe===-1){for(let Ae=0;Ae<v.length;Ae++)if(Ae>=b.length){b.push(le),Pe=Ae;break}else if(b[Ae]===null){b[Ae]=le,Pe=Ae;break}if(Pe===-1)break}let Ue=v[Pe];if(Ue)Ue.connect(le)}}let te=new L,Y=new L;function Q(X,se,le){te.setFromMatrixPosition(se.matrixWorld),Y.setFromMatrixPosition(le.matrixWorld);let Pe=te.distanceTo(Y),Ue=se.projectionMatrix.elements,Ae=le.projectionMatrix.elements,Ct=Ue[14]/(Ue[10]-1),qe=Ue[14]/(Ue[10]+1),je=(Ue[9]+1)/Ue[5],st=(Ue[9]-1)/Ue[5],Ye=(Ue[8]-1)/Ue[0],kt=(Ae[8]+1)/Ae[0],pt=Ct*Ye,nn=Ct*kt,Rt=Pe/(-Ye+kt),Pt=Rt*-Ye;if(se.matrixWorld.decompose(X.position,X.quaternion,X.scale),X.translateX(Pt),X.translateZ(Rt),X.matrixWorld.compose(X.position,X.quaternion,X.scale),X.matrixWorldInverse.copy(X.matrixWorld).invert(),Ue[10]===-1)X.projectionMatrix.copy(se.projectionMatrix),X.projectionMatrixInverse.copy(se.projectionMatrixInverse);else{let U=Ct+Rt,rn=qe+Rt,tt=pt-Pt,yt=nn+(Pe-Pt),C=je*qe/rn*U,M=st*qe/rn*U;X.projectionMatrix.makePerspective(tt,yt,C,M,U,rn),X.projectionMatrixInverse.copy(X.projectionMatrix).invert()}}function G(X,se){if(se===null)X.matrixWorld.copy(X.matrix);else X.matrixWorld.multiplyMatrices(se.matrixWorld,X.matrix);X.matrixWorldInverse.copy(X.matrixWorld).invert()}this.updateCamera=function(X){if(i===null)return;let{near:se,far:le}=X;if(_.texture!==null){if(_.depthNear>0)se=_.depthNear;if(_.depthFar>0)le=_.depthFar}if(D.near=N.near=A.near=se,D.far=N.far=A.far=le,W!==D.near||R!==D.far)i.updateRenderState({depthNear:D.near,depthFar:D.far}),W=D.near,R=D.far;D.layers.mask=X.layers.mask|6,A.layers.mask=D.layers.mask&-5,N.layers.mask=D.layers.mask&-3;let Pe=X.parent,Ue=D.cameras;G(D,Pe);for(let Ae=0;Ae<Ue.length;Ae++)G(Ue[Ae],Pe);if(Ue.length===2)Q(D,A,N);else D.projectionMatrix.copy(A.projectionMatrix);if(y===null&&X.isPerspectiveCamera)y={camera:X,fov:X.fov,zoom:X.zoom};ee(X,D,Pe)};function ee(X,se,le){if(le===null)X.matrix.copy(se.matrixWorld);else X.matrix.copy(le.matrixWorld),X.matrix.invert(),X.matrix.multiply(se.matrixWorld);if(X.matrix.decompose(X.position,X.quaternion,X.scale),X.updateMatrixWorld(!0),X.projectionMatrix.copy(se.projectionMatrix),X.projectionMatrixInverse.copy(se.projectionMatrixInverse),X.isPerspectiveCamera)X.fov=Nr*2*Math.atan(1/X.projectionMatrix.elements[5]),X.zoom=1}this.getCamera=function(){return D},this.getFoveation=function(){if(f===null&&h===null)return;return a},this.setFoveation=function(X){if(a=X,f!==null)f.fixedFoveation=X;if(h!==null&&h.fixedFoveation!==void 0)h.fixedFoveation=X},this.hasDepthSensing=function(){return _.texture!==null},this.getDepthSensingMesh=function(){return _.getMesh(D)},this.getCameraTexture=function(X){return m[X]};let oe=null;function Fe(X,se){if(c=se.getViewerPose(l||s),d=se,c!==null){let le=c.views;if(h!==null)e.setRenderTargetFramebuffer(S,h.framebuffer),e.setRenderTarget(S);let Pe=!1;if(le.length!==D.cameras.length)D.cameras.length=0,Pe=!0;for(let qe=0;qe<le.length;qe++){let je=le[qe],st=null;if(h!==null)st=h.getViewport(je);else{let kt=u.getViewSubImage(f,je);if(st=kt.viewport,qe===0)e.setRenderTargetTextures(S,kt.colorTexture,kt.depthStencilTexture),e.setRenderTarget(S)}let Ye=P[qe];if(Ye===void 0)Ye=new zt,Ye.layers.enable(qe),Ye.viewport=new gt,P[qe]=Ye;if(Ye.matrix.fromArray(je.transform.matrix),Ye.matrix.decompose(Ye.position,Ye.quaternion,Ye.scale),Ye.projectionMatrix.fromArray(je.projectionMatrix),Ye.projectionMatrixInverse.copy(Ye.projectionMatrix).invert(),Ye.viewport.set(st.x,st.y,st.width,st.height),qe===0)D.matrix.copy(Ye.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale);if(Pe===!0)D.cameras.push(Ye)}let Ue=i.enabledFeatures;if(Ue&&Ue.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&g){u=n.getBinding();let qe=u.getDepthInformation(le[0]);if(qe&&qe.isValid&&qe.texture)_.init(qe,i.renderState)}if(Ue&&Ue.includes("camera-access")&&g){e.state.unbindTexture(),u=n.getBinding();for(let qe=0;qe<le.length;qe++){let je=le[qe].camera;if(je){let st=m[je];if(!st)st=new wa,m[je]=st;let Ye=u.getCameraImage(je);st.sourceTexture=Ye}}}}for(let le=0;le<v.length;le++){let Pe=b[le],Ue=v[le];if(Pe!==null&&Ue!==void 0)Ue.update(Pe,se,l||s)}if(oe)oe(X,se);if(se.detectedPlanes)n.dispatchEvent({type:"planesdetected",data:se});d=null}let Re=new ag;Re.setAnimationLoop(Fe),this.setAnimationLoop=function(X){oe=X},this.dispose=function(){}}}var fw=new Je,xg=new Be;xg.set(-1,0,0,0,1,0,0,0,1);function dw(e,t){function n(m,p){if(m.matrixAutoUpdate===!0)m.updateMatrix();p.value.copy(m.matrix)}function i(m,p){if(p.color.getRGB(m.fogColor.value,Sh(e)),p.isFog)m.fogNear.value=p.near,m.fogFar.value=p.far;else if(p.isFogExp2)m.fogDensity.value=p.density}function r(m,p,x,S,v){if(p.isNodeMaterial)p.uniformsNeedUpdate=!1;else if(p.isMeshBasicMaterial)s(m,p);else if(p.isMeshLambertMaterial){if(s(m,p),p.envMap)m.envMapIntensity.value=p.envMapIntensity}else if(p.isMeshToonMaterial)s(m,p),f(m,p);else if(p.isMeshPhongMaterial){if(s(m,p),u(m,p),p.envMap)m.envMapIntensity.value=p.envMapIntensity}else if(p.isMeshStandardMaterial){if(s(m,p),h(m,p),p.isMeshPhysicalMaterial)d(m,p,v)}else if(p.isMeshMatcapMaterial)s(m,p),g(m,p);else if(p.isMeshDepthMaterial)s(m,p);else if(p.isMeshDistanceMaterial)s(m,p),_(m,p);else if(p.isMeshNormalMaterial)s(m,p);else if(p.isLineBasicMaterial){if(o(m,p),p.isLineDashedMaterial)a(m,p)}else if(p.isPointsMaterial)l(m,p,x,S);else if(p.isSpriteMaterial)c(m,p);else if(p.isShadowMaterial)m.color.value.copy(p.color),m.opacity.value=p.opacity;else if(p.isShaderMaterial)p.uniformsNeedUpdate=!1}function s(m,p){if(m.opacity.value=p.opacity,p.color)m.diffuse.value.copy(p.color);if(p.emissive)m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity);if(p.map)m.map.value=p.map,n(p.map,m.mapTransform);if(p.alphaMap)m.alphaMap.value=p.alphaMap,n(p.alphaMap,m.alphaMapTransform);if(p.bumpMap){if(m.bumpMap.value=p.bumpMap,n(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===qt)m.bumpScale.value*=-1}if(p.normalMap){if(m.normalMap.value=p.normalMap,n(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===qt)m.normalScale.value.negate()}if(p.displacementMap)m.displacementMap.value=p.displacementMap,n(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias;if(p.emissiveMap)m.emissiveMap.value=p.emissiveMap,n(p.emissiveMap,m.emissiveMapTransform);if(p.specularMap)m.specularMap.value=p.specularMap,n(p.specularMap,m.specularMapTransform);if(p.alphaTest>0)m.alphaTest.value=p.alphaTest;let x=t.get(p),{envMap:S,envMapRotation:v}=x;if(S){if(m.envMap.value=S,m.envMapRotation.value.setFromMatrix4(fw.makeRotationFromEuler(v)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1)m.envMapRotation.value.premultiply(xg);m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio}if(p.lightMap)m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,n(p.lightMap,m.lightMapTransform);if(p.aoMap)m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,n(p.aoMap,m.aoMapTransform)}function o(m,p){if(m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map)m.map.value=p.map,n(p.map,m.mapTransform)}function a(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,x,S){if(m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*x,m.scale.value=S*0.5,p.map)m.map.value=p.map,n(p.map,m.uvTransform);if(p.alphaMap)m.alphaMap.value=p.alphaMap,n(p.alphaMap,m.alphaMapTransform);if(p.alphaTest>0)m.alphaTest.value=p.alphaTest}function c(m,p){if(m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map)m.map.value=p.map,n(p.map,m.mapTransform);if(p.alphaMap)m.alphaMap.value=p.alphaMap,n(p.alphaMap,m.alphaMapTransform);if(p.alphaTest>0)m.alphaTest.value=p.alphaTest}function u(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,0.0001)}function f(m,p){if(p.gradientMap)m.gradientMap.value=p.gradientMap}function h(m,p){if(m.metalness.value=p.metalness,p.metalnessMap)m.metalnessMap.value=p.metalnessMap,n(p.metalnessMap,m.metalnessMapTransform);if(m.roughness.value=p.roughness,p.roughnessMap)m.roughnessMap.value=p.roughnessMap,n(p.roughnessMap,m.roughnessMapTransform);if(p.envMap)m.envMapIntensity.value=p.envMapIntensity}function d(m,p,x){if(m.ior.value=p.ior,p.sheen>0){if(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap)m.sheenColorMap.value=p.sheenColorMap,n(p.sheenColorMap,m.sheenColorMapTransform);if(p.sheenRoughnessMap)m.sheenRoughnessMap.value=p.sheenRoughnessMap,n(p.sheenRoughnessMap,m.sheenRoughnessMapTransform)}if(p.clearcoat>0){if(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap)m.clearcoatMap.value=p.clearcoatMap,n(p.clearcoatMap,m.clearcoatMapTransform);if(p.clearcoatRoughnessMap)m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,n(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform);if(p.clearcoatNormalMap){if(m.clearcoatNormalMap.value=p.clearcoatNormalMap,n(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===qt)m.clearcoatNormalScale.value.negate()}}if(p.dispersion>0)m.dispersion.value=p.dispersion;if(p.retroreflectivity>0)m.retroreflectivity.value=p.retroreflectivity;if(p.iridescence>0){if(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap)m.iridescenceMap.value=p.iridescenceMap,n(p.iridescenceMap,m.iridescenceMapTransform);if(p.iridescenceThicknessMap)m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,n(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform)}if(p.transmission>0){if(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=x.texture,m.transmissionSamplerSize.value.set(x.width,x.height),p.transmissionMap)m.transmissionMap.value=p.transmissionMap,n(p.transmissionMap,m.transmissionMapTransform);if(m.thickness.value=p.thickness,p.thicknessMap)m.thicknessMap.value=p.thicknessMap,n(p.thicknessMap,m.thicknessMapTransform);m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)}if(p.anisotropy>0){if(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap)m.anisotropyMap.value=p.anisotropyMap,n(p.anisotropyMap,m.anisotropyMapTransform)}if(m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap)m.specularColorMap.value=p.specularColorMap,n(p.specularColorMap,m.specularColorMapTransform);if(p.specularIntensityMap)m.specularIntensityMap.value=p.specularIntensityMap,n(p.specularIntensityMap,m.specularIntensityMapTransform)}function g(m,p){if(p.matcap)m.matcap.value=p.matcap}function _(m,p){let x=t.get(p).light;m.referencePosition.value.setFromMatrixPosition(x.matrixWorld),m.nearDistance.value=x.shadow.camera.near,m.farDistance.value=x.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function pw(e,t,n,i){let r={},s={},o=[],a=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function l(v,b){let w=b.program;i.uniformBlockBinding(v,w)}function c(v,b){let w=r[v.id];if(w===void 0)m(v),w=u(v),r[v.id]=w,v.addEventListener("dispose",x);let E=b.program;i.updateUBOMapping(v,E);let y=t.render.frame;if(s[v.id]!==y)h(v),s[v.id]=y}function u(v){let b=f();v.__bindingPointIndex=b;let w=e.createBuffer(),{__size:E,usage:y}=v;return e.bindBuffer(e.UNIFORM_BUFFER,w),e.bufferData(e.UNIFORM_BUFFER,E,y),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,b,w),w}function f(){for(let v=0;v<a;v++)if(o.indexOf(v)===-1)return o.push(v),v;return Ne("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function h(v){let b=r[v.id],{uniforms:w,__cache:E}=v;e.bindBuffer(e.UNIFORM_BUFFER,b);for(let y=0,A=w.length;y<A;y++){let N=w[y];if(Array.isArray(N))for(let P=0,D=N.length;P<D;P++)d(N[P],y,P,E);else d(N,y,0,E)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function d(v,b,w,E){if(_(v,b,w,E)===!0){let{__offset:y,value:A}=v;if(Array.isArray(A)){let N=0;for(let P=0;P<A.length;P++){let D=A[P],W=p(D);if(g(D,v.__data,N),typeof D!=="number"&&typeof D!=="boolean"&&!D.isMatrix3&&!ArrayBuffer.isView(D))N+=W.storage/Float32Array.BYTES_PER_ELEMENT}}else g(A,v.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,y,v.__data)}}function g(v,b,w){if(typeof v==="number"||typeof v==="boolean")b[0]=v;else if(v.isMatrix3)b[0]=v.elements[0],b[1]=v.elements[1],b[2]=v.elements[2],b[3]=0,b[4]=v.elements[3],b[5]=v.elements[4],b[6]=v.elements[5],b[7]=0,b[8]=v.elements[6],b[9]=v.elements[7],b[10]=v.elements[8],b[11]=0;else if(ArrayBuffer.isView(v))b.set(new v.constructor(v.buffer,v.byteOffset,b.length));else v.toArray(b,w)}function _(v,b,w,E){let y=v.value,A=b+"_"+w;if(E[A]===void 0){if(typeof y==="number"||typeof y==="boolean")E[A]=y;else if(ArrayBuffer.isView(y))E[A]=y.slice();else E[A]=y.clone();return!0}else{let N=E[A];if(typeof y==="number"||typeof y==="boolean"){if(N!==y)return E[A]=y,!0}else if(ArrayBuffer.isView(y))return!0;else if(N.equals(y)===!1)return N.copy(y),!0}return!1}function m(v){let b=v.uniforms,w=0,E=16;for(let A=0,N=b.length;A<N;A++){let P=Array.isArray(b[A])?b[A]:[b[A]];for(let D=0,W=P.length;D<W;D++){let R=P[D],I=Array.isArray(R.value)?R.value:[R.value];for(let k=0,z=I.length;k<z;k++){let te=I[k],Y=p(te),Q=w%E,G=Q%Y.boundary,ee=Q+G;if(w+=G,ee!==0&&E-ee<Y.storage)w+=E-ee;R.__data=new Float32Array(Y.storage/Float32Array.BYTES_PER_ELEMENT),R.__offset=w,w+=Y.storage}}}let y=w%E;if(y>0)w+=E-y;return v.__size=w,v.__cache={},this}function p(v){let b={boundary:0,storage:0};if(typeof v==="number"||typeof v==="boolean")b.boundary=4,b.storage=4;else if(v.isVector2)b.boundary=8,b.storage=8;else if(v.isVector3||v.isColor)b.boundary=16,b.storage=12;else if(v.isVector4)b.boundary=16,b.storage=16;else if(v.isMatrix3)b.boundary=48,b.storage=48;else if(v.isMatrix4)b.boundary=64,b.storage=64;else if(v.isTexture)Ie("WebGLRenderer: Texture samplers can not be part of an uniforms group.");else if(ArrayBuffer.isView(v))b.boundary=16,b.storage=v.byteLength;else Ie("WebGLRenderer: Unsupported uniform value type.",v);return b}function x(v){let b=v.target;b.removeEventListener("dispose",x);let w=o.indexOf(b.__bindingPointIndex);o.splice(w,1),e.deleteBuffer(r[b.id]),delete r[b.id],delete s[b.id]}function S(){for(let v in r)e.deleteBuffer(r[v]);o=[],r={},s={}}return{bind:l,update:c,dispose:S}}var mw=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Xn=null;function gw(){if(Xn===null)Xn=new hh(mw,16,16,Xi,jt),Xn.name="DFG_LUT",Xn.minFilter=an,Xn.magFilter=an,Xn.wrapS=ca,Xn.wrapT=ca,Xn.generateMipmaps=!1,Xn.needsUpdate=!0;return Xn}class Ba{constructor(e={}){let{canvas:t=Rm(),context:n=null,depth:i=!0,stencil:r=!1,alpha:s=!1,antialias:o=!1,premultipliedAlpha:a=!0,preserveDrawingBuffer:l=!1,powerPreference:c="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:f=!1,outputBufferType:h=In}=e;this.isWebGLRenderer=!0;let d;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");d=n.getContextAttributes().alpha}else d=s;let g=h,_=new Set([Mc,Sc,bc]),m=new Set([In,xi,Ls,Gr,yc,xc]),p=new Uint32Array(4),x=new Int32Array(4),S=new L,v=null,b=null,w=[],E=[],y=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Pn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let A=this,N=!1,P=null,D=null,W=null,R=null;this._outputColorSpace=ji;let I=0,k=0,z=null,te=-1,Y=null,Q=new gt,G=new gt,ee=null,oe=new Le(0),Fe=0,{width:Re,height:X}=t,se=1,le=null,Pe=null,Ue=new gt(0,0,Re,X),Ae=new gt(0,0,Re,X),Ct=!1,qe=new Bs,je=!1,st=!1,Ye=new Je,kt=new L,pt=new gt,nn={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Rt=!1;function Pt(){return z===null?se:1}let U=n;function rn(T,F){return t.getContext(T,F)}let tt,yt,C,M,O,q,re,ce,fe,Z,K,ve,Ee,de,ae,Ce,De,Ke,B,he,J,ue,ye;try{let T={alpha:!0,depth:i,stencil:r,antialias:o,premultipliedAlpha:a,preserveDrawingBuffer:l,powerPreference:c,failIfMajorPerformanceCaveat:u};if("setAttribute"in t)t.setAttribute("data-engine",`three.js r${oa}`);if(t.addEventListener("webglcontextlost",ke,!1),t.addEventListener("webglcontextrestored",ft,!1),t.addEventListener("webglcontextcreationerror",nt,!1),U===null){if(U=rn("webgl2",T),U===null)if(rn("webgl2"))throw Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.");else throw Error("THREE.WebGLRenderer: Error creating WebGL context.")}ie()}catch(T){throw t.removeEventListener("webglcontextlost",ke,!1),t.removeEventListener("webglcontextrestored",ft,!1),t.removeEventListener("webglcontextcreationerror",nt,!1),Ne("WebGLRenderer: "+T.message),T}function ie(){if(tt=new MS(U),tt.init(),J=new cw(U,tt),yt=new dS(U,tt,e,J),C=new aw(U,tt),yt.reversedDepthBuffer&&f)C.buffers.depth.setReversed(!0);D=U.createFramebuffer(),W=U.createFramebuffer(),R=U.createFramebuffer(),M=new ES(U),O=new jM,q=new lw(U,tt,C,O,yt,J,M),re=new SS(A),ce=new Cy(U),ue=new uS(U,ce),fe=new wS(U,ce,M,ue),Z=new CS(U,fe,ce,ue,M),Ke=new AS(U,yt,q),ae=new pS(O),K=new qM(A,re,tt,yt,ue,ae),ve=new dw(A,O),Ee=new $M,de=new tw(tt),De=new hS(A,re,C,Z,d,a),Ce=new ow(A,Z,yt),ye=new pw(U,M,yt,C),B=new fS(U,tt,M),he=new TS(U,tt,M),M.programs=K.programs,A.capabilities=yt,A.extensions=tt,A.properties=O,A.renderLists=Ee,A.shadowMap=Ce,A.state=C,A.info=M}if(g!==In)y=new PS(g,t.width,t.height,o,i,r);let me=new yg(A,U);this.xr=me,this.getContext=function(){return U},this.getContextAttributes=function(){return U.getContextAttributes()},this.forceContextLoss=function(){let T=tt.get("WEBGL_lose_context");if(T)T.loseContext()},this.forceContextRestore=function(){let T=tt.get("WEBGL_lose_context");if(T)T.restoreContext()},this.getPixelRatio=function(){return se},this.setPixelRatio=function(T){if(T===void 0)return;se=T,this.setSize(Re,X,!1)},this.getSize=function(T){return T.set(Re,X)},this.setSize=function(T,F,j=!0){if(me.isPresenting){Ie("WebGLRenderer: Can't change size while VR device is presenting.");return}if(Re=T,X=F,t.width=Math.floor(T*se),t.height=Math.floor(F*se),j===!0)t.style.width=T+"px",t.style.height=F+"px";if(y!==null)y.setSize(t.width,t.height);this.setViewport(0,0,T,F)},this.getDrawingBufferSize=function(T){return T.set(Re*se,X*se).floor()},this.setDrawingBufferSize=function(T,F,j){Re=T,X=F,se=j,t.width=Math.floor(T*j),t.height=Math.floor(F*j),this.setViewport(0,0,T,F)},this.setEffects=function(T){if(g===In){Ne("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(T){for(let F=0;F<T.length;F++)if(T[F].isOutputPass===!0){Ie("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}y.setEffects(T||[])},this.getCurrentViewport=function(T){return T.copy(Q)},this.getViewport=function(T){return T.copy(Ue)},this.setViewport=function(T,F,j,H){if(T.isVector4)Ue.set(T.x,T.y,T.z,T.w);else Ue.set(T,F,j,H);C.viewport(Q.copy(Ue).multiplyScalar(se).round())},this.getScissor=function(T){return T.copy(Ae)},this.setScissor=function(T,F,j,H){if(T.isVector4)Ae.set(T.x,T.y,T.z,T.w);else Ae.set(T,F,j,H);C.scissor(G.copy(Ae).multiplyScalar(se).round())},this.getScissorTest=function(){return Ct},this.setScissorTest=function(T){C.setScissorTest(Ct=T)},this.setOpaqueSort=function(T){le=T},this.setTransparentSort=function(T){Pe=T},this.getClearColor=function(T){return T.copy(De.getClearColor())},this.setClearColor=function(){De.setClearColor(...arguments)},this.getClearAlpha=function(){return De.getClearAlpha()},this.setClearAlpha=function(){De.setClearAlpha(...arguments)},this.clear=function(T=!0,F=!0,j=!0){let H=0;if(T){let V=!1;if(z!==null){let _e=z.texture.format;V=_.has(_e)}if(V){let _e=z.texture.type,be=m.has(_e),ge=De.getClearColor(),Se=De.getClearAlpha(),{r:we,g:Ge,b:Xe}=ge;if(be)p[0]=we,p[1]=Ge,p[2]=Xe,p[3]=Se,U.clearBufferuiv(U.COLOR,0,p);else x[0]=we,x[1]=Ge,x[2]=Xe,x[3]=Se,U.clearBufferiv(U.COLOR,0,x)}else H|=U.COLOR_BUFFER_BIT}if(F)H|=U.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0);if(j)H|=U.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295);if(H!==0)U.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(T){T.setRenderer(this),P=T},this.dispose=function(){t.removeEventListener("webglcontextlost",ke,!1),t.removeEventListener("webglcontextrestored",ft,!1),t.removeEventListener("webglcontextcreationerror",nt,!1),De.dispose(),Ee.dispose(),de.dispose(),O.dispose(),re.dispose(),Z.dispose(),ue.dispose(),ye.dispose(),K.dispose(),me.dispose(),me.removeEventListener("sessionstart",Hd),me.removeEventListener("sessionend",Vd),Oi.stop()};function ke(T){T.preventDefault(),xs("WebGLRenderer: Context Lost."),N=!0}function ft(){xs("WebGLRenderer: Context Restored."),N=!1;let T=M.autoReset,F=Ce.enabled,j=Ce.autoUpdate,H=Ce.needsUpdate,V=Ce.type;ie(),M.autoReset=T,Ce.enabled=F,Ce.autoUpdate=j,Ce.needsUpdate=H,Ce.type=V}function nt(T){Ne("WebGLRenderer: A WebGL context could not be created. Reason: ",T.statusMessage)}function Fn(T){let F=T.target;F.removeEventListener("dispose",Fn),Zn(F)}function Zn(T){hv(T),O.remove(T)}function hv(T){let F=O.get(T).programs;if(F!==void 0){if(F.forEach(function(j){K.releaseProgram(j)}),T.isShaderMaterial)K.releaseShaderCache(T)}}this.renderBufferDirect=function(T,F,j,H,V,_e){if(F===null)F=nn;let be=V.isMesh&&V.matrixWorld.determinantAffine()<0,ge=dv(T,F,j,H,V);C.setMaterial(H,be);let Se=j.index,we=1;if(H.wireframe===!0){if(Se=fe.getWireframeAttribute(j),Se===void 0)return;we=2}let Ge=j.drawRange,Xe=j.attributes.position,Me=Ge.start*we,it=(Ge.start+Ge.count)*we;if(_e!==null)Me=Math.max(Me,_e.start*we),it=Math.min(it,(_e.start+_e.count)*we);if(Se!==null)Me=Math.max(Me,0),it=Math.min(it,Se.count);else if(Xe!==void 0&&Xe!==null)Me=Math.max(Me,0),it=Math.min(it,Xe.count);let wt=it-Me;if(wt<0||wt===1/0)return;ue.setup(V,H,ge,j,Se);let mt,ut=B;if(Se!==null)mt=ce.get(Se),ut=he,ut.setIndex(mt);if(V.isMesh)if(H.wireframe===!0)C.setLineWidth(H.wireframeLinewidth*Pt()),ut.setMode(U.LINES);else ut.setMode(U.TRIANGLES);else if(V.isLine){let Vt=H.linewidth;if(Vt===void 0)Vt=1;if(C.setLineWidth(Vt*Pt()),V.isLineSegments)ut.setMode(U.LINES);else if(V.isLineLoop)ut.setMode(U.LINE_LOOP);else ut.setMode(U.LINE_STRIP)}else if(V.isPoints)ut.setMode(U.POINTS);else if(V.isSprite)ut.setMode(U.TRIANGLES);if(V.isBatchedMesh)if(!tt.get("WEBGL_multi_draw")){let{_multiDrawStarts:Vt,_multiDrawCounts:xe,_multiDrawCount:Jt}=V,Ze=Se?ce.get(Se).bytesPerElement:1,vn=O.get(H).currentProgram.getUniforms();for(let Bn=0;Bn<Jt;Bn++)vn.setValue(U,"_gl_DrawID",Bn),ut.render(Vt[Bn]/Ze,xe[Bn])}else ut.renderMultiDraw(V._multiDrawStarts,V._multiDrawCounts,V._multiDrawCount);else if(V.isInstancedMesh)ut.renderInstances(Me,wt,V.count);else if(j.isInstancedBufferGeometry){let Vt=j._maxInstanceCount!==void 0?j._maxInstanceCount:1/0,xe=Math.min(j.instanceCount,Vt);ut.renderInstances(Me,wt,xe)}else ut.render(Me,wt)};function Gd(T,F,j,H){if(P!==null&&T.isNodeMaterial)P.setObject(H,T);if(je===!0)ae.setState(T,j,!1);if(T.transparent===!0&&T.side===Rn&&T.forceSinglePass===!1)T.side=qt,T.needsUpdate=!0,Po(T,F,H),T.side=Ur,T.needsUpdate=!0,Po(T,F,H),T.side=Rn;else Po(T,F,H)}this.compile=function(T,F,j=null){if(j===null)j=T;if(P!==null)P.renderStart(T,F,j);if(b=de.get(j),b.init(F),E.push(b),j.traverseVisible(function(V){if(V.isLight&&V.layers.test(F.layers)){if(b.pushLight(V),V.castShadow)b.pushShadow(V)}}),T!==j)T.traverseVisible(function(V){if(V.isLight&&V.layers.test(F.layers)){if(b.pushLight(V),V.castShadow)b.pushShadow(V)}});if(b.setupLights(),P!==null)P.updateLights(b.state.lightsArray);if(st=this.localClippingEnabled,je=ae.init(this.clippingPlanes,st),je===!0)ae.setGlobalState(this.clippingPlanes,F);if(P!==null)Ce.render(b.state.shadowsArray,j,F);let H=new Set;if(T.traverse(function(V){if(!(V.isMesh||V.isPoints||V.isLine||V.isSprite))return;let _e=V.material;if(_e)if(Array.isArray(_e))for(let be=0;be<_e.length;be++){let ge=_e[be];Gd(ge,j,F,V),H.add(ge)}else Gd(_e,j,F,V),H.add(_e)}),b=E.pop(),P!==null)P.renderEnd();return H},this.compileAsync=function(T,F,j=null){let H=this.compile(T,F,j);return new Promise((V)=>{function _e(){if(H.forEach(function(be){let Se=O.get(be).currentProgram;if(Se===void 0||Se.isReady())H.delete(be)}),H.size===0){V(T);return}setTimeout(_e,10)}if(tt.get("KHR_parallel_shader_compile")!==null)_e();else setTimeout(_e,10)})};let Bl=null;function uv(T){if(Bl)Bl(T)}function Hd(){Oi.stop()}function Vd(){Oi.start()}let Oi=new ag;if(Oi.setAnimationLoop(uv),typeof self<"u")Oi.setContext(self);this.setAnimationLoop=function(T){Bl=T,me.setAnimationLoop(T),T===null?Oi.stop():Oi.start()},me.addEventListener("sessionstart",Hd),me.addEventListener("sessionend",Vd),this.render=function(T,F){if(F!==void 0&&F.isCamera!==!0){Ne("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(N===!0)return;if(P!==null)P.renderStart(T,F);let j=me.enabled===!0&&me.isPresenting===!0,H=y!==null&&(z===null||j)&&y.begin(A,z);if(T.matrixWorldAutoUpdate===!0)T.updateMatrixWorld();if(F.parent===null&&F.matrixWorldAutoUpdate===!0)F.updateMatrixWorld();if(me.enabled===!0&&me.isPresenting===!0&&(y===null||y.isCompositing()===!1)){if(me.cameraAutoUpdate===!0)me.updateCamera(F);F=me.getCamera()}if(T.isScene===!0)T.onBeforeRender(A,T,F,z);if(b=de.get(T,E.length),b.init(F),b.state.textureUnits=q.getTextureUnits(),E.push(b),Ye.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),qe.setFromProjectionMatrix(Ye,rh,F.reversedDepth),st=this.localClippingEnabled,je=ae.init(this.clippingPlanes,st),v=Ee.get(T,w.length),v.init(),w.push(v),me.enabled===!0&&me.isPresenting===!0){let be=A.xr.getDepthSensingMesh();if(be!==null)kl(be,F,-1/0,A.sortObjects)}if(kl(T,F,0,A.sortObjects),v.finish(),P!==null)P.updateLights(b.state.lightsArray);if(A.sortObjects===!0)v.sort(le,Pe);if(Rt=me.enabled===!1||me.isPresenting===!1||me.hasDepthSensing()===!1,Rt)De.addToRenderList(v,T);if(this.info.render.frame++,this.info.autoReset===!0)this.info.reset();if(je===!0)ae.beginShadows();let V=b.state.shadowsArray;if(Ce.render(V,T,F),je===!0)ae.endShadows();if((H&&y.hasRenderPass())===!1){let be=v.opaque,ge=v.transmissive;if(b.setupLights(),F.isArrayCamera){let Se=F.cameras;if(ge.length>0)for(let we=0,Ge=Se.length;we<Ge;we++){let Xe=Se[we];Xd(be,ge,T,Xe)}if(Rt)De.render(T);for(let we=0,Ge=Se.length;we<Ge;we++){let Xe=Se[we];Wd(v,T,Xe,Xe.viewport)}}else{if(ge.length>0)Xd(be,ge,T,F);if(Rt)De.render(T);Wd(v,T,F)}}if(z!==null&&k===0)q.updateMultisampleRenderTarget(z),q.updateRenderTargetMipmap(z);if(H)y.end(A);if(T.isScene===!0)T.onAfterRender(A,T,F);if(ue.resetDefaultState(),te=-1,Y=null,E.pop(),E.length>0){if(b=E[E.length-1],q.setTextureUnits(b.state.textureUnits),je===!0)ae.setGlobalState(A.clippingPlanes,b.state.camera)}else b=null;if(w.pop(),w.length>0)v=w[w.length-1];else v=null;if(P!==null)P.renderEnd()};function kl(T,F,j,H){if(T.visible===!1)return;if(T.layers.test(F.layers)){if(T.isGroup)j=T.renderOrder;else if(T.isLOD){if(T.autoUpdate===!0)T.update(F)}else if(T.isLightProbeGrid)b.pushLightProbeGrid(T);else if(T.isLight){if(b.pushLight(T),T.castShadow)b.pushShadow(T)}else if(T.isSprite){if(!T.frustumCulled||T.intersectsFrustum(qe)){if(H)pt.setFromMatrixPosition(T.matrixWorld).applyMatrix4(Ye);let be=Z.update(T),ge=T.material;if(ge.visible)v.push(T,be,ge,j,pt.z,null,F)}}else if(T.isMesh||T.isLine||T.isPoints){if(!T.frustumCulled||T.intersectsFrustum(qe)){let be=Z.update(T),ge=T.material;if(H){if(T.boundingSphere!==void 0){if(T.boundingSphere===null)T.computeBoundingSphere();pt.copy(T.boundingSphere.center)}else{if(be.boundingSphere===null)be.computeBoundingSphere();pt.copy(be.boundingSphere.center)}pt.applyMatrix4(T.matrixWorld).applyMatrix4(Ye)}if(Array.isArray(ge)){let Se=be.groups;for(let we=0,Ge=Se.length;we<Ge;we++){let Xe=Se[we],Me=ge[Xe.materialIndex];if(Me&&Me.visible)v.push(T,be,Me,j,pt.z,Xe,F)}}else if(ge.visible)v.push(T,be,ge,j,pt.z,null,F)}}}let _e=T.children;for(let be=0,ge=_e.length;be<ge;be++)kl(_e[be],F,j,H)}function Wd(T,F,j,H){let{opaque:V,transmissive:_e,transparent:be}=T;if(b.setupLightsView(j),je===!0)ae.setGlobalState(A.clippingPlanes,j);if(H)C.viewport(Q.copy(H));if(V.length>0)Ro(V,F,j);if(_e.length>0)Ro(_e,F,j);if(be.length>0)Ro(be,F,j);C.buffers.depth.setTest(!0),C.buffers.depth.setMask(!0),C.buffers.color.setMask(!0),C.setPolygonOffset(!1)}function Xd(T,F,j,H){if((j.isScene===!0?j.overrideMaterial:null)!==null)return;if(b.state.transmissionRenderTarget[H.id]===void 0){let Me=tt.has("EXT_color_buffer_half_float")||tt.has("EXT_color_buffer_float");b.state.transmissionRenderTarget[H.id]=new It(1,1,{generateMipmaps:!0,type:Me?jt:In,minFilter:Hi,samples:Math.max(4,yt.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:We.workingColorSpace})}let _e=b.state.transmissionRenderTarget[H.id],be=H.viewport||Q;_e.setSize(be.z*A.transmissionResolutionScale,be.w*A.transmissionResolutionScale);let ge=A.getRenderTarget(),Se=A.getActiveCubeFace(),we=A.getActiveMipmapLevel();if(A.setRenderTarget(_e),A.getClearColor(oe),Fe=A.getClearAlpha(),Fe<1)A.setClearColor(16777215,0.5);if(A.clear(),Rt)De.render(j);let Ge=A.toneMapping;A.toneMapping=Pn;let Xe=H.viewport;if(H.viewport!==void 0)H.viewport=void 0;if(b.setupLightsView(H),je===!0)ae.setGlobalState(A.clippingPlanes,H);if(Ro(T,j,H),q.updateMultisampleRenderTarget(_e),q.updateRenderTargetMipmap(_e),tt.has("WEBGL_multisampled_render_to_texture")===!1){let Me=!1;for(let it=0,wt=F.length;it<wt;it++){let mt=F[it],{object:ut,geometry:Vt,material:xe,group:Jt}=mt;if(xe.side===Rn&&ut.layers.test(H.layers)){let Ze=xe.side;xe.side=qt,xe.needsUpdate=!0,qd(ut,j,H,Vt,xe,Jt),xe.side=Ze,xe.needsUpdate=!0,Me=!0}}if(Me===!0)q.updateMultisampleRenderTarget(_e),q.updateRenderTargetMipmap(_e)}if(A.setRenderTarget(ge,Se,we),A.setClearColor(oe,Fe),Xe!==void 0)H.viewport=Xe;A.toneMapping=Ge}function Ro(T,F,j){let H=F.isScene===!0?F.overrideMaterial:null;for(let V=0,_e=T.length;V<_e;V++){let be=T[V],{object:ge,geometry:Se,group:we}=be,Ge=be.material;if(Ge.allowOverride===!0&&H!==null)Ge=H;if(ge.layers.test(j.layers))qd(ge,F,j,Se,Ge,we)}}function qd(T,F,j,H,V,_e){if(P!==null&&V.isNodeMaterial)P.setObject(T,V);if(T.onBeforeRender(A,F,j,H,V,_e),T.modelViewMatrix.multiplyMatrices(j.matrixWorldInverse,T.matrixWorld),T.normalMatrix.getNormalMatrix(T.modelViewMatrix),V.onBeforeRender(A,F,j,H,T,_e),V.transparent===!0&&V.side===Rn&&V.forceSinglePass===!1)V.side=qt,V.needsUpdate=!0,A.renderBufferDirect(j,F,H,V,T,_e),V.side=Ur,V.needsUpdate=!0,A.renderBufferDirect(j,F,H,V,T,_e),V.side=Rn;else A.renderBufferDirect(j,F,H,V,T,_e);T.onAfterRender(A,F,j,H,V,_e)}function Po(T,F,j){if(F.isScene!==!0)F=nn;let H=O.get(T),V=b.state.lights,_e=b.state.shadowsArray,be=V.state.version,ge=K.getParameters(T,V.state,_e,F,j,b.state.lightProbeGridArray),Se=K.getProgramCacheKey(ge),we=H.programs;H.environment=T.isMeshStandardMaterial||T.isMeshLambertMaterial||T.isMeshPhongMaterial?F.environment:null,H.fog=F.fog;let Ge=T.isMeshStandardMaterial||T.isMeshLambertMaterial&&!T.envMap||T.isMeshPhongMaterial&&!T.envMap;if(H.envMap=re.get(T.envMap||H.environment,Ge),H.envMapRotation=H.environment!==null&&T.envMap===null?F.environmentRotation:T.envMapRotation,we===void 0)T.addEventListener("dispose",Fn),we=new Map,H.programs=we;let Xe=we.get(Se);if(Xe!==void 0){if(H.currentProgram===Xe&&H.lightsStateVersion===be)return Yd(T,ge),Xe}else{if(ge.uniforms=K.getUniforms(T),P!==null&&T.isNodeMaterial)P.build(T,j,ge);T.onBeforeCompile(ge,A),Xe=K.acquireProgram(ge,Se),we.set(Se,Xe),H.uniforms=ge.uniforms}let Me=H.uniforms;if(!T.isShaderMaterial&&!T.isRawShaderMaterial||T.clipping===!0)Me.clippingPlanes=ae.uniform;if(Yd(T,ge),H.needsLights=mv(T),H.lightsStateVersion=be,H.needsLights)Me.ambientLightColor.value=V.state.ambient,Me.lightProbe.value=V.state.probe,Me.sunLights.value=V.state.sun,Me.sunLightShadows.value=V.state.sunShadow,Me.directionalLights.value=V.state.directional,Me.directionalLightShadows.value=V.state.directionalShadow,Me.spotLights.value=V.state.spot,Me.spotLightShadows.value=V.state.spotShadow,Me.rectAreaLights.value=V.state.rectArea,Me.ltc_1.value=V.state.rectAreaLTC1,Me.ltc_2.value=V.state.rectAreaLTC2,Me.pointLights.value=V.state.point,Me.pointLightShadows.value=V.state.pointShadow,Me.hemisphereLights.value=V.state.hemi,Me.sunShadowMatrix.value=V.state.sunShadowMatrix,Me.sunShadowCascade.value=V.state.sunShadowCascade,Me.directionalShadowMatrix.value=V.state.directionalShadowMatrix,Me.spotLightMatrix.value=V.state.spotLightMatrix,Me.spotLightMap.value=V.state.spotLightMap,Me.pointShadowMatrix.value=V.state.pointShadowMatrix;return H.lightProbeGrid=b.state.lightProbeGridArray.length>0,H.currentProgram=Xe,H.uniformsList=null,Xe}function jd(T){if(T.uniformsList===null){let F=T.currentProgram.getUniforms();T.uniformsList=Ks.seqWithValue(F.seq,T.uniforms)}return T.uniformsList}function Yd(T,F){let j=O.get(T);j.outputColorSpace=F.outputColorSpace,j.batching=F.batching,j.batchingColor=F.batchingColor,j.instancing=F.instancing,j.instancingColor=F.instancingColor,j.instancingMorph=F.instancingMorph,j.skinning=F.skinning,j.morphTargets=F.morphTargets,j.morphNormals=F.morphNormals,j.morphColors=F.morphColors,j.morphTargetsCount=F.morphTargetsCount,j.numClippingPlanes=F.numClippingPlanes,j.numIntersection=F.numClipIntersection,j.vertexAlphas=F.vertexAlphas,j.vertexTangents=F.vertexTangents,j.toneMapping=F.toneMapping}function fv(T,F){if(T.length===0)return null;if(T.length===1)return T[0].texture!==null?T[0]:null;S.setFromMatrixPosition(F.matrixWorld);for(let j=0,H=T.length;j<H;j++){let V=T[j];if(V.texture!==null&&V.boundingBox.containsPoint(S))return V}return null}function dv(T,F,j,H,V){if(F.isScene!==!0)F=nn;q.resetTextureUnits();let _e=F.fog,be=H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial?F.environment:null,ge=z===null?A.outputColorSpace:z.isXRRenderTarget===!0?z.texture.colorSpace:We.workingColorSpace,Se=H.isMeshStandardMaterial||H.isMeshLambertMaterial&&!H.envMap||H.isMeshPhongMaterial&&!H.envMap,we=re.get(H.envMap||be,Se),Ge=H.vertexColors===!0&&!!j.attributes.color&&j.attributes.color.itemSize===4,Xe=!!j.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Me=!!j.morphAttributes.position,it=!!j.morphAttributes.normal,wt=!!j.morphAttributes.color,mt=Pn;if(H.toneMapped){if(z===null||z.isXRRenderTarget===!0)mt=A.toneMapping}let ut=j.morphAttributes.position||j.morphAttributes.normal||j.morphAttributes.color,Vt=ut!==void 0?ut.length:0,xe=O.get(H),Jt=b.state.lights;if(je===!0){if(st===!0||T!==Y){let dt=T===Y&&H.id===te;ae.setState(H,T,dt)}}let Ze=!1;if(H.version===xe.__version){if(xe.needsLights&&xe.lightsStateVersion!==Jt.state.version)Ze=!0;else if(xe.outputColorSpace!==ge)Ze=!0;else if(V.isBatchedMesh&&xe.batching===!1)Ze=!0;else if(!V.isBatchedMesh&&xe.batching===!0)Ze=!0;else if(V.isBatchedMesh&&xe.batchingColor===!0&&V._colorsTexture===null)Ze=!0;else if(V.isBatchedMesh&&xe.batchingColor===!1&&V._colorsTexture!==null)Ze=!0;else if(V.isInstancedMesh&&xe.instancing===!1)Ze=!0;else if(!V.isInstancedMesh&&xe.instancing===!0)Ze=!0;else if(V.isSkinnedMesh&&xe.skinning===!1)Ze=!0;else if(!V.isSkinnedMesh&&xe.skinning===!0)Ze=!0;else if(V.isInstancedMesh&&xe.instancingColor===!0&&V.instanceColor===null)Ze=!0;else if(V.isInstancedMesh&&xe.instancingColor===!1&&V.instanceColor!==null)Ze=!0;else if(V.isInstancedMesh&&xe.instancingMorph===!0&&V.morphTexture===null)Ze=!0;else if(V.isInstancedMesh&&xe.instancingMorph===!1&&V.morphTexture!==null)Ze=!0;else if(xe.envMap!==we)Ze=!0;else if(H.fog===!0&&xe.fog!==_e)Ze=!0;else if(xe.numClippingPlanes!==void 0&&(xe.numClippingPlanes!==ae.numPlanes||xe.numIntersection!==ae.numIntersection))Ze=!0;else if(xe.vertexAlphas!==Ge)Ze=!0;else if(xe.vertexTangents!==Xe)Ze=!0;else if(xe.morphTargets!==Me)Ze=!0;else if(xe.morphNormals!==it)Ze=!0;else if(xe.morphColors!==wt)Ze=!0;else if(xe.toneMapping!==mt)Ze=!0;else if(xe.morphTargetsCount!==Vt)Ze=!0;else if(!!xe.lightProbeGrid!==b.state.lightProbeGridArray.length>0)Ze=!0}else Ze=!0,xe.__version=H.version;let vn=xe.currentProgram;if(Ze===!0){if(vn=Po(H,F,V),P&&H.isNodeMaterial)P.onUpdateProgram(H,vn,xe)}let Bn=!1,ui=!1,ur=!1,ht=vn.getUniforms(),St=xe.uniforms;if(C.useProgram(vn.program))Bn=!0,ui=!0,ur=!0;if(H.id!==te)te=H.id,ui=!0;if(xe.needsLights){let dt=fv(b.state.lightProbeGridArray,V);if(xe.lightProbeGrid!==dt)xe.lightProbeGrid=dt,ui=!0}if(Bn||Y!==T){if(C.buffers.depth.getReversed()&&T.reversedDepth!==!0)T._reversedDepth=!0,T.updateProjectionMatrix();ht.setValue(U,"projectionMatrix",T.projectionMatrix),ht.setValue(U,"viewMatrix",T.matrixWorldInverse);let di=ht.map.cameraPosition;if(di!==void 0)di.setValue(U,kt.setFromMatrixPosition(T.matrixWorld));if(yt.logarithmicDepthBuffer)ht.setValue(U,"logDepthBufFC",2/(Math.log(T.far+1)/Math.LN2));if(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)ht.setValue(U,"isOrthographic",T.isOrthographicCamera===!0);if(Y!==T)Y=T,ui=!0,ur=!0}if(xe.needsLights){if(Jt.state.sunShadowMap.length>0)ht.setValue(U,"sunShadowMap",Jt.state.sunShadowMap,q);if(Jt.state.directionalShadowMap.length>0)ht.setValue(U,"directionalShadowMap",Jt.state.directionalShadowMap,q);if(Jt.state.spotShadowMap.length>0)ht.setValue(U,"spotShadowMap",Jt.state.spotShadowMap,q);if(Jt.state.pointShadowMap.length>0)ht.setValue(U,"pointShadowMap",Jt.state.pointShadowMap,q)}if(V.isSkinnedMesh){ht.setOptional(U,V,"bindMatrix"),ht.setOptional(U,V,"bindMatrixInverse");let dt=V.skeleton;if(dt){if(dt.boneTexture===null)dt.computeBoneTexture();ht.setValue(U,"boneTexture",dt.boneTexture,q)}}if(V.isBatchedMesh){if(ht.setOptional(U,V,"batchingTexture"),ht.setValue(U,"batchingTexture",V._matricesTexture,q),ht.setOptional(U,V,"batchingIdTexture"),ht.setValue(U,"batchingIdTexture",V._indirectTexture,q),ht.setOptional(U,V,"batchingColorTexture"),V._colorsTexture!==null)ht.setValue(U,"batchingColorTexture",V._colorsTexture,q)}let fi=j.morphAttributes;if(fi.position!==void 0||fi.normal!==void 0||fi.color!==void 0)Ke.update(V,j,vn);if(ui||xe.receiveShadow!==V.receiveShadow)xe.receiveShadow=V.receiveShadow,ht.setValue(U,"receiveShadow",V.receiveShadow);if((H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial)&&H.envMap===null&&F.environment!==null)St.envMapIntensity.value=F.environmentIntensity;if(St.dfgLUT!==void 0)St.dfgLUT.value=gw();if(ui){if(ht.setValue(U,"toneMappingExposure",A.toneMappingExposure),xe.needsLights)pv(St,ur);if(_e&&H.fog===!0)ve.refreshFogUniforms(St,_e);if(ve.refreshMaterialUniforms(St,H,se,X,b.state.transmissionRenderTarget[T.id]),xe.needsLights&&xe.lightProbeGrid){let dt=xe.lightProbeGrid;St.probesSH.value=dt.texture,St.probesMin.value.copy(dt.boundingBox.min),St.probesMax.value.copy(dt.boundingBox.max),St.probesResolution.value.copy(dt.resolution)}Ks.upload(U,jd(xe),St,q)}if(H.isShaderMaterial&&H.uniformsNeedUpdate===!0)Ks.upload(U,jd(xe),St,q),H.uniformsNeedUpdate=!1;if(H.isSpriteMaterial)ht.setValue(U,"center",V.center);if(ht.setValue(U,"modelViewMatrix",V.modelViewMatrix),ht.setValue(U,"normalMatrix",V.normalMatrix),ht.setValue(U,"modelMatrix",V.matrixWorld),H.uniformsGroups!==void 0){let dt=H.uniformsGroups;for(let di=0,fr=dt.length;di<fr;di++){let Zd=dt[di];ye.update(Zd,vn),ye.bind(Zd,vn)}}return vn}function pv(T,F){T.ambientLightColor.needsUpdate=F,T.lightProbe.needsUpdate=F,T.sunLights.needsUpdate=F,T.sunLightShadows.needsUpdate=F,T.directionalLights.needsUpdate=F,T.directionalLightShadows.needsUpdate=F,T.pointLights.needsUpdate=F,T.pointLightShadows.needsUpdate=F,T.spotLights.needsUpdate=F,T.spotLightShadows.needsUpdate=F,T.rectAreaLights.needsUpdate=F,T.hemisphereLights.needsUpdate=F}function mv(T){return T.isMeshLambertMaterial||T.isMeshToonMaterial||T.isMeshPhongMaterial||T.isMeshStandardMaterial||T.isShadowMaterial||T.isShaderMaterial&&T.lights===!0}this.getActiveCubeFace=function(){return I},this.getActiveMipmapLevel=function(){return k},this.getRenderTarget=function(){return z},this.setRenderTargetTextures=function(T,F,j){let H=O.get(T);if(H.__autoAllocateDepthBuffer=T.resolveDepthBuffer===!1,H.__autoAllocateDepthBuffer===!1)H.__useRenderToTexture=!1;O.get(T.texture).__webglTexture=F,O.get(T.depthTexture).__webglTexture=H.__autoAllocateDepthBuffer?void 0:j,H.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(T,F){let j=O.get(T);j.__webglFramebuffer=F,j.__useDefaultFramebuffer=F===void 0},this.setRenderTarget=function(T,F=0,j=0){z=T,I=F,k=j;let H=null,V=!1,_e=!1;if(T){let ge=O.get(T);if(ge.__useDefaultFramebuffer!==void 0){C.bindFramebuffer(U.FRAMEBUFFER,ge.__webglFramebuffer),Q.copy(T.viewport),G.copy(T.scissor),ee=T.scissorTest,C.viewport(Q),C.scissor(G),C.setScissorTest(ee),te=-1;return}else if(ge.__webglFramebuffer===void 0)q.setupRenderTarget(T);else if(ge.__hasExternalTextures)q.rebindTextures(T,O.get(T.texture).__webglTexture,O.get(T.depthTexture).__webglTexture);else if(T.depthBuffer){let Ge=T.depthTexture;if(ge.__boundDepthTexture!==Ge){if(Ge!==null&&O.has(Ge)&&(T.width!==Ge.image.width||T.height!==Ge.image.height))throw Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");q.setupDepthRenderbuffer(T)}}let Se=T.texture;if(Se.isData3DTexture||Se.isDataArrayTexture||Se.isCompressedArrayTexture)_e=!0;let we=O.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget){if(Array.isArray(we[F]))H=we[F][j];else H=we[F];V=!0}else if(T.samples>0&&q.useMultisampledRTT(T)===!1)H=O.get(T).__webglMultisampledFramebuffer;else if(Array.isArray(we))H=we[j];else H=we;Q.copy(T.viewport),G.copy(T.scissor),ee=T.scissorTest}else Q.copy(Ue).multiplyScalar(se).floor(),G.copy(Ae).multiplyScalar(se).floor(),ee=Ct;if(j!==0)H=D;if(C.bindFramebuffer(U.FRAMEBUFFER,H))C.drawBuffers(T,H);if(C.viewport(Q),C.scissor(G),C.setScissorTest(ee),V){let ge=O.get(T.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_CUBE_MAP_POSITIVE_X+F,ge.__webglTexture,j)}else if(_e){let ge=F;for(let Se=0;Se<T.textures.length;Se++){let we=O.get(T.textures[Se]);U.framebufferTextureLayer(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0+Se,we.__webglTexture,j,ge)}}else if(T!==null&&j!==0){let ge=O.get(T.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,ge.__webglTexture,j)}te=-1};function $d(T){let F=O.get(T);if(F.__readFormat!==T.format||F.__readType!==T.type)F.__readFormat=T.format,F.__readType=T.type,F.__formatReadable=yt.textureFormatReadable(T.format),F.__typeReadable=yt.textureTypeReadable(T.type);return F}if(this.readRenderTargetPixels=function(T,F,j,H,V,_e,be,ge=0){if(!(T&&T.isWebGLRenderTarget)){Ne("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Se=O.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&be!==void 0)Se=Se[be];if(Se){C.bindFramebuffer(U.FRAMEBUFFER,Se);try{let we=T.textures[ge],{format:Ge,type:Xe}=we;if(T.textures.length>1)U.readBuffer(U.COLOR_ATTACHMENT0+ge);let Me=$d(we);if(Me.__formatReadable===!1){Ne("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Me.__typeReadable===!1){Ne("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}if(F>=0&&F<=T.width-H&&(j>=0&&j<=T.height-V))U.readPixels(F,j,H,V,J.convert(Ge),J.convert(Xe),_e)}finally{let we=z!==null?O.get(z).__webglFramebuffer:null;C.bindFramebuffer(U.FRAMEBUFFER,we)}}},this.readRenderTargetPixelsAsync=async function(T,F,j,H,V,_e,be,ge=0){if(!(T&&T.isWebGLRenderTarget))throw Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Se=O.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&be!==void 0)Se=Se[be];if(Se)if(F>=0&&F<=T.width-H&&(j>=0&&j<=T.height-V)){C.bindFramebuffer(U.FRAMEBUFFER,Se);let we=T.textures[ge],{format:Ge,type:Xe}=we;if(T.textures.length>1)U.readBuffer(U.COLOR_ATTACHMENT0+ge);let Me=$d(we);if(Me.__formatReadable===!1)throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Me.__typeReadable===!1)throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let it=U.createBuffer();U.bindBuffer(U.PIXEL_PACK_BUFFER,it),U.bufferData(U.PIXEL_PACK_BUFFER,_e.byteLength,U.STREAM_READ),U.readPixels(F,j,H,V,J.convert(Ge),J.convert(Xe),0),U.bindBuffer(U.PIXEL_PACK_BUFFER,null);let wt=z!==null?O.get(z).__webglFramebuffer:null;C.bindFramebuffer(U.FRAMEBUFFER,wt);let mt=U.fenceSync(U.SYNC_GPU_COMMANDS_COMPLETE,0);return U.flush(),await Im(U,mt,4),U.bindBuffer(U.PIXEL_PACK_BUFFER,it),U.getBufferSubData(U.PIXEL_PACK_BUFFER,0,_e),U.bindBuffer(U.PIXEL_PACK_BUFFER,null),U.deleteBuffer(it),U.deleteSync(mt),_e}else throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(T,F=null,j=0){let H=Math.pow(2,-j),V=Math.floor(T.image.width*H),_e=Math.floor(T.image.height*H),be=F!==null?F.x:0,ge=F!==null?F.y:0;q.setTexture2D(T,0),U.copyTexSubImage2D(U.TEXTURE_2D,j,0,0,be,ge,V,_e),C.unbindTexture()},this.copyTextureToTexture=function(T,F,j=null,H=null,V=0,_e=0){let be,ge,Se,we,Ge,Xe,Me,it,wt,mt=T.isCompressedTexture?T.mipmaps[_e]:T.image;if(j!==null)be=j.max.x-j.min.x,ge=j.max.y-j.min.y,Se=j.isBox3?j.max.z-j.min.z:1,we=j.min.x,Ge=j.min.y,Xe=j.isBox3?j.min.z:0;else{let St=Math.pow(2,-V);if(be=Math.floor(mt.width*St),ge=Math.floor(mt.height*St),T.isDataArrayTexture)Se=mt.depth;else if(T.isData3DTexture)Se=Math.floor(mt.depth*St);else Se=1;we=0,Ge=0,Xe=0}if(H!==null)Me=H.x,it=H.y,wt=H.z;else Me=0,it=0,wt=0;let ut=J.convert(F.format),Vt=J.convert(F.type),xe;if(F.isData3DTexture)q.setTexture3D(F,0),xe=U.TEXTURE_3D;else if(F.isDataArrayTexture||F.isCompressedArrayTexture)q.setTexture2DArray(F,0),xe=U.TEXTURE_2D_ARRAY;else q.setTexture2D(F,0),xe=U.TEXTURE_2D;C.activeTexture(U.TEXTURE0),C.pixelStorei(U.UNPACK_FLIP_Y_WEBGL,F.flipY),C.pixelStorei(U.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),C.pixelStorei(U.UNPACK_ALIGNMENT,F.unpackAlignment);let Jt=C.getParameter(U.UNPACK_ROW_LENGTH),Ze=C.getParameter(U.UNPACK_IMAGE_HEIGHT),vn=C.getParameter(U.UNPACK_SKIP_PIXELS),Bn=C.getParameter(U.UNPACK_SKIP_ROWS),ui=C.getParameter(U.UNPACK_SKIP_IMAGES);C.pixelStorei(U.UNPACK_ROW_LENGTH,mt.width),C.pixelStorei(U.UNPACK_IMAGE_HEIGHT,mt.height),C.pixelStorei(U.UNPACK_SKIP_PIXELS,we),C.pixelStorei(U.UNPACK_SKIP_ROWS,Ge),C.pixelStorei(U.UNPACK_SKIP_IMAGES,Xe);let ur=T.isDataArrayTexture||T.isData3DTexture,ht=F.isDataArrayTexture||F.isData3DTexture;if(T.isDepthTexture){let St=O.get(T),fi=O.get(F),dt=O.get(St.__renderTarget),di=O.get(fi.__renderTarget);C.bindFramebuffer(U.READ_FRAMEBUFFER,dt.__webglFramebuffer),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,di.__webglFramebuffer);for(let fr=0;fr<Se;fr++){if(ur)U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,O.get(T).__webglTexture,V,Xe+fr),U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,O.get(F).__webglTexture,_e,wt+fr);U.blitFramebuffer(we,Ge,be,ge,Me,it,be,ge,U.DEPTH_BUFFER_BIT,U.NEAREST)}C.bindFramebuffer(U.READ_FRAMEBUFFER,null),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else if(V!==0||T.isRenderTargetTexture||O.has(T)){let St=O.get(T),fi=O.get(F);C.bindFramebuffer(U.READ_FRAMEBUFFER,W),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,R);for(let dt=0;dt<Se;dt++){if(ur)U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,St.__webglTexture,V,Xe+dt);else U.framebufferTexture2D(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,St.__webglTexture,V);if(ht)U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,fi.__webglTexture,_e,wt+dt);else U.framebufferTexture2D(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,fi.__webglTexture,_e);if(V!==0)U.blitFramebuffer(we,Ge,be,ge,Me,it,be,ge,U.COLOR_BUFFER_BIT,U.NEAREST);else if(ht)U.copyTexSubImage3D(xe,_e,Me,it,wt+dt,we,Ge,be,ge);else U.copyTexSubImage2D(xe,_e,Me,it,we,Ge,be,ge)}C.bindFramebuffer(U.READ_FRAMEBUFFER,null),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else if(ht)if(T.isDataTexture||T.isData3DTexture)U.texSubImage3D(xe,_e,Me,it,wt,be,ge,Se,ut,Vt,mt.data);else if(F.isCompressedArrayTexture)U.compressedTexSubImage3D(xe,_e,Me,it,wt,be,ge,Se,ut,mt.data);else U.texSubImage3D(xe,_e,Me,it,wt,be,ge,Se,ut,Vt,mt);else if(T.isDataTexture)U.texSubImage2D(U.TEXTURE_2D,_e,Me,it,be,ge,ut,Vt,mt.data);else if(T.isCompressedTexture)U.compressedTexSubImage2D(U.TEXTURE_2D,_e,Me,it,mt.width,mt.height,ut,mt.data);else U.texSubImage2D(U.TEXTURE_2D,_e,Me,it,be,ge,ut,Vt,mt);if(C.pixelStorei(U.UNPACK_ROW_LENGTH,Jt),C.pixelStorei(U.UNPACK_IMAGE_HEIGHT,Ze),C.pixelStorei(U.UNPACK_SKIP_PIXELS,vn),C.pixelStorei(U.UNPACK_SKIP_ROWS,Bn),C.pixelStorei(U.UNPACK_SKIP_IMAGES,ui),_e===0&&F.generateMipmaps)U.generateMipmap(xe);C.unbindTexture()},this.initRenderTarget=function(T){if(O.get(T).__webglFramebuffer===void 0)q.setupRenderTarget(T)},this.initTexture=function(T){if(T.isCubeTexture)q.setTextureCube(T,0);else if(T.isData3DTexture)q.setTexture3D(T,0);else if(T.isDataArrayTexture||T.isCompressedArrayTexture)q.setTexture2DArray(T,0);else q.setTexture2D(T,0);C.unbindTexture()},this.resetState=function(){I=0,k=0,z=null,C.reset(),ue.reset()},typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return rh}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=We._getDrawingBufferColorSpace(e),t.unpackColorSpace=We._getUnpackColorSpace()}}var Jr=new on,ai=new ne,bg=new L,Qh=new ne,ka=new ne,za=new L,eu=new L,Sg=new Je,Mg=new L,wg=new L,$t=null,jn=null,li=[],Mi={NONE:-1,PAN:0,ROTATE:1};class tu extends Wn{constructor(e,t,n=null){super(t,n);if(this.objects=e,this.recursive=!0,this.transformGroup=!1,this.rotateSpeed=1,this.raycaster=new ir,this.mouseButtons={LEFT:Mt.PAN,MIDDLE:Mt.PAN,RIGHT:Mt.ROTATE},this.touches={ONE:xn.PAN},this._onPointerMove=_w.bind(this),this._onPointerDown=vw.bind(this),this._onPointerCancel=yw.bind(this),this._onContextMenu=xw.bind(this),n!==null)this.connect(n)}connect(e){super.connect(e),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointerup",this._onPointerCancel),this.domElement.addEventListener("pointerleave",this._onPointerCancel),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointerup",this._onPointerCancel),this.domElement.removeEventListener("pointerleave",this._onPointerCancel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="",this.domElement.style.cursor=""}dispose(){this.disconnect()}_updatePointer(e){let t=this.domElement.getBoundingClientRect();ai.x=(e.clientX-t.left)/t.width*2-1,ai.y=-(e.clientY-t.top)/t.height*2+1}_updateState(e){let t;if(e.pointerType==="touch")t=this.touches.ONE;else switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=null}switch(t){case Mt.PAN:case xn.PAN:this.state=Mi.PAN;break;case Mt.ROTATE:case xn.ROTATE:this.state=Mi.ROTATE;break;default:this.state=Mi.NONE}}}function _w(e){let t=this.object,n=this.domElement,i=this.raycaster;if(this.enabled===!1)return;if(this._updatePointer(e),i.setFromCamera(ai,t),$t){if(this.state===Mi.PAN){if(i.ray.intersectPlane(Jr,za))$t.position.copy(za.sub(bg).applyMatrix4(Sg)),this.dispatchEvent({type:"drag",object:$t})}else if(this.state===Mi.ROTATE)Qh.subVectors(ai,ka).multiplyScalar(this.rotateSpeed),$t.rotateOnWorldAxis(Mg,Qh.x),$t.rotateOnWorldAxis(wg.normalize(),-Qh.y),this.dispatchEvent({type:"drag",object:$t});ka.copy(ai)}else if(e.pointerType==="mouse"||e.pointerType==="pen"){if(li.length=0,i.setFromCamera(ai,t),i.intersectObjects(this.objects,this.recursive,li),li.length>0){let r=li[0].object;if(Jr.setFromNormalAndCoplanarPoint(t.getWorldDirection(Jr.normal),eu.setFromMatrixPosition(r.matrixWorld)),jn!==r&&jn!==null)this.dispatchEvent({type:"hoveroff",object:jn}),n.style.cursor="auto",jn=null;if(jn!==r)this.dispatchEvent({type:"hoveron",object:r}),n.style.cursor="pointer",jn=r}else if(jn!==null)this.dispatchEvent({type:"hoveroff",object:jn}),n.style.cursor="auto",jn=null}ka.copy(ai)}function vw(e){let t=this.object,n=this.domElement,i=this.raycaster;if(this.enabled===!1)return;if(this._updatePointer(e),this._updateState(e),li.length=0,i.setFromCamera(ai,t),i.intersectObjects(this.objects,this.recursive,li),li.length>0){if(this.transformGroup===!0)$t=Tg(li[0].object);else $t=li[0].object;if(Jr.setFromNormalAndCoplanarPoint(t.getWorldDirection(Jr.normal),eu.setFromMatrixPosition($t.matrixWorld)),i.ray.intersectPlane(Jr,za)){if(this.state===Mi.PAN)Sg.copy($t.parent.matrixWorld).invert(),bg.copy(za).sub(eu.setFromMatrixPosition($t.matrixWorld)),n.style.cursor="move",this.dispatchEvent({type:"dragstart",object:$t});else if(this.state===Mi.ROTATE)Mg.set(0,1,0).applyQuaternion(t.quaternion).normalize(),wg.set(1,0,0).applyQuaternion(t.quaternion).normalize(),n.style.cursor="move",this.dispatchEvent({type:"dragstart",object:$t})}}ka.copy(ai)}function yw(){if(this.enabled===!1)return;if($t)this.dispatchEvent({type:"dragend",object:$t}),$t=null;this.domElement.style.cursor=jn?"pointer":"auto",this.state=Mi.NONE}function xw(e){if(this.enabled===!1)return;e.preventDefault()}function Tg(e,t=null){if(e.isGroup)t=e;if(e.parent===null)return t;return Tg(e.parent,t)}function Ga(e,t,n){var i,r=1;if(e==null)e=0;if(t==null)t=0;if(n==null)n=0;function s(){var o,a=i.length,l,c=0,u=0,f=0;for(o=0;o<a;++o)l=i[o],c+=l.x||0,u+=l.y||0,f+=l.z||0;for(c=(c/a-e)*r,u=(u/a-t)*r,f=(f/a-n)*r,o=0;o<a;++o){if(l=i[o],c)l.x-=c;if(u)l.y-=u;if(f)l.z-=f}}return s.initialize=function(o){i=o},s.x=function(o){return arguments.length?(e=+o,s):e},s.y=function(o){return arguments.length?(t=+o,s):t},s.z=function(o){return arguments.length?(n=+o,s):n},s.strength=function(o){return arguments.length?(r=+o,s):r},s}function pn(e){return function(){return e}}function Mn(e){return(e()-0.5)*0.000001}function bw(e){return e.index}function Eg(e,t){var n=e.get(t);if(!n)throw Error("node not found: "+t);return n}function Ha(e){var t=bw,n=h,i,r=pn(30),s,o,a,l,c,u,f=1;if(e==null)e=[];function h(p){return 1/Math.min(l[p.source.index],l[p.target.index])}function d(p){for(var x=0,S=e.length;x<f;++x)for(var v=0,b,w,E,y=0,A=0,N=0,P,D;v<S;++v){if(b=e[v],w=b.source,E=b.target,y=E.x+E.vx-w.x-w.vx||Mn(u),a>1)A=E.y+E.vy-w.y-w.vy||Mn(u);if(a>2)N=E.z+E.vz-w.z-w.vz||Mn(u);if(P=Math.sqrt(y*y+A*A+N*N),P=(P-s[v])/P*p*i[v],y*=P,A*=P,N*=P,E.vx-=y*(D=c[v]),a>1)E.vy-=A*D;if(a>2)E.vz-=N*D;if(w.vx+=y*(D=1-D),a>1)w.vy+=A*D;if(a>2)w.vz+=N*D}}function g(){if(!o)return;var p,x=o.length,S=e.length,v=new Map(o.map((w,E)=>[t(w,E,o),w])),b;for(p=0,l=Array(x);p<S;++p){if(b=e[p],b.index=p,typeof b.source!=="object")b.source=Eg(v,b.source);if(typeof b.target!=="object")b.target=Eg(v,b.target);l[b.source.index]=(l[b.source.index]||0)+1,l[b.target.index]=(l[b.target.index]||0)+1}for(p=0,c=Array(S);p<S;++p)b=e[p],c[p]=l[b.source.index]/(l[b.source.index]+l[b.target.index]);i=Array(S),_(),s=Array(S),m()}function _(){if(!o)return;for(var p=0,x=e.length;p<x;++p)i[p]=+n(e[p],p,e)}function m(){if(!o)return;for(var p=0,x=e.length;p<x;++p)s[p]=+r(e[p],p,e)}return d.initialize=function(p,...x){o=p,u=x.find((S)=>typeof S==="function")||Math.random,a=x.find((S)=>[1,2,3].includes(S))||2,g()},d.links=function(p){return arguments.length?(e=p,g(),d):e},d.id=function(p){return arguments.length?(t=p,d):t},d.iterations=function(p){return arguments.length?(f=+p,d):f},d.strength=function(p){return arguments.length?(n=typeof p==="function"?p:pn(+p),_(),d):n},d.distance=function(p){return arguments.length?(r=typeof p==="function"?p:pn(+p),m(),d):r},d}function nu(e){let t=+this._x.call(null,e);return Ag(this.cover(t),t,e)}function Ag(e,t,n){if(isNaN(t))return e;var i,r=e._root,s={data:n},{_x0:o,_x1:a}=e,l,c,u,f,h;if(!r)return e._root=s,e;while(r.length){if(u=t>=(l=(o+a)/2))o=l;else a=l;if(i=r,!(r=r[f=+u]))return i[f]=s,e}if(c=+e._x.call(null,r.data),t===c)return s.next=r,i?i[f]=s:e._root=s,e;do if(i=i?i[f]=[,,]:e._root=[,,],u=t>=(l=(o+a)/2))o=l;else a=l;while((f=+u)===(h=+(c>=l)));return i[h]=r,i[f]=s,e}function Cg(e){if(!Array.isArray(e))e=Array.from(e);let t=e.length,n=new Float64Array(t),i=1/0,r=-1/0;for(let s=0,o;s<t;++s){if(isNaN(o=+this._x.call(null,e[s])))continue;if(n[s]=o,o<i)i=o;if(o>r)r=o}if(i>r)return this;this.cover(i).cover(r);for(let s=0;s<t;++s)Ag(this,n[s],e[s]);return this}function iu(e){if(isNaN(e=+e))return this;var t=this._x0,n=this._x1;if(isNaN(t))n=(t=Math.floor(e))+1;else{var i=n-t||1,r=this._root,s,o;while(t>e||e>=n)switch(o=+(e<t),s=[,,],s[o]=r,r=s,i*=2,o){case 0:n=t+i;break;case 1:t=n-i;break}if(this._root&&this._root.length)this._root=r}return this._x0=t,this._x1=n,this}function ru(){var e=[];return this.visit(function(t){if(!t.length)do e.push(t.data);while(t=t.next)}),e}function su(e){return arguments.length?this.cover(+e[0][0]).cover(+e[1][0]):isNaN(this._x0)?void 0:[[this._x0],[this._x1]]}function mn(e,t,n){this.node=e,this.x0=t,this.x1=n}function ou(e,t){var n,i=this._x0,r,s,o=this._x1,a=[],l=this._root,c,u;if(l)a.push(new mn(l,i,o));if(t==null)t=1/0;else i=e-t,o=e+t;while(c=a.pop()){if(!(l=c.node)||(r=c.x0)>o||(s=c.x1)<i)continue;if(l.length){var f=(r+s)/2;if(a.push(new mn(l[1],f,s),new mn(l[0],r,f)),u=+(e>=f))c=a[a.length-1],a[a.length-1]=a[a.length-1-u],a[a.length-1-u]=c}else{var h=Math.abs(e-+this._x.call(null,l.data));if(h<t)t=h,i=e-h,o=e+h,n=l.data}}return n}function au(e){if(isNaN(l=+this._x.call(null,e)))return this;var t,n=this._root,i,r,s,o=this._x0,a=this._x1,l,c,u,f,h;if(!n)return this;if(n.length)while(!0){if(u=l>=(c=(o+a)/2))o=c;else a=c;if(t=n,!(n=n[f=+u]))return this;if(!n.length)break;if(t[f+1&1])i=t,h=f}while(n.data!==e)if(r=n,!(n=n.next))return this;if(s=n.next)delete n.next;if(r)return s?r.next=s:delete r.next,this;if(!t)return this._root=s,this;if(s?t[f]=s:delete t[f],(n=t[0]||t[1])&&n===(t[1]||t[0])&&!n.length)if(i)i[h]=n;else this._root=n;return this}function Rg(e){for(var t=0,n=e.length;t<n;++t)this.remove(e[t]);return this}function lu(){return this._root}function cu(){var e=0;return this.visit(function(t){if(!t.length)do++e;while(t=t.next)}),e}function hu(e){var t=[],n,i=this._root,r,s,o;if(i)t.push(new mn(i,this._x0,this._x1));while(n=t.pop())if(!e(i=n.node,s=n.x0,o=n.x1)&&i.length){var a=(s+o)/2;if(r=i[1])t.push(new mn(r,a,o));if(r=i[0])t.push(new mn(r,s,a))}return this}function uu(e){var t=[],n=[],i;if(this._root)t.push(new mn(this._root,this._x0,this._x1));while(i=t.pop()){var r=i.node;if(r.length){var s,o=i.x0,a=i.x1,l=(o+a)/2;if(s=r[0])t.push(new mn(s,o,l));if(s=r[1])t.push(new mn(s,l,a))}n.push(i)}while(i=n.pop())e(i.node,i.x0,i.x1);return this}function Pg(e){return e[0]}function fu(e){return arguments.length?(this._x=e,this):this._x}function Qs(e,t){var n=new du(t==null?Pg:t,NaN,NaN);return e==null?n:n.addAll(e)}function du(e,t,n){this._x=e,this._x0=t,this._x1=n,this._root=void 0}function Ig(e){var t={data:e.data},n=t;while(e=e.next)n=n.next={data:e.data};return t}var ln=Qs.prototype=du.prototype;ln.copy=function(){var e=new du(this._x,this._x0,this._x1),t=this._root,n,i;if(!t)return e;if(!t.length)return e._root=Ig(t),e;n=[{source:t,target:e._root=[,,]}];while(t=n.pop())for(var r=0;r<2;++r)if(i=t.source[r])if(i.length)n.push({source:i,target:t.target[r]=[,,]});else t.target[r]=Ig(i);return e};ln.add=nu;ln.addAll=Cg;ln.cover=iu;ln.data=ru;ln.extent=su;ln.find=ou;ln.remove=au;ln.removeAll=Rg;ln.root=lu;ln.size=cu;ln.visit=hu;ln.visitAfter=uu;ln.x=fu;function pu(e){let t=+this._x.call(null,e),n=+this._y.call(null,e);return Lg(this.cover(t,n),t,n,e)}function Lg(e,t,n,i){if(isNaN(t)||isNaN(n))return e;var r,s=e._root,o={data:i},{_x0:a,_y0:l,_x1:c,_y1:u}=e,f,h,d,g,_,m,p,x;if(!s)return e._root=o,e;while(s.length){if(_=t>=(f=(a+c)/2))a=f;else c=f;if(m=n>=(h=(l+u)/2))l=h;else u=h;if(r=s,!(s=s[p=m<<1|_]))return r[p]=o,e}if(d=+e._x.call(null,s.data),g=+e._y.call(null,s.data),t===d&&n===g)return o.next=s,r?r[p]=o:e._root=o,e;do{if(r=r?r[p]=[,,,,]:e._root=[,,,,],_=t>=(f=(a+c)/2))a=f;else c=f;if(m=n>=(h=(l+u)/2))l=h;else u=h}while((p=m<<1|_)===(x=(g>=h)<<1|d>=f));return r[x]=s,r[p]=o,e}function Dg(e){var t,n,i=e.length,r,s,o=Array(i),a=Array(i),l=1/0,c=1/0,u=-1/0,f=-1/0;for(n=0;n<i;++n){if(isNaN(r=+this._x.call(null,t=e[n]))||isNaN(s=+this._y.call(null,t)))continue;if(o[n]=r,a[n]=s,r<l)l=r;if(r>u)u=r;if(s<c)c=s;if(s>f)f=s}if(l>u||c>f)return this;this.cover(l,c).cover(u,f);for(n=0;n<i;++n)Lg(this,o[n],a[n],e[n]);return this}function mu(e,t){if(isNaN(e=+e)||isNaN(t=+t))return this;var n=this._x0,i=this._y0,r=this._x1,s=this._y1;if(isNaN(n))r=(n=Math.floor(e))+1,s=(i=Math.floor(t))+1;else{var o=r-n||1,a=this._root,l,c;while(n>e||e>=r||i>t||t>=s)switch(c=(t<i)<<1|e<n,l=[,,,,],l[c]=a,a=l,o*=2,c){case 0:r=n+o,s=i+o;break;case 1:n=r-o,s=i+o;break;case 2:r=n+o,i=s-o;break;case 3:n=r-o,i=s-o;break}if(this._root&&this._root.length)this._root=a}return this._x0=n,this._y0=i,this._x1=r,this._y1=s,this}function gu(){var e=[];return this.visit(function(t){if(!t.length)do e.push(t.data);while(t=t.next)}),e}function _u(e){return arguments.length?this.cover(+e[0][0],+e[0][1]).cover(+e[1][0],+e[1][1]):isNaN(this._x0)?void 0:[[this._x0,this._y0],[this._x1,this._y1]]}function Nt(e,t,n,i,r){this.node=e,this.x0=t,this.y0=n,this.x1=i,this.y1=r}function vu(e,t,n){var i,r=this._x0,s=this._y0,o,a,l,c,u=this._x1,f=this._y1,h=[],d=this._root,g,_;if(d)h.push(new Nt(d,r,s,u,f));if(n==null)n=1/0;else r=e-n,s=t-n,u=e+n,f=t+n,n*=n;while(g=h.pop()){if(!(d=g.node)||(o=g.x0)>u||(a=g.y0)>f||(l=g.x1)<r||(c=g.y1)<s)continue;if(d.length){var m=(o+l)/2,p=(a+c)/2;if(h.push(new Nt(d[3],m,p,l,c),new Nt(d[2],o,p,m,c),new Nt(d[1],m,a,l,p),new Nt(d[0],o,a,m,p)),_=(t>=p)<<1|e>=m)g=h[h.length-1],h[h.length-1]=h[h.length-1-_],h[h.length-1-_]=g}else{var x=e-+this._x.call(null,d.data),S=t-+this._y.call(null,d.data),v=x*x+S*S;if(v<n){var b=Math.sqrt(n=v);r=e-b,s=t-b,u=e+b,f=t+b,i=d.data}}}return i}function yu(e){if(isNaN(u=+this._x.call(null,e))||isNaN(f=+this._y.call(null,e)))return this;var t,n=this._root,i,r,s,o=this._x0,a=this._y0,l=this._x1,c=this._y1,u,f,h,d,g,_,m,p;if(!n)return this;if(n.length)while(!0){if(g=u>=(h=(o+l)/2))o=h;else l=h;if(_=f>=(d=(a+c)/2))a=d;else c=d;if(t=n,!(n=n[m=_<<1|g]))return this;if(!n.length)break;if(t[m+1&3]||t[m+2&3]||t[m+3&3])i=t,p=m}while(n.data!==e)if(r=n,!(n=n.next))return this;if(s=n.next)delete n.next;if(r)return s?r.next=s:delete r.next,this;if(!t)return this._root=s,this;if(s?t[m]=s:delete t[m],(n=t[0]||t[1]||t[2]||t[3])&&n===(t[3]||t[2]||t[1]||t[0])&&!n.length)if(i)i[p]=n;else this._root=n;return this}function Ng(e){for(var t=0,n=e.length;t<n;++t)this.remove(e[t]);return this}function xu(){return this._root}function bu(){var e=0;return this.visit(function(t){if(!t.length)do++e;while(t=t.next)}),e}function Su(e){var t=[],n,i=this._root,r,s,o,a,l;if(i)t.push(new Nt(i,this._x0,this._y0,this._x1,this._y1));while(n=t.pop())if(!e(i=n.node,s=n.x0,o=n.y0,a=n.x1,l=n.y1)&&i.length){var c=(s+a)/2,u=(o+l)/2;if(r=i[3])t.push(new Nt(r,c,u,a,l));if(r=i[2])t.push(new Nt(r,s,u,c,l));if(r=i[1])t.push(new Nt(r,c,o,a,u));if(r=i[0])t.push(new Nt(r,s,o,c,u))}return this}function Mu(e){var t=[],n=[],i;if(this._root)t.push(new Nt(this._root,this._x0,this._y0,this._x1,this._y1));while(i=t.pop()){var r=i.node;if(r.length){var s,o=i.x0,a=i.y0,l=i.x1,c=i.y1,u=(o+l)/2,f=(a+c)/2;if(s=r[0])t.push(new Nt(s,o,a,u,f));if(s=r[1])t.push(new Nt(s,u,a,l,f));if(s=r[2])t.push(new Nt(s,o,f,u,c));if(s=r[3])t.push(new Nt(s,u,f,l,c))}n.push(i)}while(i=n.pop())e(i.node,i.x0,i.y0,i.x1,i.y1);return this}function Og(e){return e[0]}function wu(e){return arguments.length?(this._x=e,this):this._x}function Ug(e){return e[1]}function Tu(e){return arguments.length?(this._y=e,this):this._y}function eo(e,t,n){var i=new Eu(t==null?Og:t,n==null?Ug:n,NaN,NaN,NaN,NaN);return e==null?i:i.addAll(e)}function Eu(e,t,n,i,r,s){this._x=e,this._y=t,this._x0=n,this._y0=i,this._x1=r,this._y1=s,this._root=void 0}function Fg(e){var t={data:e.data},n=t;while(e=e.next)n=n.next={data:e.data};return t}var en=eo.prototype=Eu.prototype;en.copy=function(){var e=new Eu(this._x,this._y,this._x0,this._y0,this._x1,this._y1),t=this._root,n,i;if(!t)return e;if(!t.length)return e._root=Fg(t),e;n=[{source:t,target:e._root=[,,,,]}];while(t=n.pop())for(var r=0;r<4;++r)if(i=t.source[r])if(i.length)n.push({source:i,target:t.target[r]=[,,,,]});else t.target[r]=Fg(i);return e};en.add=pu;en.addAll=Dg;en.cover=mu;en.data=gu;en.extent=_u;en.find=vu;en.remove=yu;en.removeAll=Ng;en.root=xu;en.size=bu;en.visit=Su;en.visitAfter=Mu;en.x=wu;en.y=Tu;function Au(e){let t=+this._x.call(null,e),n=+this._y.call(null,e),i=+this._z.call(null,e);return Bg(this.cover(t,n,i),t,n,i,e)}function Bg(e,t,n,i,r){if(isNaN(t)||isNaN(n)||isNaN(i))return e;var s,o=e._root,a={data:r},{_x0:l,_y0:c,_z0:u,_x1:f,_y1:h,_z1:d}=e,g,_,m,p,x,S,v,b,w,E,y;if(!o)return e._root=a,e;while(o.length){if(v=t>=(g=(l+f)/2))l=g;else f=g;if(b=n>=(_=(c+h)/2))c=_;else h=_;if(w=i>=(m=(u+d)/2))u=m;else d=m;if(s=o,!(o=o[E=w<<2|b<<1|v]))return s[E]=a,e}if(p=+e._x.call(null,o.data),x=+e._y.call(null,o.data),S=+e._z.call(null,o.data),t===p&&n===x&&i===S)return a.next=o,s?s[E]=a:e._root=a,e;do{if(s=s?s[E]=[,,,,,,,,]:e._root=[,,,,,,,,],v=t>=(g=(l+f)/2))l=g;else f=g;if(b=n>=(_=(c+h)/2))c=_;else h=_;if(w=i>=(m=(u+d)/2))u=m;else d=m}while((E=w<<2|b<<1|v)===(y=(S>=m)<<2|(x>=_)<<1|p>=g));return s[y]=o,s[E]=a,e}function kg(e){if(!Array.isArray(e))e=Array.from(e);let t=e.length,n=new Float64Array(t),i=new Float64Array(t),r=new Float64Array(t),s=1/0,o=1/0,a=1/0,l=-1/0,c=-1/0,u=-1/0;for(let f=0,h,d,g,_;f<t;++f){if(isNaN(d=+this._x.call(null,h=e[f]))||isNaN(g=+this._y.call(null,h))||isNaN(_=+this._z.call(null,h)))continue;if(n[f]=d,i[f]=g,r[f]=_,d<s)s=d;if(d>l)l=d;if(g<o)o=g;if(g>c)c=g;if(_<a)a=_;if(_>u)u=_}if(s>l||o>c||a>u)return this;this.cover(s,o,a).cover(l,c,u);for(let f=0;f<t;++f)Bg(this,n[f],i[f],r[f],e[f]);return this}function Cu(e,t,n){if(isNaN(e=+e)||isNaN(t=+t)||isNaN(n=+n))return this;var i=this._x0,r=this._y0,s=this._z0,o=this._x1,a=this._y1,l=this._z1;if(isNaN(i))o=(i=Math.floor(e))+1,a=(r=Math.floor(t))+1,l=(s=Math.floor(n))+1;else{var c=o-i||1,u=this._root,f,h;while(i>e||e>=o||r>t||t>=a||s>n||n>=l)switch(h=(n<s)<<2|(t<r)<<1|e<i,f=[,,,,,,,,],f[h]=u,u=f,c*=2,h){case 0:o=i+c,a=r+c,l=s+c;break;case 1:i=o-c,a=r+c,l=s+c;break;case 2:o=i+c,r=a-c,l=s+c;break;case 3:i=o-c,r=a-c,l=s+c;break;case 4:o=i+c,a=r+c,s=l-c;break;case 5:i=o-c,a=r+c,s=l-c;break;case 6:o=i+c,r=a-c,s=l-c;break;case 7:i=o-c,r=a-c,s=l-c;break}if(this._root&&this._root.length)this._root=u}return this._x0=i,this._y0=r,this._z0=s,this._x1=o,this._y1=a,this._z1=l,this}function Ru(){var e=[];return this.visit(function(t){if(!t.length)do e.push(t.data);while(t=t.next)}),e}function Pu(e){return arguments.length?this.cover(+e[0][0],+e[0][1],+e[0][2]).cover(+e[1][0],+e[1][1],+e[1][2]):isNaN(this._x0)?void 0:[[this._x0,this._y0,this._z0],[this._x1,this._y1,this._z1]]}function Qe(e,t,n,i,r,s,o){this.node=e,this.x0=t,this.y0=n,this.z0=i,this.x1=r,this.y1=s,this.z1=o}function Iu(e,t,n,i){var r,s=this._x0,o=this._y0,a=this._z0,l,c,u,f,h,d,g=this._x1,_=this._y1,m=this._z1,p=[],x=this._root,S,v;if(x)p.push(new Qe(x,s,o,a,g,_,m));if(i==null)i=1/0;else s=e-i,o=t-i,a=n-i,g=e+i,_=t+i,m=n+i,i*=i;while(S=p.pop()){if(!(x=S.node)||(l=S.x0)>g||(c=S.y0)>_||(u=S.z0)>m||(f=S.x1)<s||(h=S.y1)<o||(d=S.z1)<a)continue;if(x.length){var b=(l+f)/2,w=(c+h)/2,E=(u+d)/2;if(p.push(new Qe(x[7],b,w,E,f,h,d),new Qe(x[6],l,w,E,b,h,d),new Qe(x[5],b,c,E,f,w,d),new Qe(x[4],l,c,E,b,w,d),new Qe(x[3],b,w,u,f,h,E),new Qe(x[2],l,w,u,b,h,E),new Qe(x[1],b,c,u,f,w,E),new Qe(x[0],l,c,u,b,w,E)),v=(n>=E)<<2|(t>=w)<<1|e>=b)S=p[p.length-1],p[p.length-1]=p[p.length-1-v],p[p.length-1-v]=S}else{var y=e-+this._x.call(null,x.data),A=t-+this._y.call(null,x.data),N=n-+this._z.call(null,x.data),P=y*y+A*A+N*N;if(P<i){var D=Math.sqrt(i=P);s=e-D,o=t-D,a=n-D,g=e+D,_=t+D,m=n+D,r=x.data}}}return r}var Sw=(e,t,n,i,r,s)=>Math.sqrt((e-i)**2+(t-r)**2+(n-s)**2);function zg(e,t,n,i){let r=[],s=e-i,o=t-i,a=n-i,l=e+i,c=t+i,u=n+i;return this.visit((f,h,d,g,_,m,p)=>{if(!f.length)do{let x=f.data;if(Sw(e,t,n,this._x(x),this._y(x),this._z(x))<=i)r.push(x)}while(f=f.next);return h>l||d>c||g>u||_<s||m<o||p<a}),r}function Lu(e){if(isNaN(h=+this._x.call(null,e))||isNaN(d=+this._y.call(null,e))||isNaN(g=+this._z.call(null,e)))return this;var t,n=this._root,i,r,s,o=this._x0,a=this._y0,l=this._z0,c=this._x1,u=this._y1,f=this._z1,h,d,g,_,m,p,x,S,v,b,w;if(!n)return this;if(n.length)while(!0){if(x=h>=(_=(o+c)/2))o=_;else c=_;if(S=d>=(m=(a+u)/2))a=m;else u=m;if(v=g>=(p=(l+f)/2))l=p;else f=p;if(t=n,!(n=n[b=v<<2|S<<1|x]))return this;if(!n.length)break;if(t[b+1&7]||t[b+2&7]||t[b+3&7]||t[b+4&7]||t[b+5&7]||t[b+6&7]||t[b+7&7])i=t,w=b}while(n.data!==e)if(r=n,!(n=n.next))return this;if(s=n.next)delete n.next;if(r)return s?r.next=s:delete r.next,this;if(!t)return this._root=s,this;if(s?t[b]=s:delete t[b],(n=t[0]||t[1]||t[2]||t[3]||t[4]||t[5]||t[6]||t[7])&&n===(t[7]||t[6]||t[5]||t[4]||t[3]||t[2]||t[1]||t[0])&&!n.length)if(i)i[w]=n;else this._root=n;return this}function Gg(e){for(var t=0,n=e.length;t<n;++t)this.remove(e[t]);return this}function Du(){return this._root}function Nu(){var e=0;return this.visit(function(t){if(!t.length)do++e;while(t=t.next)}),e}function Ou(e){var t=[],n,i=this._root,r,s,o,a,l,c,u;if(i)t.push(new Qe(i,this._x0,this._y0,this._z0,this._x1,this._y1,this._z1));while(n=t.pop())if(!e(i=n.node,s=n.x0,o=n.y0,a=n.z0,l=n.x1,c=n.y1,u=n.z1)&&i.length){var f=(s+l)/2,h=(o+c)/2,d=(a+u)/2;if(r=i[7])t.push(new Qe(r,f,h,d,l,c,u));if(r=i[6])t.push(new Qe(r,s,h,d,f,c,u));if(r=i[5])t.push(new Qe(r,f,o,d,l,h,u));if(r=i[4])t.push(new Qe(r,s,o,d,f,h,u));if(r=i[3])t.push(new Qe(r,f,h,a,l,c,d));if(r=i[2])t.push(new Qe(r,s,h,a,f,c,d));if(r=i[1])t.push(new Qe(r,f,o,a,l,h,d));if(r=i[0])t.push(new Qe(r,s,o,a,f,h,d))}return this}function Uu(e){var t=[],n=[],i;if(this._root)t.push(new Qe(this._root,this._x0,this._y0,this._z0,this._x1,this._y1,this._z1));while(i=t.pop()){var r=i.node;if(r.length){var s,o=i.x0,a=i.y0,l=i.z0,c=i.x1,u=i.y1,f=i.z1,h=(o+c)/2,d=(a+u)/2,g=(l+f)/2;if(s=r[0])t.push(new Qe(s,o,a,l,h,d,g));if(s=r[1])t.push(new Qe(s,h,a,l,c,d,g));if(s=r[2])t.push(new Qe(s,o,d,l,h,u,g));if(s=r[3])t.push(new Qe(s,h,d,l,c,u,g));if(s=r[4])t.push(new Qe(s,o,a,g,h,d,f));if(s=r[5])t.push(new Qe(s,h,a,g,c,d,f));if(s=r[6])t.push(new Qe(s,o,d,g,h,u,f));if(s=r[7])t.push(new Qe(s,h,d,g,c,u,f))}n.push(i)}while(i=n.pop())e(i.node,i.x0,i.y0,i.z0,i.x1,i.y1,i.z1);return this}function Hg(e){return e[0]}function Fu(e){return arguments.length?(this._x=e,this):this._x}function Vg(e){return e[1]}function Bu(e){return arguments.length?(this._y=e,this):this._y}function Wg(e){return e[2]}function ku(e){return arguments.length?(this._z=e,this):this._z}function to(e,t,n,i){var r=new zu(t==null?Hg:t,n==null?Vg:n,i==null?Wg:i,NaN,NaN,NaN,NaN,NaN,NaN);return e==null?r:r.addAll(e)}function zu(e,t,n,i,r,s,o,a,l){this._x=e,this._y=t,this._z=n,this._x0=i,this._y0=r,this._z0=s,this._x1=o,this._y1=a,this._z1=l,this._root=void 0}function Xg(e){var t={data:e.data},n=t;while(e=e.next)n=n.next={data:e.data};return t}var Ht=to.prototype=zu.prototype;Ht.copy=function(){var e=new zu(this._x,this._y,this._z,this._x0,this._y0,this._z0,this._x1,this._y1,this._z1),t=this._root,n,i;if(!t)return e;if(!t.length)return e._root=Xg(t),e;n=[{source:t,target:e._root=[,,,,,,,,]}];while(t=n.pop())for(var r=0;r<8;++r)if(i=t.source[r])if(i.length)n.push({source:i,target:t.target[r]=[,,,,,,,,]});else t.target[r]=Xg(i);return e};Ht.add=Au;Ht.addAll=kg;Ht.cover=Cu;Ht.data=Ru;Ht.extent=Pu;Ht.find=Iu;Ht.findAllWithinRadius=zg;Ht.remove=Lu;Ht.removeAll=Gg;Ht.root=Du;Ht.size=Nu;Ht.visit=Ou;Ht.visitAfter=Uu;Ht.x=Fu;Ht.y=Bu;Ht.z=ku;var Mw={value:()=>{}};function jg(){for(var e=0,t=arguments.length,n={},i;e<t;++e){if(!(i=arguments[e]+"")||i in n||/[\s.]/.test(i))throw Error("illegal type: "+i);n[i]=[]}return new Va(n)}function Va(e){this._=e}function ww(e,t){return e.trim().split(/^|\s+/).map(function(n){var i="",r=n.indexOf(".");if(r>=0)i=n.slice(r+1),n=n.slice(0,r);if(n&&!t.hasOwnProperty(n))throw Error("unknown type: "+n);return{type:n,name:i}})}Va.prototype=jg.prototype={constructor:Va,on:function(e,t){var n=this._,i=ww(e+"",n),r,s=-1,o=i.length;if(arguments.length<2){while(++s<o)if((r=(e=i[s]).type)&&(r=Tw(n[r],e.name)))return r;return}if(t!=null&&typeof t!=="function")throw Error("invalid callback: "+t);while(++s<o)if(r=(e=i[s]).type)n[r]=qg(n[r],e.name,t);else if(t==null)for(r in n)n[r]=qg(n[r],e.name,null);return this},copy:function(){var e={},t=this._;for(var n in t)e[n]=t[n].slice();return new Va(e)},call:function(e,t){if((r=arguments.length-2)>0)for(var n=Array(r),i=0,r,s;i<r;++i)n[i]=arguments[i+2];if(!this._.hasOwnProperty(e))throw Error("unknown type: "+e);for(s=this._[e],i=0,r=s.length;i<r;++i)s[i].value.apply(t,n)},apply:function(e,t,n){if(!this._.hasOwnProperty(e))throw Error("unknown type: "+e);for(var i=this._[e],r=0,s=i.length;r<s;++r)i[r].value.apply(t,n)}};function Tw(e,t){for(var n=0,i=e.length,r;n<i;++n)if((r=e[n]).name===t)return r.value}function qg(e,t,n){for(var i=0,r=e.length;i<r;++i)if(e[i].name===t){e[i]=Mw,e=e.slice(0,i).concat(e.slice(i+1));break}if(n!=null)e.push({name:t,value:n});return e}var Gu=jg;var Kr=0,io=0,no=0,$g=1000,Wa,ro,Xa=0,sr=0,qa=0,so=typeof performance==="object"&&performance.now?performance:Date,Zg=typeof window==="object"&&window.requestAnimationFrame?window.requestAnimationFrame.bind(window):function(e){setTimeout(e,17)};function Wu(){return sr||(Zg(Ew),sr=so.now()+qa)}function Ew(){sr=0}function Hu(){this._call=this._time=this._next=null}Hu.prototype=ja.prototype={constructor:Hu,restart:function(e,t,n){if(typeof e!=="function")throw TypeError("callback is not a function");if(n=(n==null?Wu():+n)+(t==null?0:+t),!this._next&&ro!==this){if(ro)ro._next=this;else Wa=this;ro=this}this._call=e,this._time=n,Vu()},stop:function(){if(this._call)this._call=null,this._time=1/0,Vu()}};function ja(e,t,n){var i=new Hu;return i.restart(e,t,n),i}function Jg(){Wu(),++Kr;var e=Wa,t;while(e){if((t=sr-e._time)>=0)e._call.call(void 0,t);e=e._next}--Kr}function Yg(){sr=(Xa=so.now())+qa,Kr=io=0;try{Jg()}finally{Kr=0,Cw(),sr=0}}function Aw(){var e=so.now(),t=e-Xa;if(t>$g)qa-=t,Xa=e}function Cw(){var e,t=Wa,n,i=1/0;while(t)if(t._call){if(i>t._time)i=t._time;e=t,t=t._next}else n=t._next,t._next=null,t=e?e._next=n:Wa=n;ro=e,Vu(i)}function Vu(e){if(Kr)return;if(io)io=clearTimeout(io);var t=e-sr;if(t>24){if(e<1/0)io=setTimeout(Yg,e-so.now()-qa);if(no)no=clearInterval(no)}else{if(!no)Xa=so.now(),no=setInterval(Aw,$g);Kr=1,Zg(Yg)}}function Xu(){let e=1;return()=>(e=(1664525*e+1013904223)%4294967296)/4294967296}var Kg=3;function Ya(e){return e.x}function qu(e){return e.y}function Qg(e){return e.z}var Rw=10,Pw=Math.PI*(3-Math.sqrt(5)),Iw=Math.PI*20/(9+Math.sqrt(221));function $a(e,t){t=t||2;var n=Math.min(Kg,Math.max(1,Math.round(t))),i,r=1,s=0.001,o=1-Math.pow(s,0.0033333333333333335),a=0,l=0.6,c=new Map,u=ja(d),f=Gu("tick","end"),h=Xu();if(e==null)e=[];function d(){if(g(),f.call("tick",i),r<s)u.stop(),f.call("end",i)}function g(p){var x,S=e.length,v;if(p===void 0)p=1;for(var b=0;b<p;++b){r+=(a-r)*o,c.forEach(function(w){w(r)});for(x=0;x<S;++x){if(v=e[x],v.fx==null)v.x+=v.vx*=l;else v.x=v.fx,v.vx=0;if(n>1)if(v.fy==null)v.y+=v.vy*=l;else v.y=v.fy,v.vy=0;if(n>2)if(v.fz==null)v.z+=v.vz*=l;else v.z=v.fz,v.vz=0}}return i}function _(){for(var p=0,x=e.length,S;p<x;++p){if(S=e[p],S.index=p,S.fx!=null)S.x=S.fx;if(S.fy!=null)S.y=S.fy;if(S.fz!=null)S.z=S.fz;if(isNaN(S.x)||n>1&&isNaN(S.y)||n>2&&isNaN(S.z)){var v=Rw*(n>2?Math.cbrt(0.5+p):n>1?Math.sqrt(0.5+p):p),b=p*Pw,w=p*Iw;if(n===1)S.x=v;else if(n===2)S.x=v*Math.cos(b),S.y=v*Math.sin(b);else S.x=v*Math.sin(b)*Math.cos(w),S.y=v*Math.cos(b),S.z=v*Math.sin(b)*Math.sin(w)}if(isNaN(S.vx)||n>1&&isNaN(S.vy)||n>2&&isNaN(S.vz)){if(S.vx=0,n>1)S.vy=0;if(n>2)S.vz=0}}}function m(p){if(p.initialize)p.initialize(e,h,n);return p}return _(),i={tick:g,restart:function(){return u.restart(d),i},stop:function(){return u.stop(),i},numDimensions:function(p){return arguments.length?(n=Math.min(Kg,Math.max(1,Math.round(p))),c.forEach(m),i):n},nodes:function(p){return arguments.length?(e=p,_(),c.forEach(m),i):e},alpha:function(p){return arguments.length?(r=+p,i):r},alphaMin:function(p){return arguments.length?(s=+p,i):s},alphaDecay:function(p){return arguments.length?(o=+p,i):+o},alphaTarget:function(p){return arguments.length?(a=+p,i):a},velocityDecay:function(p){return arguments.length?(l=1-p,i):1-l},randomSource:function(p){return arguments.length?(h=p,c.forEach(m),i):h},force:function(p,x){return arguments.length>1?(x==null?c.delete(p):c.set(p,m(x)),i):c.get(p)},find:function(){var p=Array.prototype.slice.call(arguments),x=p.shift()||0,S=(n>1?p.shift():null)||0,v=(n>2?p.shift():null)||0,b=p.shift()||1/0,w=0,E=e.length,y,A,N,P,D,W;b*=b;for(w=0;w<E;++w)if(D=e[w],y=x-D.x,A=S-(D.y||0),N=v-(D.z||0),P=y*y+A*A+N*N,P<b)W=D,b=P;return W},on:function(p,x){return arguments.length>1?(f.on(p,x),i):f.on(p)}}}function Za(){var e,t,n,i,r,s=pn(-30),o,a=1,l=1/0,c=0.81;function u(g){var _,m=e.length,p=(t===1?Qs(e,Ya):t===2?eo(e,Ya,qu):t===3?to(e,Ya,qu,Qg):null).visitAfter(h);for(r=g,_=0;_<m;++_)n=e[_],p.visit(d)}function f(){if(!e)return;var g,_=e.length,m;o=Array(_);for(g=0;g<_;++g)m=e[g],o[m.index]=+s(m,g,e)}function h(g){var _=0,m,p,x=0,S,v,b,w,E=g.length;if(E){for(S=v=b=w=0;w<E;++w)if((m=g[w])&&(p=Math.abs(m.value)))_+=m.value,x+=p,S+=p*(m.x||0),v+=p*(m.y||0),b+=p*(m.z||0);if(_*=Math.sqrt(4/E),g.x=S/x,t>1)g.y=v/x;if(t>2)g.z=b/x}else{if(m=g,m.x=m.data.x,t>1)m.y=m.data.y;if(t>2)m.z=m.data.z;do _+=o[m.data.index];while(m=m.next)}g.value=_}function d(g,_,m,p,x){if(!g.value)return!0;var S=[m,p,x][t-1],v=g.x-n.x,b=t>1?g.y-n.y:0,w=t>2?g.z-n.z:0,E=S-_,y=v*v+b*b+w*w;if(E*E/c<y){if(y<l){if(v===0)v=Mn(i),y+=v*v;if(t>1&&b===0)b=Mn(i),y+=b*b;if(t>2&&w===0)w=Mn(i),y+=w*w;if(y<a)y=Math.sqrt(a*y);if(n.vx+=v*g.value*r/y,t>1)n.vy+=b*g.value*r/y;if(t>2)n.vz+=w*g.value*r/y}return!0}else if(g.length||y>=l)return;if(g.data!==n||g.next){if(v===0)v=Mn(i),y+=v*v;if(t>1&&b===0)b=Mn(i),y+=b*b;if(t>2&&w===0)w=Mn(i),y+=w*w;if(y<a)y=Math.sqrt(a*y)}do if(g.data!==n){if(E=o[g.data.index]*r/y,n.vx+=v*E,t>1)n.vy+=b*E;if(t>2)n.vz+=w*E}while(g=g.next)}return u.initialize=function(g,..._){e=g,i=_.find((m)=>typeof m==="function")||Math.random,t=_.find((m)=>[1,2,3].includes(m))||2,f()},u.strength=function(g){return arguments.length?(s=typeof g==="function"?g:pn(+g),f(),u):s},u.distanceMin=function(g){return arguments.length?(a=g*g,u):Math.sqrt(a)},u.distanceMax=function(g){return arguments.length?(l=g*g,u):Math.sqrt(l)},u.theta=function(g){return arguments.length?(c=g*g,u):Math.sqrt(c)},u}function Ja(e,t,n,i){var r,s,o=pn(0.1),a,l;if(typeof e!=="function")e=pn(+e);if(t==null)t=0;if(n==null)n=0;if(i==null)i=0;function c(f){for(var h=0,d=r.length;h<d;++h){var g=r[h],_=g.x-t||0.000001,m=(g.y||0)-n||0.000001,p=(g.z||0)-i||0.000001,x=Math.sqrt(_*_+m*m+p*p),S=(l[h]-x)*a[h]*f/x;if(g.vx+=_*S,s>1)g.vy+=m*S;if(s>2)g.vz+=p*S}}function u(){if(!r)return;var f,h=r.length;a=Array(h),l=Array(h);for(f=0;f<h;++f)l[f]=+e(r[f],f,r),a[f]=isNaN(l[f])?0:+o(r[f],f,r)}return c.initialize=function(f,...h){r=f,s=h.find((d)=>[1,2,3].includes(d))||2,u()},c.strength=function(f){return arguments.length?(o=typeof f==="function"?f:pn(+f),u(),c):o},c.radius=function(f){return arguments.length?(e=typeof f==="function"?f:pn(+f),u(),c):e},c.x=function(f){return arguments.length?(t=+f,c):t},c.y=function(f){return arguments.length?(n=+f,c):n},c.z=function(f){return arguments.length?(i=+f,c):i},c}function ju(e){Dw(e);let t=Lw(e);return e.on=t.on,e.off=t.off,e.fire=t.fire,e}function Lw(e){let t=Object.create(null);return{on:function(n,i,r){if(typeof i!=="function")throw Error("callback is expected to be a function");let s=t[n];if(!s)s=t[n]=[];return s.push({callback:i,ctx:r}),e},off:function(n,i){if(typeof n>"u")return t=Object.create(null),e;if(t[n])if(typeof i!=="function")delete t[n];else{let o=t[n];for(let a=0;a<o.length;++a)if(o[a].callback===i)o.splice(a,1)}return e},fire:function(n){let i=t[n];if(!i)return e;let r;if(arguments.length>1)r=Array.prototype.slice.call(arguments,1);for(let s=0;s<i.length;++s){let o=i[s];o.callback.apply(o.ctx,r)}return e}}}function Dw(e){if(!e)throw Error("Eventify cannot use falsy object as events subject");let t=["on","fire","off"];for(let n=0;n<t.length;++n)if(e.hasOwnProperty(t[n]))throw Error("Subject cannot be eventified, since it already has property '"+t[n]+"'")}var n_=Nw;function Nw(e){if(e=e||{},"uniqueLinkId"in e)console.warn("ngraph.graph: Starting from version 0.14 `uniqueLinkId` is deprecated.\nUse `multigraph` option instead\n",`
`,`Note: there is also change in default behavior: From now on each graph
is considered to be not a multigraph by default (each edge is unique).`),e.multigraph=e.uniqueLinkId;if(e.multigraph===void 0)e.multigraph=!1;if(typeof Map!=="function")throw Error("ngraph.graph requires `Map` to be defined. Please polyfill it before using ngraph");var t=new Map,n=new Map,i={},r=0,s=e.multigraph?v:S,o=[],a=z,l=z,c=z,u=z,f={version:20,addNode:_,addLink:x,removeLink:y,removeNode:p,getNode:m,getNodeCount:b,getLinkCount:w,getEdgeCount:w,getLinksCount:w,getNodesCount:b,getLinks:E,forEachNode:Q,forEachLinkedNode:R,forEachLink:W,beginUpdate:c,endUpdate:u,clear:D,hasLink:N,hasNode:m,getLink:N,getLinkById:P};return ju(f),h(),f;function h(){var G=f.on;f.on=ee;function ee(){return f.beginUpdate=c=te,f.endUpdate=u=Y,a=d,l=g,f.on=G,G.apply(f,arguments)}}function d(G,ee){o.push({link:G,changeType:ee})}function g(G,ee){o.push({node:G,changeType:ee})}function _(G,ee){if(G===void 0)throw Error("Invalid node identifier");c();var oe=m(G);if(!oe)oe=new Ow(G,ee),l(oe,"add");else oe.data=ee,l(oe,"update");return t.set(G,oe),u(),oe}function m(G){return t.get(G)}function p(G){var ee=m(G);if(!ee)return!1;c();var oe=ee.links;if(oe)oe.forEach(A),ee.links=null;return t.delete(G),l(ee,"remove"),u(),!0}function x(G,ee,oe){c();var Fe=m(G)||_(G),Re=m(ee)||_(ee),X=s(G,ee,oe),se=n.has(X.id);if(n.set(X.id,X),e_(Fe,X),G!==ee)e_(Re,X);return a(X,se?"update":"add"),u(),X}function S(G,ee,oe){var Fe=Ka(G,ee),Re=n.get(Fe);if(Re)return Re.data=oe,Re;return new t_(G,ee,oe,Fe)}function v(G,ee,oe){var Fe=Ka(G,ee),Re=i.hasOwnProperty(Fe);if(Re||N(G,ee)){if(!Re)i[Fe]=0;var X="@"+ ++i[Fe];Fe=Ka(G+X,ee+X)}return new t_(G,ee,oe,Fe)}function b(){return t.size}function w(){return n.size}function E(G){var ee=m(G);return ee?ee.links:null}function y(G,ee){if(ee!==void 0)G=N(G,ee);return A(G)}function A(G){if(!G)return!1;if(!n.get(G.id))return!1;c(),n.delete(G.id);var ee=m(G.fromId),oe=m(G.toId);if(ee)ee.links.delete(G);if(oe)oe.links.delete(G);return a(G,"remove"),u(),!0}function N(G,ee){if(G===void 0||ee===void 0)return;return n.get(Ka(G,ee))}function P(G){if(G===void 0)return;return n.get(G)}function D(){c(),Q(function(G){p(G.id)}),u()}function W(G){if(typeof G==="function"){var ee=n.values(),oe=ee.next();while(!oe.done){if(G(oe.value))return!0;oe=ee.next()}}}function R(G,ee,oe){var Fe=m(G);if(Fe&&Fe.links&&typeof ee==="function")if(oe)return k(Fe.links,G,ee);else return I(Fe.links,G,ee)}function I(G,ee,oe){var Fe,Re=G.values(),X=Re.next();while(!X.done){var se=X.value,le=se.fromId===ee?se.toId:se.fromId;if(Fe=oe(t.get(le),se),Fe)return!0;X=Re.next()}}function k(G,ee,oe){var Fe,Re=G.values(),X=Re.next();while(!X.done){var se=X.value;if(se.fromId===ee){if(Fe=oe(t.get(se.toId),se),Fe)return!0}X=Re.next()}}function z(){}function te(){r+=1}function Y(){if(r-=1,r===0&&o.length>0)f.fire("changed",o),o.length=0}function Q(G){if(typeof G!=="function")throw Error("Function is expected to iterate over graph nodes. You passed "+G);var ee=t.values(),oe=ee.next();while(!oe.done){if(G(oe.value))return!0;oe=ee.next()}}}function Ow(e,t){this.id=e,this.links=null,this.data=t}function e_(e,t){if(e.links)e.links.add(t);else e.links=new Set([t])}function t_(e,t,n,i){this.fromId=e,this.toId=t,this.data=n,this.id=i}function Ka(e,t){return e.toString()+"\uD83D\uDC49 "+t.toString()}var u0=Sv(O_(),1);function d1(e){var t=typeof e;return e!=null&&(t=="object"||t=="function")}var ao=d1;var p1=typeof global=="object"&&global&&global.Object===Object&&global,U_=p1;var m1=typeof self=="object"&&self&&self.Object===Object&&self,g1=U_||m1||Function("return this")(),el=g1;var _1=function(){return el.Date.now()},tl=_1;var v1=/\s/;function y1(e){var t=e.length;while(t--&&v1.test(e.charAt(t)));return t}var F_=y1;var x1=/^\s+/;function b1(e){return e?e.slice(0,F_(e)+1).replace(x1,""):e}var B_=b1;var S1=el.Symbol,Qr=S1;var k_=Object.prototype,{hasOwnProperty:M1,toString:w1}=k_,lo=Qr?Qr.toStringTag:void 0;function T1(e){var t=M1.call(e,lo),n=e[lo];try{e[lo]=void 0;var i=!0}catch(s){}var r=w1.call(e);if(i)if(t)e[lo]=n;else delete e[lo];return r}var z_=T1;var E1=Object.prototype,A1=E1.toString;function C1(e){return A1.call(e)}var G_=C1;var R1="[object Null]",P1="[object Undefined]",H_=Qr?Qr.toStringTag:void 0;function I1(e){if(e==null)return e===void 0?P1:R1;return H_&&H_ in Object(e)?z_(e):G_(e)}var V_=I1;function L1(e){return e!=null&&typeof e=="object"}var W_=L1;var D1="[object Symbol]";function N1(e){return typeof e=="symbol"||W_(e)&&V_(e)==D1}var X_=N1;var q_=NaN,O1=/^[-+]0x[0-9a-f]+$/i,U1=/^0b[01]+$/i,F1=/^0o[0-7]+$/i,B1=parseInt;function k1(e){if(typeof e=="number")return e;if(X_(e))return q_;if(ao(e)){var t=typeof e.valueOf=="function"?e.valueOf():e;e=ao(t)?t+"":t}if(typeof e!="string")return e===0?e:+e;e=B_(e);var n=U1.test(e);return n||F1.test(e)?B1(e.slice(2),n?2:8):O1.test(e)?q_:+e}var of=k1;var z1="Expected a function",{max:G1,min:H1}=Math;function V1(e,t,n){var i,r,s,o,a,l,c=0,u=!1,f=!1,h=!0;if(typeof e!="function")throw TypeError(z1);if(t=of(t)||0,ao(n))u=!!n.leading,f="maxWait"in n,s=f?G1(of(n.maxWait)||0,t):s,h="trailing"in n?!!n.trailing:h;function d(w){var E=i,y=r;return i=r=void 0,c=w,o=e.apply(y,E),o}function g(w){return c=w,a=setTimeout(p,t),u?d(w):o}function _(w){var E=w-l,y=w-c,A=t-E;return f?H1(A,s-y):A}function m(w){var E=w-l,y=w-c;return l===void 0||E>=t||E<0||f&&y>=s}function p(){var w=tl();if(m(w))return x(w);a=setTimeout(p,_(w))}function x(w){if(a=void 0,h&&i)return d(w);return i=r=void 0,o}function S(){if(a!==void 0)clearTimeout(a);c=0,i=l=r=a=void 0}function v(){return a===void 0?o:x(tl())}function b(){var w=tl(),E=m(w);if(i=arguments,r=this,l=w,E){if(a===void 0)return g(l);if(f)return clearTimeout(a),a=setTimeout(p,t),d(l)}if(a===void 0)a=setTimeout(p,t);return o}return b.cancel=S,b.flush=v,b}var j_=V1;function Y_(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function W1(e){if(Array.isArray(e))return e}function X1(e,t){if(!(e instanceof t))throw TypeError("Cannot call a class as a function")}function q1(e,t,n){return Object.defineProperty(e,"prototype",{writable:!1}),e}function j1(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0);else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(u){c=!0,r=u}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function Y1(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function $1(e,t){return W1(e)||j1(e,t)||Z1(e,t)||Y1()}function Z1(e,t){if(e){if(typeof e=="string")return Y_(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?Y_(e,t):void 0}}var J1=q1(function e(t,n){var i=n.default,r=i===void 0?null:i,s=n.triggerUpdate,o=s===void 0?!0:s,a=n.onChange,l=a===void 0?function(c,u){}:a;X1(this,e),this.name=t,this.defaultVal=r,this.triggerUpdate=o,this.onChange=l});function Ei(e){var t=e.stateInit,n=t===void 0?function(){return{}}:t,i=e.props,r=i===void 0?{}:i,s=e.methods,o=s===void 0?{}:s,a=e.aliases,l=a===void 0?{}:a,c=e.init,u=c===void 0?function(){}:c,f=e.update,h=f===void 0?function(){}:f,d=Object.keys(r).map(function(g){return new J1(g,r[g])});return function g(){for(var _=arguments.length,m=Array(_),p=0;p<_;p++)m[p]=arguments[p];var x=!!(this instanceof g?this.constructor:void 0),S=x?m.shift():void 0,v=m[0],b=v===void 0?{}:v,w=Object.assign({},n instanceof Function?n(b):n,{initialised:!1}),E={};function y(P){return A(P,b),N(),y}var A=function(D,W){u.call(y,D,w,W),w.initialised=!0},N=j_(function(){if(!w.initialised)return;h.call(y,w,E),E={}},1);return d.forEach(function(P){y[P.name]=D(P);function D(W){var{name:R,triggerUpdate:I}=W,k=I===void 0?!1:I,z=W.onChange,te=z===void 0?function(G,ee){}:z,Y=W.defaultVal,Q=Y===void 0?null:Y;return function(G){var ee=w[R];if(!arguments.length)return ee;var oe=G===void 0?Q:G;if(w[R]=oe,te.call(y,oe,w,ee),!E.hasOwnProperty(R)&&(E[R]=ee),k)N();return y}}}),Object.keys(o).forEach(function(P){y[P]=function(){var D;for(var W=arguments.length,R=Array(W),I=0;I<W;I++)R[I]=arguments[I];return(D=o[P]).call.apply(D,[y,w].concat(R))}}),Object.entries(l).forEach(function(P){var D=$1(P,2),W=D[0],R=D[1];return y[W]=y[R]}),y.resetProps=function(){return d.forEach(function(P){y[P.name](P.defaultVal)}),y},y.resetProps(),w._rerender=N,x&&S&&y(S),y}}var ze=function(e){return typeof e==="function"?e:typeof e==="string"?function(t){return t[e]}:function(t){return e}};function nl(e,t){let n;if(t===void 0){for(let i of e)if(i!=null&&(n<i||n===void 0&&i>=i))n=i}else{let i=-1;for(let r of e)if((r=t(r,++i,e))!=null&&(n<r||n===void 0&&r>=r))n=r}return n}function il(e,t){let n;if(t===void 0){for(let i of e)if(i!=null&&(n>i||n===void 0&&i>=i))n=i}else{let i=-1;for(let r of e)if((r=t(r,++i,e))!=null&&(n>r||n===void 0&&r>=r))n=r}return n}class co extends Map{constructor(e,t=eT){super();if(Object.defineProperties(this,{_intern:{value:new Map},_key:{value:t}}),e!=null)for(let[n,i]of e)this.set(n,i)}get(e){return super.get($_(this,e))}has(e){return super.has($_(this,e))}set(e,t){return super.set(K1(this,e),t)}delete(e){return super.delete(Q1(this,e))}}function $_({_intern:e,_key:t},n){let i=t(n);return e.has(i)?e.get(i):n}function K1({_intern:e,_key:t},n){let i=t(n);if(e.has(i))return e.get(i);return e.set(i,n),n}function Q1({_intern:e,_key:t},n){let i=t(n);if(e.has(i))n=e.get(i),e.delete(i);return n}function eT(e){return e!==null&&typeof e==="object"?e.valueOf():e}function hf(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function tT(e){if(Array.isArray(e))return e}function nT(e){if(Array.isArray(e))return hf(e)}function Z_(e,t,n){if(typeof e=="function"?e===t:e.has(t))return arguments.length<3?t:n;throw TypeError("Private element is not present on this object")}function iT(e,t){if(t.has(e))throw TypeError("Cannot initialize the same private elements twice on an object")}function rT(e,t){if(!(e instanceof t))throw TypeError("Cannot call a class as a function")}function Zt(e,t){return e.get(Z_(e,t))}function es(e,t,n){iT(e,t),t.set(e,n)}function rl(e,t,n){return e.set(Z_(e,t),n),n}function sT(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,pT(i.key),i)}}function oT(e,t,n){return t&&sT(e.prototype,t),Object.defineProperty(e,"prototype",{writable:!1}),e}function aT(e){if(typeof Symbol<"u"&&e[Symbol.iterator]!=null||e["@@iterator"]!=null)return Array.from(e)}function lT(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0);else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(u){c=!0,r=u}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function cT(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function hT(){throw TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function uT(e,t){return tT(e)||lT(e,t)||J_(e,t)||cT()}function fT(e){return nT(e)||aT(e)||J_(e)||hT()}function dT(e,t){if(typeof e!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var i=n.call(e,t);if(typeof i!="object")return i;throw TypeError("@@toPrimitive must return a primitive value.")}return String(e)}function pT(e){var t=dT(e,"string");return typeof t=="symbol"?t:t+""}function J_(e,t){if(e){if(typeof e=="string")return hf(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?hf(e,t):void 0}}var ts=new WeakMap,ho=new WeakMap,ns=new WeakMap,af=new WeakMap,lf=new WeakMap,cf=new WeakMap,K_=function(){function e(){rT(this,e),es(this,ts,new Map),es(this,ho,new Map),es(this,ns,function(t){return t}),es(this,af,function(){return{}}),es(this,lf,function(){}),es(this,cf,function(){})}return oT(e,[{key:"getObj",value:function(n){return Zt(ts,this).get(Zt(ns,this).call(this,n))}},{key:"getData",value:function(n){return Zt(ho,this).get(n)}},{key:"entries",value:function(){return fT(Zt(ho,this).entries()).map(function(n){var i=uT(n,2),r=i[0],s=i[1];return[s,r]})}},{key:"id",value:function(n){return rl(ns,this,ze(n)),this}},{key:"onCreateObj",value:function(n){return rl(af,this,n),this}},{key:"onUpdateObj",value:function(n){return rl(lf,this,n),this}},{key:"onRemoveObj",value:function(n){return rl(cf,this,n),this}},{key:"digest",value:function(n){var i=this;n.filter(function(s){return!Zt(ts,i).has(Zt(ns,i).call(i,s))}).forEach(function(s){var o=Zt(af,i).call(i,s);Zt(ts,i).set(Zt(ns,i).call(i,s),o),Zt(ho,i).set(o,s)});var r=new Map(n.map(function(s){return[Zt(ns,i).call(i,s),s]}));return Zt(ts,this).forEach(function(s,o){if(!r.has(o))Zt(cf,i).call(i,s,o),Zt(ts,i).delete(o),Zt(ho,i).delete(s);else Zt(lf,i).call(i,s,r.get(o))}),this}},{key:"clear",value:function(){return this.digest([]),this}}])}();function Q_(e,t){switch(arguments.length){case 0:break;case 1:this.range(e);break;default:this.range(t).domain(e);break}return this}var uf=Symbol("implicit");function uo(){var e=new co,t=[],n=[],i=uf;function r(s){let o=e.get(s);if(o===void 0){if(i!==uf)return i;e.set(s,o=t.push(s)-1)}return n[o%n.length]}return r.domain=function(s){if(!arguments.length)return t.slice();t=[],e=new co;for(let o of s){if(e.has(o))continue;e.set(o,t.push(o)-1)}return r},r.range=function(s){return arguments.length?(n=Array.from(s),r):n.slice()},r.unknown=function(s){return arguments.length?(i=s,r):i},r.copy=function(){return uo(t,n).unknown(i)},Q_.apply(r,arguments),r}function ff(e){var t=e.length/6|0,n=Array(t),i=0;while(i<t)n[i]="#"+e.slice(i*6,++i*6);return n}var df=ff("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928");function sl(e){return sl=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(t){return typeof t}:function(t){return t&&typeof Symbol=="function"&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},sl(e)}var mT=/^\s+/,gT=/\s+$/;function Te(e,t){if(e=e?e:"",t=t||{},e instanceof Te)return e;if(!(this instanceof Te))return new Te(e,t);var n=_T(e);if(this._originalInput=e,this._r=n.r,this._g=n.g,this._b=n.b,this._a=n.a,this._roundA=Math.round(100*this._a)/100,this._format=t.format||n.format,this._gradientType=t.gradientType,this._r<1)this._r=Math.round(this._r);if(this._g<1)this._g=Math.round(this._g);if(this._b<1)this._b=Math.round(this._b);this._ok=n.ok}Te.prototype={isDark:function(){return this.getBrightness()<128},isLight:function(){return!this.isDark()},isValid:function(){return this._ok},getOriginalInput:function(){return this._originalInput},getFormat:function(){return this._format},getAlpha:function(){return this._a},getBrightness:function(){var t=this.toRgb();return(t.r*299+t.g*587+t.b*114)/1000},getLuminance:function(){var t=this.toRgb(),n,i,r,s,o,a;if(n=t.r/255,i=t.g/255,r=t.b/255,n<=0.03928)s=n/12.92;else s=Math.pow((n+0.055)/1.055,2.4);if(i<=0.03928)o=i/12.92;else o=Math.pow((i+0.055)/1.055,2.4);if(r<=0.03928)a=r/12.92;else a=Math.pow((r+0.055)/1.055,2.4);return 0.2126*s+0.7152*o+0.0722*a},setAlpha:function(t){return this._a=o0(t),this._roundA=Math.round(100*this._a)/100,this},toHsv:function(){var t=t0(this._r,this._g,this._b);return{h:t.h*360,s:t.s,v:t.v,a:this._a}},toHsvString:function(){var t=t0(this._r,this._g,this._b),n=Math.round(t.h*360),i=Math.round(t.s*100),r=Math.round(t.v*100);return this._a==1?"hsv("+n+", "+i+"%, "+r+"%)":"hsva("+n+", "+i+"%, "+r+"%, "+this._roundA+")"},toHsl:function(){var t=e0(this._r,this._g,this._b);return{h:t.h*360,s:t.s,l:t.l,a:this._a}},toHslString:function(){var t=e0(this._r,this._g,this._b),n=Math.round(t.h*360),i=Math.round(t.s*100),r=Math.round(t.l*100);return this._a==1?"hsl("+n+", "+i+"%, "+r+"%)":"hsla("+n+", "+i+"%, "+r+"%, "+this._roundA+")"},toHex:function(t){return n0(this._r,this._g,this._b,t)},toHexString:function(t){return"#"+this.toHex(t)},toHex8:function(t){return bT(this._r,this._g,this._b,this._a,t)},toHex8String:function(t){return"#"+this.toHex8(t)},toRgb:function(){return{r:Math.round(this._r),g:Math.round(this._g),b:Math.round(this._b),a:this._a}},toRgbString:function(){return this._a==1?"rgb("+Math.round(this._r)+", "+Math.round(this._g)+", "+Math.round(this._b)+")":"rgba("+Math.round(this._r)+", "+Math.round(this._g)+", "+Math.round(this._b)+", "+this._roundA+")"},toPercentageRgb:function(){return{r:Math.round(_t(this._r,255)*100)+"%",g:Math.round(_t(this._g,255)*100)+"%",b:Math.round(_t(this._b,255)*100)+"%",a:this._a}},toPercentageRgbString:function(){return this._a==1?"rgb("+Math.round(_t(this._r,255)*100)+"%, "+Math.round(_t(this._g,255)*100)+"%, "+Math.round(_t(this._b,255)*100)+"%)":"rgba("+Math.round(_t(this._r,255)*100)+"%, "+Math.round(_t(this._g,255)*100)+"%, "+Math.round(_t(this._b,255)*100)+"%, "+this._roundA+")"},toName:function(){if(this._a===0)return"transparent";if(this._a<1)return!1;return DT[n0(this._r,this._g,this._b,!0)]||!1},toFilter:function(t){var n="#"+i0(this._r,this._g,this._b,this._a),i=n,r=this._gradientType?"GradientType = 1, ":"";if(t){var s=Te(t);i="#"+i0(s._r,s._g,s._b,s._a)}return"progid:DXImageTransform.Microsoft.gradient("+r+"startColorstr="+n+",endColorstr="+i+")"},toString:function(t){var n=!!t;t=t||this._format;var i=!1,r=this._a<1&&this._a>=0,s=!n&&r&&(t==="hex"||t==="hex6"||t==="hex3"||t==="hex4"||t==="hex8"||t==="name");if(s){if(t==="name"&&this._a===0)return this.toName();return this.toRgbString()}if(t==="rgb")i=this.toRgbString();if(t==="prgb")i=this.toPercentageRgbString();if(t==="hex"||t==="hex6")i=this.toHexString();if(t==="hex3")i=this.toHexString(!0);if(t==="hex4")i=this.toHex8String(!0);if(t==="hex8")i=this.toHex8String();if(t==="name")i=this.toName();if(t==="hsl")i=this.toHslString();if(t==="hsv")i=this.toHsvString();return i||this.toHexString()},clone:function(){return Te(this.toString())},_applyModification:function(t,n){var i=t.apply(null,[this].concat([].slice.call(n)));return this._r=i._r,this._g=i._g,this._b=i._b,this.setAlpha(i._a),this},lighten:function(){return this._applyModification(TT,arguments)},brighten:function(){return this._applyModification(ET,arguments)},darken:function(){return this._applyModification(AT,arguments)},desaturate:function(){return this._applyModification(ST,arguments)},saturate:function(){return this._applyModification(MT,arguments)},greyscale:function(){return this._applyModification(wT,arguments)},spin:function(){return this._applyModification(CT,arguments)},_applyCombination:function(t,n){return t.apply(null,[this].concat([].slice.call(n)))},analogous:function(){return this._applyCombination(IT,arguments)},complement:function(){return this._applyCombination(RT,arguments)},monochromatic:function(){return this._applyCombination(LT,arguments)},splitcomplement:function(){return this._applyCombination(PT,arguments)},triad:function(){return this._applyCombination(r0,[3])},tetrad:function(){return this._applyCombination(r0,[4])}};Te.fromRatio=function(e,t){if(sl(e)=="object"){var n={};for(var i in e)if(e.hasOwnProperty(i))if(i==="a")n[i]=e[i];else n[i]=fo(e[i]);e=n}return Te(e,t)};function _T(e){var t={r:0,g:0,b:0},n=1,i=null,r=null,s=null,o=!1,a=!1;if(typeof e=="string")e=FT(e);if(sl(e)=="object"){if(ci(e.r)&&ci(e.g)&&ci(e.b))t=vT(e.r,e.g,e.b),o=!0,a=String(e.r).substr(-1)==="%"?"prgb":"rgb";else if(ci(e.h)&&ci(e.s)&&ci(e.v))i=fo(e.s),r=fo(e.v),t=xT(e.h,i,r),o=!0,a="hsv";else if(ci(e.h)&&ci(e.s)&&ci(e.l))i=fo(e.s),s=fo(e.l),t=yT(e.h,i,s),o=!0,a="hsl";if(e.hasOwnProperty("a"))n=e.a}return n=o0(n),{ok:o,format:e.format||a,r:Math.min(255,Math.max(t.r,0)),g:Math.min(255,Math.max(t.g,0)),b:Math.min(255,Math.max(t.b,0)),a:n}}function vT(e,t,n){return{r:_t(e,255)*255,g:_t(t,255)*255,b:_t(n,255)*255}}function e0(e,t,n){e=_t(e,255),t=_t(t,255),n=_t(n,255);var i=Math.max(e,t,n),r=Math.min(e,t,n),s,o,a=(i+r)/2;if(i==r)s=o=0;else{var l=i-r;switch(o=a>0.5?l/(2-i-r):l/(i+r),i){case e:s=(t-n)/l+(t<n?6:0);break;case t:s=(n-e)/l+2;break;case n:s=(e-t)/l+4;break}s/=6}return{h:s,s:o,l:a}}function yT(e,t,n){var i,r,s;e=_t(e,360),t=_t(t,100),n=_t(n,100);function o(c,u,f){if(f<0)f+=1;if(f>1)f-=1;if(f<0.16666666666666666)return c+(u-c)*6*f;if(f<0.5)return u;if(f<0.6666666666666666)return c+(u-c)*(0.6666666666666666-f)*6;return c}if(t===0)i=r=s=n;else{var a=n<0.5?n*(1+t):n+t-n*t,l=2*n-a;i=o(l,a,e+0.3333333333333333),r=o(l,a,e),s=o(l,a,e-0.3333333333333333)}return{r:i*255,g:r*255,b:s*255}}function t0(e,t,n){e=_t(e,255),t=_t(t,255),n=_t(n,255);var i=Math.max(e,t,n),r=Math.min(e,t,n),s,o,a=i,l=i-r;if(o=i===0?0:l/i,i==r)s=0;else{switch(i){case e:s=(t-n)/l+(t<n?6:0);break;case t:s=(n-e)/l+2;break;case n:s=(e-t)/l+4;break}s/=6}return{h:s,s:o,v:a}}function xT(e,t,n){e=_t(e,360)*6,t=_t(t,100),n=_t(n,100);var i=Math.floor(e),r=e-i,s=n*(1-t),o=n*(1-r*t),a=n*(1-(1-r)*t),l=i%6,c=[n,o,s,s,a,n][l],u=[a,n,n,o,s,s][l],f=[s,s,a,n,n,o][l];return{r:c*255,g:u*255,b:f*255}}function n0(e,t,n,i){var r=[Un(Math.round(e).toString(16)),Un(Math.round(t).toString(16)),Un(Math.round(n).toString(16))];if(i&&r[0].charAt(0)==r[0].charAt(1)&&r[1].charAt(0)==r[1].charAt(1)&&r[2].charAt(0)==r[2].charAt(1))return r[0].charAt(0)+r[1].charAt(0)+r[2].charAt(0);return r.join("")}function bT(e,t,n,i,r){var s=[Un(Math.round(e).toString(16)),Un(Math.round(t).toString(16)),Un(Math.round(n).toString(16)),Un(a0(i))];if(r&&s[0].charAt(0)==s[0].charAt(1)&&s[1].charAt(0)==s[1].charAt(1)&&s[2].charAt(0)==s[2].charAt(1)&&s[3].charAt(0)==s[3].charAt(1))return s[0].charAt(0)+s[1].charAt(0)+s[2].charAt(0)+s[3].charAt(0);return s.join("")}function i0(e,t,n,i){var r=[Un(a0(i)),Un(Math.round(e).toString(16)),Un(Math.round(t).toString(16)),Un(Math.round(n).toString(16))];return r.join("")}Te.equals=function(e,t){if(!e||!t)return!1;return Te(e).toRgbString()==Te(t).toRgbString()};Te.random=function(){return Te.fromRatio({r:Math.random(),g:Math.random(),b:Math.random()})};function ST(e,t){t=t===0?0:t||10;var n=Te(e).toHsl();return n.s-=t/100,n.s=ol(n.s),Te(n)}function MT(e,t){t=t===0?0:t||10;var n=Te(e).toHsl();return n.s+=t/100,n.s=ol(n.s),Te(n)}function wT(e){return Te(e).desaturate(100)}function TT(e,t){t=t===0?0:t||10;var n=Te(e).toHsl();return n.l+=t/100,n.l=ol(n.l),Te(n)}function ET(e,t){t=t===0?0:t||10;var n=Te(e).toRgb();return n.r=Math.max(0,Math.min(255,n.r-Math.round(255*-(t/100)))),n.g=Math.max(0,Math.min(255,n.g-Math.round(255*-(t/100)))),n.b=Math.max(0,Math.min(255,n.b-Math.round(255*-(t/100)))),Te(n)}function AT(e,t){t=t===0?0:t||10;var n=Te(e).toHsl();return n.l-=t/100,n.l=ol(n.l),Te(n)}function CT(e,t){var n=Te(e).toHsl(),i=(n.h+t)%360;return n.h=i<0?360+i:i,Te(n)}function RT(e){var t=Te(e).toHsl();return t.h=(t.h+180)%360,Te(t)}function r0(e,t){if(isNaN(t)||t<=0)throw Error("Argument to polyad must be a positive number");var n=Te(e).toHsl(),i=[Te(e)],r=360/t;for(var s=1;s<t;s++)i.push(Te({h:(n.h+s*r)%360,s:n.s,l:n.l}));return i}function PT(e){var t=Te(e).toHsl(),n=t.h;return[Te(e),Te({h:(n+72)%360,s:t.s,l:t.l}),Te({h:(n+216)%360,s:t.s,l:t.l})]}function IT(e,t,n){t=t||6,n=n||30;var i=Te(e).toHsl(),r=360/n,s=[Te(e)];for(i.h=(i.h-(r*t>>1)+720)%360;--t;)i.h=(i.h+r)%360,s.push(Te(i));return s}function LT(e,t){t=t||6;var n=Te(e).toHsv(),{h:i,s:r,v:s}=n,o=[],a=1/t;while(t--)o.push(Te({h:i,s:r,v:s})),s=(s+a)%1;return o}Te.mix=function(e,t,n){n=n===0?0:n||50;var i=Te(e).toRgb(),r=Te(t).toRgb(),s=n/100,o={r:(r.r-i.r)*s+i.r,g:(r.g-i.g)*s+i.g,b:(r.b-i.b)*s+i.b,a:(r.a-i.a)*s+i.a};return Te(o)};Te.readability=function(e,t){var n=Te(e),i=Te(t);return(Math.max(n.getLuminance(),i.getLuminance())+0.05)/(Math.min(n.getLuminance(),i.getLuminance())+0.05)};Te.isReadable=function(e,t,n){var i=Te.readability(e,t),r,s;switch(s=!1,r=BT(n),r.level+r.size){case"AAsmall":case"AAAlarge":s=i>=4.5;break;case"AAlarge":s=i>=3;break;case"AAAsmall":s=i>=7;break}return s};Te.mostReadable=function(e,t,n){var i=null,r=0,s,o,a,l;n=n||{},o=n.includeFallbackColors,a=n.level,l=n.size;for(var c=0;c<t.length;c++)if(s=Te.readability(e,t[c]),s>r)r=s,i=Te(t[c]);if(Te.isReadable(e,i,{level:a,size:l})||!o)return i;else return n.includeFallbackColors=!1,Te.mostReadable(e,["#fff","#000"],n)};var pf=Te.names={aliceblue:"f0f8ff",antiquewhite:"faebd7",aqua:"0ff",aquamarine:"7fffd4",azure:"f0ffff",beige:"f5f5dc",bisque:"ffe4c4",black:"000",blanchedalmond:"ffebcd",blue:"00f",blueviolet:"8a2be2",brown:"a52a2a",burlywood:"deb887",burntsienna:"ea7e5d",cadetblue:"5f9ea0",chartreuse:"7fff00",chocolate:"d2691e",coral:"ff7f50",cornflowerblue:"6495ed",cornsilk:"fff8dc",crimson:"dc143c",cyan:"0ff",darkblue:"00008b",darkcyan:"008b8b",darkgoldenrod:"b8860b",darkgray:"a9a9a9",darkgreen:"006400",darkgrey:"a9a9a9",darkkhaki:"bdb76b",darkmagenta:"8b008b",darkolivegreen:"556b2f",darkorange:"ff8c00",darkorchid:"9932cc",darkred:"8b0000",darksalmon:"e9967a",darkseagreen:"8fbc8f",darkslateblue:"483d8b",darkslategray:"2f4f4f",darkslategrey:"2f4f4f",darkturquoise:"00ced1",darkviolet:"9400d3",deeppink:"ff1493",deepskyblue:"00bfff",dimgray:"696969",dimgrey:"696969",dodgerblue:"1e90ff",firebrick:"b22222",floralwhite:"fffaf0",forestgreen:"228b22",fuchsia:"f0f",gainsboro:"dcdcdc",ghostwhite:"f8f8ff",gold:"ffd700",goldenrod:"daa520",gray:"808080",green:"008000",greenyellow:"adff2f",grey:"808080",honeydew:"f0fff0",hotpink:"ff69b4",indianred:"cd5c5c",indigo:"4b0082",ivory:"fffff0",khaki:"f0e68c",lavender:"e6e6fa",lavenderblush:"fff0f5",lawngreen:"7cfc00",lemonchiffon:"fffacd",lightblue:"add8e6",lightcoral:"f08080",lightcyan:"e0ffff",lightgoldenrodyellow:"fafad2",lightgray:"d3d3d3",lightgreen:"90ee90",lightgrey:"d3d3d3",lightpink:"ffb6c1",lightsalmon:"ffa07a",lightseagreen:"20b2aa",lightskyblue:"87cefa",lightslategray:"789",lightslategrey:"789",lightsteelblue:"b0c4de",lightyellow:"ffffe0",lime:"0f0",limegreen:"32cd32",linen:"faf0e6",magenta:"f0f",maroon:"800000",mediumaquamarine:"66cdaa",mediumblue:"0000cd",mediumorchid:"ba55d3",mediumpurple:"9370db",mediumseagreen:"3cb371",mediumslateblue:"7b68ee",mediumspringgreen:"00fa9a",mediumturquoise:"48d1cc",mediumvioletred:"c71585",midnightblue:"191970",mintcream:"f5fffa",mistyrose:"ffe4e1",moccasin:"ffe4b5",navajowhite:"ffdead",navy:"000080",oldlace:"fdf5e6",olive:"808000",olivedrab:"6b8e23",orange:"ffa500",orangered:"ff4500",orchid:"da70d6",palegoldenrod:"eee8aa",palegreen:"98fb98",paleturquoise:"afeeee",palevioletred:"db7093",papayawhip:"ffefd5",peachpuff:"ffdab9",peru:"cd853f",pink:"ffc0cb",plum:"dda0dd",powderblue:"b0e0e6",purple:"800080",rebeccapurple:"663399",red:"f00",rosybrown:"bc8f8f",royalblue:"4169e1",saddlebrown:"8b4513",salmon:"fa8072",sandybrown:"f4a460",seagreen:"2e8b57",seashell:"fff5ee",sienna:"a0522d",silver:"c0c0c0",skyblue:"87ceeb",slateblue:"6a5acd",slategray:"708090",slategrey:"708090",snow:"fffafa",springgreen:"00ff7f",steelblue:"4682b4",tan:"d2b48c",teal:"008080",thistle:"d8bfd8",tomato:"ff6347",turquoise:"40e0d0",violet:"ee82ee",wheat:"f5deb3",white:"fff",whitesmoke:"f5f5f5",yellow:"ff0",yellowgreen:"9acd32"},DT=Te.hexNames=NT(pf);function NT(e){var t={};for(var n in e)if(e.hasOwnProperty(n))t[e[n]]=n;return t}function o0(e){if(e=parseFloat(e),isNaN(e)||e<0||e>1)e=1;return e}function _t(e,t){if(OT(e))e="100%";var n=UT(e);if(e=Math.min(t,Math.max(0,parseFloat(e))),n)e=parseInt(e*t,10)/100;if(Math.abs(e-t)<0.000001)return 1;return e%t/parseFloat(t)}function ol(e){return Math.min(1,Math.max(0,e))}function gn(e){return parseInt(e,16)}function OT(e){return typeof e=="string"&&e.indexOf(".")!=-1&&parseFloat(e)===1}function UT(e){return typeof e==="string"&&e.indexOf("%")!=-1}function Un(e){return e.length==1?"0"+e:""+e}function fo(e){if(e<=1)e=e*100+"%";return e}function a0(e){return Math.round(parseFloat(e)*255).toString(16)}function s0(e){return gn(e)/255}var On=function(){var e="[-\\+]?\\d+%?",t="[-\\+]?\\d*\\.\\d+%?",n="(?:"+t+")|(?:"+e+")",i="[\\s|\\(]+("+n+")[,|\\s]+("+n+")[,|\\s]+("+n+")\\s*\\)?",r="[\\s|\\(]+("+n+")[,|\\s]+("+n+")[,|\\s]+("+n+")[,|\\s]+("+n+")\\s*\\)?";return{CSS_UNIT:new RegExp(n),rgb:new RegExp("rgb"+i),rgba:new RegExp("rgba"+r),hsl:new RegExp("hsl"+i),hsla:new RegExp("hsla"+r),hsv:new RegExp("hsv"+i),hsva:new RegExp("hsva"+r),hex3:/^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,hex6:/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,hex4:/^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,hex8:/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/}}();function ci(e){return!!On.CSS_UNIT.exec(e)}function FT(e){e=e.replace(mT,"").replace(gT,"").toLowerCase();var t=!1;if(pf[e])e=pf[e],t=!0;else if(e=="transparent")return{r:0,g:0,b:0,a:0,format:"name"};var n;if(n=On.rgb.exec(e))return{r:n[1],g:n[2],b:n[3]};if(n=On.rgba.exec(e))return{r:n[1],g:n[2],b:n[3],a:n[4]};if(n=On.hsl.exec(e))return{h:n[1],s:n[2],l:n[3]};if(n=On.hsla.exec(e))return{h:n[1],s:n[2],l:n[3],a:n[4]};if(n=On.hsv.exec(e))return{h:n[1],s:n[2],v:n[3]};if(n=On.hsva.exec(e))return{h:n[1],s:n[2],v:n[3],a:n[4]};if(n=On.hex8.exec(e))return{r:gn(n[1]),g:gn(n[2]),b:gn(n[3]),a:s0(n[4]),format:t?"name":"hex8"};if(n=On.hex6.exec(e))return{r:gn(n[1]),g:gn(n[2]),b:gn(n[3]),format:t?"name":"hex"};if(n=On.hex4.exec(e))return{r:gn(n[1]+""+n[1]),g:gn(n[2]+""+n[2]),b:gn(n[3]+""+n[3]),a:s0(n[4]+""+n[4]),format:t?"name":"hex8"};if(n=On.hex3.exec(e))return{r:gn(n[1]+""+n[1]),g:gn(n[2]+""+n[2]),b:gn(n[3]+""+n[3]),format:t?"name":"hex"};return!1}function BT(e){var t,n;if(e=e||{level:"AA",size:"small"},t=(e.level||"AA").toUpperCase(),n=(e.size||"small").toLowerCase(),t!=="AA"&&t!=="AAA")t="AA";if(n!=="small"&&n!=="large")n="small";return{level:t,size:n}}var f0=(e)=>{if(e instanceof Array)e.forEach(f0);else{if(e.map)e.map.dispose();e.dispose()}},_f=(e)=>{if(e.geometry)e.geometry.dispose();if(e.material)f0(e.material);if(e.texture)e.texture.dispose();if(e.children)e.children.forEach(_f)},l0=(e)=>{while(e.children.length){let t=e.children[0];e.remove(t),_f(t)}};class is extends K_{constructor(e,{dataBindAttr:t="__data",objBindAttr:n="__threeObj"}={}){super();this.scene=e,this.#t=t,this.#e=n,this.onRemoveObj(()=>{})}onCreateObj(e){return super.onCreateObj((t)=>{let n=e(t);return t[this.#e]=n,n[this.#t]=t,this.scene.add(n),n}),this}onRemoveObj(e){return super.onRemoveObj((t,n)=>{let i=super.getData(t);e(t,n),this.scene.remove(t),_f(t),delete i[this.#e]}),this}scene;#t;#e}var po=(e)=>isNaN(e)?parseInt(Te(e).toHex(),16):e,mf=(e)=>isNaN(e)?Te(e).getAlpha():1,kT=uo(df);function c0(e,t,n){if(!t||typeof n!=="string")return;e.filter((i)=>!i[n]).forEach((i)=>{i[n]=kT(t(i))})}function zT({nodes:e,links:t},n,{nodeFilter:i=()=>!0,onLoopError:r=(s)=>{throw`Invalid DAG structure! Found cycle in node path: ${s.join(" -> ")}.`}}={}){let s={};e.forEach((c)=>s[n(c)]={data:c,out:[],depth:-1,skip:!i(c)}),t.forEach(({source:c,target:u})=>{let f=_(c),h=_(u);if(!s.hasOwnProperty(f))throw`Missing source node with id: ${f}`;if(!s.hasOwnProperty(h))throw`Missing target node with id: ${h}`;let d=s[f],g=s[h];d.out.push(g);function _(m){return typeof m==="object"?n(m):m}});let o=[];return l(Object.values(s)),Object.assign({},...Object.entries(s).filter(([,c])=>!c.skip).map(([c,u])=>({[c]:u.depth})));function l(c,u=[],f=0){for(let h=0,d=c.length;h<d;h++){let g=c[h];if(u.indexOf(g)!==-1){let _=[...u.slice(u.indexOf(g)),g].map((m)=>n(m.data));if(!o.some((m)=>m.length===_.length&&m.every((p,x)=>p===_[x])))o.push(_),r(_);continue}if(f>g.depth)g.depth=f,l(g.out,[...u,g],f+(g.skip?0:1))}}}var Oe=window.THREE?window.THREE:{Group:zn,Mesh:Bt,MeshLambertMaterial:Ca,Color:Le,BufferGeometry:xt,BufferAttribute:Qt,Matrix4:Je,Vector3:L,SphereGeometry:Si,CylinderGeometry:Ji,TubeGeometry:Vs,ConeGeometry:zs,Line:Xr,LineBasicMaterial:Wr,QuadraticBezierCurve3:qr,CubicBezierCurve3:Gs,Box3:Ln},h0={graph:n_,forcelayout:u0.default},GT=2,gf=new Oe.BufferGeometry().setAttribute?"setAttribute":"addAttribute",al=new Oe.BufferGeometry().applyMatrix4?"applyMatrix4":"applyMatrix",HT=Ei({props:{jsonUrl:{onChange:function(e,t){if(e&&!t.fetchingJson)t.fetchingJson=!0,t.onLoading(),fetch(e).then((n)=>n.json()).then((n)=>{t.fetchingJson=!1,t.onFinishLoading(n),this.graphData(n)})},triggerUpdate:!1},graphData:{default:{nodes:[],links:[]},onChange(e,t){t.engineRunning=!1}},numDimensions:{default:3,onChange(e,t){let n=t.d3ForceLayout.force("charge");if(n)n.strength(e>2?-60:-30);if(e<3)i(t.graphData.nodes,"z");if(e<2)i(t.graphData.nodes,"y");function i(r,s){r.forEach((o)=>{delete o[s],delete o[`v${s}`]})}}},dagMode:{onChange(e,t){!e&&t.forceEngine==="d3"&&(t.graphData.nodes||[]).forEach((n)=>n.fx=n.fy=n.fz=void 0)}},dagLevelDistance:{},dagNodeFilter:{default:(e)=>!0},onDagError:{triggerUpdate:!1},nodeRelSize:{default:4},nodeId:{default:"id"},nodeVal:{default:"val"},nodeResolution:{default:8},nodeColor:{default:"color"},nodeAutoColorBy:{},nodeOpacity:{default:0.75},nodeVisibility:{default:!0},nodeThreeObject:{},nodeThreeObjectExtend:{default:!1},nodePositionUpdate:{triggerUpdate:!1},linkSource:{default:"source"},linkTarget:{default:"target"},linkVisibility:{default:!0},linkColor:{default:"color"},linkAutoColorBy:{},linkOpacity:{default:0.2},linkWidth:{},linkResolution:{default:6},linkCurvature:{default:0,triggerUpdate:!1},linkCurveRotation:{default:0,triggerUpdate:!1},linkMaterial:{},linkThreeObject:{},linkThreeObjectExtend:{default:!1},linkPositionUpdate:{triggerUpdate:!1},linkDirectionalArrowLength:{default:0},linkDirectionalArrowColor:{},linkDirectionalArrowRelPos:{default:0.5,triggerUpdate:!1},linkDirectionalArrowResolution:{default:8},linkDirectionalParticles:{default:0},linkDirectionalParticleSpeed:{default:0.01,triggerUpdate:!1},linkDirectionalParticleOffset:{default:0,triggerUpdate:!1},linkDirectionalParticleWidth:{default:0.5},linkDirectionalParticleColor:{},linkDirectionalParticleResolution:{default:4},linkDirectionalParticleThreeObject:{},forceEngine:{default:"d3"},d3AlphaMin:{default:0},d3AlphaDecay:{default:0.0228,triggerUpdate:!1,onChange(e,t){t.d3ForceLayout.alphaDecay(e)}},d3AlphaTarget:{default:0,triggerUpdate:!1,onChange(e,t){t.d3ForceLayout.alphaTarget(e)}},d3VelocityDecay:{default:0.4,triggerUpdate:!1,onChange(e,t){t.d3ForceLayout.velocityDecay(e)}},ngraphPhysics:{default:{timeStep:20,gravity:-1.2,theta:0.8,springLength:30,springCoefficient:0.0008,dragCoefficient:0.02}},warmupTicks:{default:0,triggerUpdate:!1},cooldownTicks:{default:1/0,triggerUpdate:!1},cooldownTime:{default:15000,triggerUpdate:!1},onLoading:{default:()=>{},triggerUpdate:!1},onFinishLoading:{default:()=>{},triggerUpdate:!1},onUpdate:{default:()=>{},triggerUpdate:!1},onFinishUpdate:{default:()=>{},triggerUpdate:!1},onEngineTick:{default:()=>{},triggerUpdate:!1},onEngineStop:{default:()=>{},triggerUpdate:!1}},methods:{refresh:function(e){return e._flushObjects=!0,e._rerender(),this},d3Force:function(e,t,n){if(n===void 0)return e.d3ForceLayout.force(t);return e.d3ForceLayout.force(t,n),this},d3ReheatSimulation:function(e){return e.d3ForceLayout.alpha(1),this.resetCountdown(),this},resetCountdown:function(e){return e.cntTicks=0,e.startTickTime=new Date,e.engineRunning=!0,this},tickFrame:function(e){let t=e.forceEngine!=="ngraph";if(e.engineRunning&&e.layout)n();return i(),r(),this;function n(){if(++e.cntTicks>e.cooldownTicks||new Date-e.startTickTime>e.cooldownTime||t&&e.d3AlphaMin>0&&e.d3ForceLayout.alpha()<e.d3AlphaMin)e.engineRunning=!1,e.onEngineStop();else e.layout[t?"tick":"step"](),e.onEngineTick();let s=ze(e.nodeThreeObjectExtend);e.nodeDataMapper.entries().forEach(([f,h])=>{if(!h)return;let d=t?f:e.layout.getNodePosition(f[e.nodeId]),g=s(f);if(!e.nodePositionUpdate||!e.nodePositionUpdate(g?h.children[0]:h,{x:d.x,y:d.y,z:d.z},f)||g)h.position.x=d.x,h.position.y=d.y||0,h.position.z=d.z||0});let o=ze(e.linkWidth),a=ze(e.linkCurvature),l=ze(e.linkCurveRotation),c=ze(e.linkThreeObjectExtend);e.linkDataMapper.entries().forEach(([f,h])=>{if(!h)return;let d=t?f:e.layout.getLinkPosition(e.layout.graph.getLink(f.source,f.target).id),g=d[t?"source":"from"],_=d[t?"target":"to"];if(!g||!_||!g.hasOwnProperty("x")||!_.hasOwnProperty("x"))return;u(f);let m=c(f);if(e.linkPositionUpdate&&e.linkPositionUpdate(m?h.children[1]:h,{start:{x:g.x,y:g.y,z:g.z},end:{x:_.x,y:_.y,z:_.z}},f)&&!m)return;let p=30,x=f.__curve,S=h.children.length?h.children[0]:h;if(S.type==="Line"){if(!x){let v=S.geometry.getAttribute("position");if(!v||!v.array||v.array.length!==6)S.geometry[gf]("position",v=new Oe.BufferAttribute(new Float32Array(6),3));v.array[0]=g.x,v.array[1]=g.y||0,v.array[2]=g.z||0,v.array[3]=_.x,v.array[4]=_.y||0,v.array[5]=_.z||0,v.needsUpdate=!0}else{let v=x.getPoints(p);if(S.geometry.getAttribute("position").array.length!==v.length*3)S.geometry[gf]("position",new Oe.BufferAttribute(new Float32Array(v.length*3),3));S.geometry.setFromPoints(v)}S.geometry.computeBoundingSphere()}else if(S.type==="Mesh")if(!x){if(!S.geometry.type.match(/^Cylinder(Buffer)?Geometry$/)){let y=Math.ceil(o(f)*10)/10/2,A=new Oe.CylinderGeometry(y,y,1,e.linkResolution,1,!1);A[al](new Oe.Matrix4().makeTranslation(0,0.5,0)),A[al](new Oe.Matrix4().makeRotationX(Math.PI/2)),S.geometry.dispose(),S.geometry=A}let v=new Oe.Vector3(g.x,g.y||0,g.z||0),b=new Oe.Vector3(_.x,_.y||0,_.z||0),w=v.distanceTo(b);S.position.x=v.x,S.position.y=v.y,S.position.z=v.z,S.scale.z=w,S.parent.localToWorld(b),S.lookAt(b)}else{if(!S.geometry.type.match(/^Tube(Buffer)?Geometry$/))S.position.set(0,0,0),S.rotation.set(0,0,0),S.scale.set(1,1,1);let b=Math.ceil(o(f)*10)/10/2,w=new Oe.TubeGeometry(x,p,b,e.linkResolution,!1);S.geometry.dispose(),S.geometry=w}});function u(f){let h=t?f:e.layout.getLinkPosition(e.layout.graph.getLink(f.source,f.target).id),d=h[t?"source":"from"],g=h[t?"target":"to"];if(!d||!g||!d.hasOwnProperty("x")||!g.hasOwnProperty("x"))return;let _=a(f);if(!_)f.__curve=null;else{let m=new Oe.Vector3(d.x,d.y||0,d.z||0),p=new Oe.Vector3(g.x,g.y||0,g.z||0),x=m.distanceTo(p),S,v=l(f);if(x>0){let b=g.x-d.x,w=g.y-d.y||0,E=new Oe.Vector3().subVectors(p,m),y=E.clone().multiplyScalar(_).cross(b!==0||w!==0?new Oe.Vector3(0,0,1):new Oe.Vector3(0,1,0)).applyAxisAngle(E.normalize(),v).add(new Oe.Vector3().addVectors(m,p).divideScalar(2));S=new Oe.QuadraticBezierCurve3(m,y,p)}else{let b=_*70,w=-v,E=w+Math.PI/2;S=new Oe.CubicBezierCurve3(m,new Oe.Vector3(b*Math.cos(E),b*Math.sin(E),0).add(m),new Oe.Vector3(b*Math.cos(w),b*Math.sin(w),0).add(m),p)}f.__curve=S}}}function i(){let s=ze(e.linkDirectionalArrowRelPos),o=ze(e.linkDirectionalArrowLength),a=ze(e.nodeVal);e.arrowDataMapper.entries().forEach(([l,c])=>{if(!c)return;let u=t?l:e.layout.getLinkPosition(e.layout.graph.getLink(l.source,l.target).id),f=u[t?"source":"from"],h=u[t?"target":"to"];if(!f||!h||!f.hasOwnProperty("x")||!h.hasOwnProperty("x"))return;let d=Math.cbrt(Math.max(0,a(f)||1))*e.nodeRelSize,g=Math.cbrt(Math.max(0,a(h)||1))*e.nodeRelSize,_=o(l),m=s(l),p=l.__curve?(E)=>l.__curve.getPoint(E):(E)=>{let y=(A,N,P,D)=>N[A]+(P[A]-N[A])*D||0;return{x:y("x",f,h,E),y:y("y",f,h,E),z:y("z",f,h,E)}},x=l.__curve?l.__curve.getLength():Math.sqrt(["x","y","z"].map((E)=>Math.pow((h[E]||0)-(f[E]||0),2)).reduce((E,y)=>E+y,0)),S=d+_+(x-d-g-_)*m,v=p(S/x),b=p((S-_)/x);["x","y","z"].forEach((E)=>c.position[E]=b[E]);let w=new Oe.Vector3(...["x","y","z"].map((E)=>v[E]));c.parent.localToWorld(w),c.lookAt(w)})}function r(){let s=ze(e.linkDirectionalParticleSpeed),o=ze(e.linkDirectionalParticleOffset);e.graphData.links.forEach((a)=>{let l=e.particlesDataMapper.getObj(a),c=l&&l.children,u=a.__singleHopPhotonsObj&&a.__singleHopPhotonsObj.children;if((!u||!u.length)&&(!c||!c.length))return;let f=t?a:e.layout.getLinkPosition(e.layout.graph.getLink(a.source,a.target).id),h=f[t?"source":"from"],d=f[t?"target":"to"];if(!h||!d||!h.hasOwnProperty("x")||!d.hasOwnProperty("x"))return;let g=s(a),_=Math.abs(o(a)),m=a.__curve?(x)=>a.__curve.getPoint(x):(x)=>{let S=(v,b,w,E)=>b[v]+(w[v]-b[v])*E||0;return{x:S("x",h,d,x),y:S("y",h,d,x),z:S("z",h,d,x)}};[...c||[],...u||[]].forEach((x,S)=>{let v=x.parent.__linkThreeObjType==="singleHopPhotons";if(!x.hasOwnProperty("__progressRatio"))x.__progressRatio=v?g<0?1:0:(S+_)/c.length;if(x.__progressRatio+=g,x.__progressRatio>=1||x.__progressRatio<0)if(!v)x.__progressRatio=x.__progressRatio%1,x.__progressRatio<0&&x.__progressRatio++;else{x.parent.remove(x),l0(x);return}let b=x.__progressRatio,w=m(b);x.geometry.type!=="SphereGeometry"&&x.lookAt(w.x,w.y,w.z),["x","y","z"].forEach((E)=>x.position[E]=w[E])})})}},emitParticle:function(e,t){if(t&&e.graphData.links.includes(t)){if(!t.__singleHopPhotonsObj){let i=new Oe.Group;i.__linkThreeObjType="singleHopPhotons",t.__singleHopPhotonsObj=i,e.graphScene.add(i)}let n=ze(e.linkDirectionalParticleThreeObject)(t);if(n&&e.linkDirectionalParticleThreeObject===n)n=n.clone();if(!n){let i=ze(e.linkDirectionalParticleWidth),r=Math.ceil(i(t)*10)/10/2,s=e.linkDirectionalParticleResolution,o=new Oe.SphereGeometry(r,s,s),a=ze(e.linkColor),c=ze(e.linkDirectionalParticleColor)(t)||a(t)||"#f0f0f0",u=new Oe.Color(po(c)),f=e.linkOpacity*3,h=new Oe.MeshLambertMaterial({color:u,transparent:!0,opacity:f});n=new Oe.Mesh(o,h)}t.__singleHopPhotonsObj.add(n)}return this},getGraphBbox:function(e,t=()=>!0){if(!e.initialised)return null;let n=function i(r){let s=[];if(r.geometry){r.geometry.computeBoundingBox();let o=new Oe.Box3;o.copy(r.geometry.boundingBox).applyMatrix4(r.matrixWorld),s.push(o)}return s.concat(...(r.children||[]).filter((o)=>!o.hasOwnProperty("__graphObjType")||o.__graphObjType==="node"&&t(o.__data)).map(i))}(e.graphScene);if(!n.length)return null;return Object.assign(...["x","y","z"].map((i)=>({[i]:[il(n,(r)=>r.min[i]),nl(n,(r)=>r.max[i])]})))}},stateInit:()=>({d3ForceLayout:$a().force("link",Ha()).force("charge",Za()).force("center",Ga()).force("dagRadial",null).stop(),engineRunning:!1}),init(e,t){t.graphScene=e,t.nodeDataMapper=new is(e,{objBindAttr:"__threeObj"}),t.linkDataMapper=new is(e,{objBindAttr:"__lineObj"}),t.arrowDataMapper=new is(e,{objBindAttr:"__arrowObj"}),t.particlesDataMapper=new is(e,{objBindAttr:"__photonsObj"})},update(e,t){let n=(i)=>i.some((r)=>t.hasOwnProperty(r));if(e.engineRunning=!1,typeof e.onUpdate==="function"&&e.onUpdate(),e.nodeAutoColorBy!==null&&n(["nodeAutoColorBy","graphData","nodeColor"]))c0(e.graphData.nodes,ze(e.nodeAutoColorBy),e.nodeColor);if(e.linkAutoColorBy!==null&&n(["linkAutoColorBy","graphData","linkColor"]))c0(e.graphData.links,ze(e.linkAutoColorBy),e.linkColor);if(e._flushObjects||n(["graphData","nodeThreeObject","nodeThreeObjectExtend","nodeVal","nodeColor","nodeVisibility","nodeRelSize","nodeResolution","nodeOpacity"])){let i=ze(e.nodeThreeObject),r=ze(e.nodeThreeObjectExtend),s=ze(e.nodeVal),o=ze(e.nodeColor),a=ze(e.nodeVisibility),l={},c={};if(e._flushObjects||n(["nodeThreeObject","nodeThreeObjectExtend"]))e.nodeDataMapper.clear();e.nodeDataMapper.onCreateObj((u)=>{let f=i(u),h=r(u);if(f&&e.nodeThreeObject===f)f=f.clone();let d;if(f&&!h)d=f;else if(d=new Oe.Mesh,d.__graphDefaultObj=!0,f&&h)d.add(f);return d.__graphObjType="node",d}).onUpdateObj((u,f)=>{if(u.__graphDefaultObj){let h=s(f)||1,d=Math.cbrt(h)*e.nodeRelSize,g=e.nodeResolution;if(!u.geometry.type.match(/^Sphere(Buffer)?Geometry$/)||u.geometry.parameters.radius!==d||u.geometry.parameters.widthSegments!==g){if(!l.hasOwnProperty(h))l[h]=new Oe.SphereGeometry(d,g,g);u.geometry.dispose(),u.geometry=l[h]}let _=o(f),m=new Oe.Color(po(_||"#ffffaa")),p=e.nodeOpacity*mf(_);if(u.material.type!=="MeshLambertMaterial"||!u.material.color.equals(m)||u.material.opacity!==p){if(!c.hasOwnProperty(_))c[_]=new Oe.MeshLambertMaterial({color:m,transparent:!0,opacity:p});u.material.dispose(),u.material=c[_]}}}).digest(e.graphData.nodes.filter(a))}if(e._flushObjects||n(["graphData","linkThreeObject","linkThreeObjectExtend","linkMaterial","linkColor","linkWidth","linkVisibility","linkResolution","linkOpacity","linkDirectionalArrowLength","linkDirectionalArrowColor","linkDirectionalArrowResolution","linkDirectionalParticles","linkDirectionalParticleWidth","linkDirectionalParticleColor","linkDirectionalParticleResolution","linkDirectionalParticleThreeObject"])){let i=ze(e.linkThreeObject),r=ze(e.linkThreeObjectExtend),s=ze(e.linkMaterial),o=ze(e.linkVisibility),a=ze(e.linkColor),l=ze(e.linkWidth),c={},u={},f={},h=e.graphData.links.filter(o);if(e._flushObjects||n(["linkThreeObject","linkThreeObjectExtend","linkWidth"]))e.linkDataMapper.clear();if(e.linkDataMapper.onRemoveObj((d)=>{let g=d.__data&&d.__data.__singleHopPhotonsObj;if(g)g.parent.remove(g),l0(g),delete d.__data.__singleHopPhotonsObj}).onCreateObj((d)=>{let g=i(d),_=r(d);if(g&&e.linkThreeObject===g)g=g.clone();let m;if(!g||_)if(!!l(d))m=new Oe.Mesh;else{let S=new Oe.BufferGeometry;S[gf]("position",new Oe.BufferAttribute(new Float32Array(6),3)),m=new Oe.Line(S)}let p;if(!g)p=m,p.__graphDefaultObj=!0;else if(!_)p=g;else p=new Oe.Group,p.__graphDefaultObj=!0,p.add(m),p.add(g);return p.renderOrder=10,p.__graphObjType="link",p}).onUpdateObj((d,g)=>{if(d.__graphDefaultObj){let _=d.children.length?d.children[0]:d,m=Math.ceil(l(g)*10)/10,p=!!m;if(p){let S=m/2,v=e.linkResolution;if(!_.geometry.type.match(/^Cylinder(Buffer)?Geometry$/)||_.geometry.parameters.radiusTop!==S||_.geometry.parameters.radialSegments!==v){if(!c.hasOwnProperty(m)){let b=new Oe.CylinderGeometry(S,S,1,v,1,!1);b[al](new Oe.Matrix4().makeTranslation(0,0.5,0)),b[al](new Oe.Matrix4().makeRotationX(Math.PI/2)),c[m]=b}_.geometry.dispose(),_.geometry=c[m]}}let x=s(g);if(x)_.material=x;else{let S=a(g),v=new Oe.Color(po(S||"#f0f0f0")),b=e.linkOpacity*mf(S),w=p?"MeshLambertMaterial":"LineBasicMaterial";if(_.material.type!==w||!_.material.color.equals(v)||_.material.opacity!==b){let E=p?u:f;if(!E.hasOwnProperty(S))E[S]=new Oe[w]({color:v,transparent:b<1,opacity:b,depthWrite:b>=1});_.material.dispose(),_.material=E[S]}}}}).digest(h),e.linkDirectionalArrowLength||t.hasOwnProperty("linkDirectionalArrowLength")){let d=ze(e.linkDirectionalArrowLength),g=ze(e.linkDirectionalArrowColor);e.arrowDataMapper.onCreateObj(()=>{let _=new Oe.Mesh(void 0,new Oe.MeshLambertMaterial({transparent:!0}));return _.__linkThreeObjType="arrow",_}).onUpdateObj((_,m)=>{let p=d(m),x=e.linkDirectionalArrowResolution;if(!_.geometry.type.match(/^Cone(Buffer)?Geometry$/)||_.geometry.parameters.height!==p||_.geometry.parameters.radialSegments!==x){let v=new Oe.ConeGeometry(p*0.25,p,x);v.translate(0,p/2,0),v.rotateX(Math.PI/2),_.geometry.dispose(),_.geometry=v}let S=g(m)||a(m)||"#f0f0f0";_.material.color=new Oe.Color(po(S)),_.material.opacity=e.linkOpacity*3*mf(S)}).digest(h.filter(d))}if(e.linkDirectionalParticles||t.hasOwnProperty("linkDirectionalParticles")){let d=ze(e.linkDirectionalParticles),g=ze(e.linkDirectionalParticleWidth),_=ze(e.linkDirectionalParticleColor),m=ze(e.linkDirectionalParticleThreeObject),p={},x={};e.particlesDataMapper.onCreateObj(()=>{let S=new Oe.Group;return S.__linkThreeObjType="photons",S.__photonDataMapper=new is(S),S}).onUpdateObj((S,v)=>{let b=!!S.children.length&&S.children[0],w=m(v),E,y;if(w)E=w.geometry,y=w.material;else{let N=Math.ceil(g(v)*10)/10/2,P=e.linkDirectionalParticleResolution;if(b&&b.geometry.parameters.radius===N&&b.geometry.parameters.widthSegments===P)E=b.geometry;else{if(!x.hasOwnProperty(N))x[N]=new Oe.SphereGeometry(N,P,P);E=x[N]}let D=_(v)||a(v)||"#f0f0f0",W=new Oe.Color(po(D)),R=e.linkOpacity*3;if(b&&b.material.color.equals(W)&&b.material.opacity===R)y=b.material;else{if(!p.hasOwnProperty(D))p[D]=new Oe.MeshLambertMaterial({color:W,transparent:!0,opacity:R});y=p[D]}}if(b)b.geometry!==E&&b.geometry.dispose(),b.material!==y&&b.material.dispose();let A=Math.round(Math.abs(d(v)));S.__photonDataMapper.id((N)=>N.idx).onCreateObj(()=>new Oe.Mesh(E,y)).onUpdateObj((N)=>{N.geometry=E,N.material=y}).digest([...Array(A)].map((N,P)=>({idx:P})))}).digest(h.filter(d))}}if(e._flushObjects=!1,n(["graphData","nodeId","linkSource","linkTarget","numDimensions","forceEngine","dagMode","dagNodeFilter","dagLevelDistance"])){e.engineRunning=!1,e.graphData.links.forEach((s)=>{s.source=s[e.linkSource],s.target=s[e.linkTarget]});let i=e.forceEngine!=="ngraph",r;if(i){(r=e.d3ForceLayout).stop().alpha(1).numDimensions(e.numDimensions).nodes(e.graphData.nodes);let s=e.d3ForceLayout.force("link");if(s)s.id((c)=>c[e.nodeId]).links(e.graphData.links);let o=e.dagMode&&zT(e.graphData,(c)=>c[e.nodeId],{nodeFilter:e.dagNodeFilter,onLoopError:e.onDagError||void 0}),a=Math.max(...Object.values(o||[])),l=e.dagLevelDistance||e.graphData.nodes.length/(a||1)*GT*(["radialin","radialout"].indexOf(e.dagMode)!==-1?0.7:1);if(["lr","rl","td","bu","zin","zout"].includes(t.dagMode)){let c=["lr","rl"].includes(t.dagMode)?"fx":["td","bu"].includes(t.dagMode)?"fy":"fz";e.graphData.nodes.filter(e.dagNodeFilter).forEach((u)=>delete u[c])}if(["lr","rl","td","bu","zin","zout"].includes(e.dagMode)){let c=["rl","td","zout"].includes(e.dagMode),u=(h)=>(o[h[e.nodeId]]-a/2)*l*(c?-1:1),f=["lr","rl"].includes(e.dagMode)?"fx":["td","bu"].includes(e.dagMode)?"fy":"fz";e.graphData.nodes.filter(e.dagNodeFilter).forEach((h)=>h[f]=u(h))}e.d3ForceLayout.force("dagRadial",["radialin","radialout"].indexOf(e.dagMode)!==-1?Ja((c)=>{let u=o[c[e.nodeId]]||-1;return(e.dagMode==="radialin"?a-u:u)*l}).strength((c)=>e.dagNodeFilter(c)?1:0):null)}else{let s=h0.graph();e.graphData.nodes.forEach((o)=>{s.addNode(o[e.nodeId])}),e.graphData.links.forEach((o)=>{s.addLink(o.source,o.target)}),r=h0.forcelayout(s,{dimensions:e.numDimensions,...e.ngraphPhysics}),r.graph=s}for(let s=0;s<e.warmupTicks&&!(i&&e.d3AlphaMin>0&&e.d3ForceLayout.alpha()<e.d3AlphaMin);s++)r[i?"tick":"step"]();e.layout=r,this.resetCountdown()}e.engineRunning=!0,e.onFinishUpdate()}});function VT(e,t=Object,n=!1){class i extends t{constructor(...s){super(...s);this.__kapsuleInstance=new e(...[...n?[this]:[],...s])}}let r=e();return r._destructor?.(),Object.keys(r).forEach((s)=>i.prototype[s]=function(...o){let a=this.__kapsuleInstance[s](...o);return a===this.__kapsuleInstance?this:a}),i}var WT=window.THREE?window.THREE:{Group:zn},vf=VT(HT,WT.Group,!0);var yf={type:"change"},Sf={type:"start"},Mf={type:"end"},ll=0.000001,et={NONE:-1,ROTATE:0,ZOOM:1,PAN:2,TOUCH_ROTATE:3,TOUCH_ZOOM_PAN:4},cl=new ne,Ai=new ne,XT=new L,hl=new L,xf=new L,Ci=new Gt,ul=new L,fl=new L,bf=new L,dl=new L;class wf extends Wn{constructor(e,t=null){super(e,t);if(this.screen={left:0,top:0,width:0,height:0},this.rotateSpeed=1,this.zoomSpeed=1.2,this.panSpeed=0.3,this.rollSpeed=1,this.noRotate=!1,this.noZoom=!1,this.noPan=!1,this.multiTouchRoll=!1,this.staticMoving=!1,this.dynamicDampingFactor=0.2,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.keys=["KeyA","KeyS","KeyD"],this.mouseButtons={LEFT:Mt.ROTATE,MIDDLE:Mt.DOLLY,RIGHT:Mt.PAN},this.target=new L,this.state=et.NONE,this.keyState=et.NONE,this._lastPosition=new L,this._lastUp=new L,this._lastZoom=1,this._touchZoomDistanceStart=0,this._touchZoomDistanceEnd=0,this._touchRollAngle=0,this._touchRollPointerIds="",this._lastAngle=0,this._lastRollAngle=0,this._eye=new L,this._movePrev=new ne,this._moveCurr=new ne,this._lastAxis=new L,this._zoomStart=new ne,this._zoomEnd=new ne,this._panStart=new ne,this._panEnd=new ne,this._pointers=[],this._pointerPositions={},this._onPointerMove=jT.bind(this),this._onPointerDown=qT.bind(this),this._onPointerUp=YT.bind(this),this._onPointerCancel=$T.bind(this),this._onContextMenu=nE.bind(this),this._onMouseWheel=tE.bind(this),this._onKeyDown=JT.bind(this),this._onKeyUp=ZT.bind(this),this._onTouchStart=iE.bind(this),this._onTouchMove=rE.bind(this),this._onTouchEnd=sE.bind(this),this._onMouseDown=KT.bind(this),this._onMouseMove=QT.bind(this),this._onMouseUp=eE.bind(this),this._target0=this.target.clone(),this._position0=this.object.position.clone(),this._up0=this.object.up.clone(),this._zoom0=this.object.zoom,t!==null)this.connect(t),this.handleResize();this.update()}connect(e){super.connect(e),window.addEventListener("keydown",this._onKeyDown),window.addEventListener("keyup",this._onKeyUp),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerCancel),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="none"}disconnect(){window.removeEventListener("keydown",this._onKeyDown),window.removeEventListener("keyup",this._onKeyUp),this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerCancel),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction=""}dispose(){this.disconnect()}handleResize(){let e=this.domElement.getBoundingClientRect(),t=this.domElement.ownerDocument.documentElement;this.screen.left=e.left+window.pageXOffset-t.clientLeft,this.screen.top=e.top+window.pageYOffset-t.clientTop,this.screen.width=e.width,this.screen.height=e.height}update(){if(this._eye.subVectors(this.object.position,this.target),!this.noRotate){if(this._rotateCamera(),this.multiTouchRoll===!0)this._rollCamera()}if(!this.noZoom)this._zoomCamera();if(!this.noPan)this._panCamera();if(this.object.position.addVectors(this.target,this._eye),this.object.isPerspectiveCamera){this._checkDistances(),this.object.lookAt(this.target);let e=this._lastPosition.distanceToSquared(this.object.position)>ll,t=this._lastUp.distanceToSquared(this.object.up)>ll;if(e||t)this.dispatchEvent(yf),this._lastPosition.copy(this.object.position),this._lastUp.copy(this.object.up)}else if(this.object.isOrthographicCamera){this.object.lookAt(this.target);let e=this._lastPosition.distanceToSquared(this.object.position)>ll,t=this._lastUp.distanceToSquared(this.object.up)>ll,n=this._lastZoom!==this.object.zoom;if(e||t||n)this.dispatchEvent(yf),this._lastPosition.copy(this.object.position),this._lastUp.copy(this.object.up),this._lastZoom=this.object.zoom}else console.warn("THREE.TrackballControls: Unsupported camera type.")}reset(){this.state=et.NONE,this.keyState=et.NONE,this.target.copy(this._target0),this.object.position.copy(this._position0),this.object.up.copy(this._up0),this.object.zoom=this._zoom0,this.object.updateProjectionMatrix(),this._eye.subVectors(this.object.position,this.target),this.object.lookAt(this.target),this.dispatchEvent(yf),this._lastPosition.copy(this.object.position),this._lastUp.copy(this.object.up),this._lastZoom=this.object.zoom}_panCamera(){if(Ai.copy(this._panEnd).sub(this._panStart),Ai.lengthSq()){if(this.object.isOrthographicCamera){let e=(this.object.right-this.object.left)/this.object.zoom/this.domElement.clientWidth,t=(this.object.top-this.object.bottom)/this.object.zoom/this.domElement.clientWidth;Ai.x*=e,Ai.y*=t}if(Ai.multiplyScalar(this._eye.length()*this.panSpeed),hl.copy(this._eye).cross(this.object.up).setLength(Ai.x),hl.add(XT.copy(this.object.up).setLength(Ai.y)),this.object.position.add(hl),this.target.add(hl),this.staticMoving)this._panStart.copy(this._panEnd);else this._panStart.add(Ai.subVectors(this._panEnd,this._panStart).multiplyScalar(this.dynamicDampingFactor))}}_rotateCamera(){dl.set(this._moveCurr.x-this._movePrev.x,this._moveCurr.y-this._movePrev.y,0);let e=dl.length();if(e)this._eye.copy(this.object.position).sub(this.target),ul.copy(this._eye).normalize(),fl.copy(this.object.up).normalize(),bf.crossVectors(fl,ul).normalize(),fl.setLength(this._moveCurr.y-this._movePrev.y),bf.setLength(this._moveCurr.x-this._movePrev.x),dl.copy(fl.add(bf)),xf.crossVectors(dl,this._eye).normalize(),e*=this.rotateSpeed,Ci.setFromAxisAngle(xf,e),this._eye.applyQuaternion(Ci),this.object.up.applyQuaternion(Ci),this._lastAxis.copy(xf),this._lastAngle=e;else if(!this.staticMoving&&this._lastAngle)this._lastAngle*=Math.sqrt(1-this.dynamicDampingFactor),this._eye.copy(this.object.position).sub(this.target),Ci.setFromAxisAngle(this._lastAxis,this._lastAngle),this._eye.applyQuaternion(Ci),this.object.up.applyQuaternion(Ci);this._movePrev.copy(this._moveCurr)}_rollCamera(){let e=this._getTouchRollAngle();if(e)this._lastRollAngle=e*this.rollSpeed;else if(!this.staticMoving&&this._lastRollAngle)this._lastRollAngle*=Math.sqrt(1-this.dynamicDampingFactor);else return;ul.copy(this._eye).normalize(),Ci.setFromAxisAngle(ul,this._lastRollAngle),this.object.up.applyQuaternion(Ci)}_getTouchRollAngle(){let e=this._pointers[0],t=this._pointers[1];if(t===void 0||e.pointerType!=="touch"||t.pointerType!=="touch")return this._touchRollPointerIds="",0;let n=`${e.pointerId},${t.pointerId}`,i=this._pointerPositions[e.pointerId],r=this._pointerPositions[t.pointerId],s=Math.atan2(r.y-i.y,r.x-i.x);if(n!==this._touchRollPointerIds)return this._touchRollPointerIds=n,this._touchRollAngle=s,0;let o=s-this._touchRollAngle;if(this._touchRollAngle=s,o>Math.PI)o-=2*Math.PI;else if(o<-Math.PI)o+=2*Math.PI;return o}_zoomCamera(){let e;if(this.state===et.TOUCH_ZOOM_PAN)if(e=this._touchZoomDistanceStart/this._touchZoomDistanceEnd,this._touchZoomDistanceStart=this._touchZoomDistanceEnd,this.object.isPerspectiveCamera)this._eye.multiplyScalar(e);else if(this.object.isOrthographicCamera){if(this.object.zoom=Hr.clamp(this.object.zoom/e,this.minZoom,this.maxZoom),this._lastZoom!==this.object.zoom)this.object.updateProjectionMatrix()}else console.warn("THREE.TrackballControls: Unsupported camera type");else{if(e=1+(this._zoomEnd.y-this._zoomStart.y)*this.zoomSpeed,e!==1&&e>0)if(this.object.isPerspectiveCamera)this._eye.multiplyScalar(e);else if(this.object.isOrthographicCamera){if(this.object.zoom=Hr.clamp(this.object.zoom/e,this.minZoom,this.maxZoom),this._lastZoom!==this.object.zoom)this.object.updateProjectionMatrix()}else console.warn("THREE.TrackballControls: Unsupported camera type");if(this.staticMoving)this._zoomStart.copy(this._zoomEnd);else this._zoomStart.y+=(this._zoomEnd.y-this._zoomStart.y)*this.dynamicDampingFactor}}_getMouseOnScreen(e,t){return cl.set((e-this.screen.left)/this.screen.width,(t-this.screen.top)/this.screen.height),cl}_getMouseOnCircle(e,t){return cl.set((e-this.screen.width*0.5-this.screen.left)/(this.screen.width*0.5),(this.screen.height+2*(this.screen.top-t))/this.screen.width),cl}_addPointer(e){this._pointers.push(e)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t].pointerId==e.pointerId){this._pointers.splice(t,1);return}}_trackPointer(e){let t=this._pointerPositions[e.pointerId];if(t===void 0)t=new ne,this._pointerPositions[e.pointerId]=t;t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0].pointerId?this._pointers[1]:this._pointers[0];return this._pointerPositions[t.pointerId]}_checkDistances(){if(!this.noZoom||!this.noPan){if(this._eye.lengthSq()>this.maxDistance*this.maxDistance)this.object.position.addVectors(this.target,this._eye.setLength(this.maxDistance)),this._zoomStart.copy(this._zoomEnd);if(this._eye.lengthSq()<this.minDistance*this.minDistance)this.object.position.addVectors(this.target,this._eye.setLength(this.minDistance)),this._zoomStart.copy(this._zoomEnd)}}}function qT(e){if(this.enabled===!1)return;if(this._pointers.length===0)this.domElement.setPointerCapture(e.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp);if(this._addPointer(e),e.pointerType==="touch")this._onTouchStart(e);else this._onMouseDown(e)}function jT(e){if(this.enabled===!1)return;if(e.pointerType==="touch")this._onTouchMove(e);else this._onMouseMove(e)}function YT(e){if(this.enabled===!1)return;if(e.pointerType==="touch")this._onTouchEnd(e);else this._onMouseUp();if(this._removePointer(e),this._pointers.length===0)this.domElement.releasePointerCapture(e.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp)}function $T(e){this._removePointer(e)}function ZT(){if(this.enabled===!1)return;this.keyState=et.NONE,window.addEventListener("keydown",this._onKeyDown)}function JT(e){if(this.enabled===!1)return;if(window.removeEventListener("keydown",this._onKeyDown),this.keyState!==et.NONE)return;else if(e.code===this.keys[et.ROTATE]&&!this.noRotate)this.keyState=et.ROTATE;else if(e.code===this.keys[et.ZOOM]&&!this.noZoom)this.keyState=et.ZOOM;else if(e.code===this.keys[et.PAN]&&!this.noPan)this.keyState=et.PAN}function KT(e){let t;switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case Mt.DOLLY:this.state=et.ZOOM;break;case Mt.ROTATE:this.state=et.ROTATE;break;case Mt.PAN:this.state=et.PAN;break;default:this.state=et.NONE}let n=this.keyState!==et.NONE?this.keyState:this.state;if(n===et.ROTATE&&!this.noRotate)this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY)),this._movePrev.copy(this._moveCurr);else if(n===et.ZOOM&&!this.noZoom)this._zoomStart.copy(this._getMouseOnScreen(e.pageX,e.pageY)),this._zoomEnd.copy(this._zoomStart);else if(n===et.PAN&&!this.noPan)this._panStart.copy(this._getMouseOnScreen(e.pageX,e.pageY)),this._panEnd.copy(this._panStart);this.dispatchEvent(Sf)}function QT(e){let t=this.keyState!==et.NONE?this.keyState:this.state;if(t===et.ROTATE&&!this.noRotate)this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY));else if(t===et.ZOOM&&!this.noZoom)this._zoomEnd.copy(this._getMouseOnScreen(e.pageX,e.pageY));else if(t===et.PAN&&!this.noPan)this._panEnd.copy(this._getMouseOnScreen(e.pageX,e.pageY))}function eE(){this.state=et.NONE,this.dispatchEvent(Mf)}function tE(e){if(this.enabled===!1)return;if(this.noZoom===!0)return;switch(e.preventDefault(),e.deltaMode){case 2:this._zoomStart.y-=e.deltaY*0.025;break;case 1:this._zoomStart.y-=e.deltaY*0.01;break;default:this._zoomStart.y-=e.deltaY*0.00025;break}this.dispatchEvent(Sf),this.dispatchEvent(Mf)}function nE(e){if(this.enabled===!1)return;e.preventDefault()}function iE(e){switch(this._trackPointer(e),this._pointers.length){case 1:this.state=et.TOUCH_ROTATE,this._moveCurr.copy(this._getMouseOnCircle(this._pointers[0].pageX,this._pointers[0].pageY)),this._movePrev.copy(this._moveCurr);break;default:this.state=et.TOUCH_ZOOM_PAN;let t=this._pointers[0].pageX-this._pointers[1].pageX,n=this._pointers[0].pageY-this._pointers[1].pageY;this._touchZoomDistanceEnd=this._touchZoomDistanceStart=Math.sqrt(t*t+n*n);let i=(this._pointers[0].pageX+this._pointers[1].pageX)/2,r=(this._pointers[0].pageY+this._pointers[1].pageY)/2;this._panStart.copy(this._getMouseOnScreen(i,r)),this._panEnd.copy(this._panStart);break}this.dispatchEvent(Sf)}function rE(e){switch(this._trackPointer(e),this._pointers.length){case 1:this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY));break;default:let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y;this._touchZoomDistanceEnd=Math.sqrt(n*n+i*i);let r=(e.pageX+t.x)/2,s=(e.pageY+t.y)/2;this._panEnd.copy(this._getMouseOnScreen(r,s));break}}function sE(e){switch(this._pointers.length){case 0:this.state=et.NONE;break;case 1:this.state=et.TOUCH_ROTATE,this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY)),this._movePrev.copy(this._moveCurr);break;case 2:this.state=et.TOUCH_ZOOM_PAN;for(let t=0;t<this._pointers.length;t++)if(this._pointers[t].pointerId!==e.pointerId){let n=this._pointerPositions[this._pointers[t].pointerId];this._moveCurr.copy(this._getMouseOnCircle(n.x,n.y)),this._movePrev.copy(this._moveCurr);break}break}this.dispatchEvent(Mf)}var d0={type:"change"},Ef={type:"start"},m0={type:"end"},pl=new bi,p0=new on,oE=Math.cos(70*Hr.DEG2RAD),Ot=new L,cn=2*Math.PI,ct={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Tf=0.000001;class ml extends Wn{constructor(e,t=null){super(e,t);if(this.state=ct.NONE,this.target=new L,this.cursor=new L,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=0.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Mt.ROTATE,MIDDLE:Mt.DOLLY,RIGHT:Mt.PAN},this.touches={ONE:xn.ROTATE,TWO:xn.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new L,this._lastQuaternion=new Gt,this._lastTargetPosition=new L,this._quat=new Gt().setFromUnitVectors(e.up,new L(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Ys,this._sphericalDelta=new Ys,this._scale=1,this._panOffset=new L,this._rotateStart=new ne,this._rotateEnd=new ne,this._rotateDelta=new ne,this._panStart=new ne,this._panEnd=new ne,this._panDelta=new ne,this._dollyStart=new ne,this._dollyEnd=new ne,this._dollyDelta=new ne,this._dollyDirection=new L,this._mouse=new ne,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=lE.bind(this),this._onPointerDown=aE.bind(this),this._onPointerUp=cE.bind(this),this._onContextMenu=gE.bind(this),this._onMouseWheel=fE.bind(this),this._onKeyDown=dE.bind(this),this._onTouchStart=pE.bind(this),this._onTouchMove=mE.bind(this),this._onMouseDown=hE.bind(this),this._onMouseMove=uE.bind(this),this._interceptControlDown=_E.bind(this),this._interceptControlUp=vE.bind(this),this.domElement!==null)this.connect(this.domElement);this.update()}set cursorStyle(e){if(this._cursorStyle=e,e==="grab")this.domElement.style.cursor="grab";else this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=ct.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents();let e=this.domElement.getRootNode();e.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),e.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){if(this._domElementKeyEvents!==null)this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(d0),this.update(),this.state=ct.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;if(Ot.copy(t).sub(this.target),Ot.applyQuaternion(this._quat),this._spherical.setFromVector3(Ot),this.autoRotate&&this.state===ct.NONE)this._rotateLeft(this._getAutoRotationAngle(e));if(this.enableDamping)this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor;else this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi;let n=this.minAzimuthAngle,i=this.maxAzimuthAngle;if(isFinite(n)&&isFinite(i)){if(n<-Math.PI)n+=cn;else if(n>Math.PI)n-=cn;if(i<-Math.PI)i+=cn;else if(i>Math.PI)i-=cn;if(n<=i)this._spherical.theta=Math.max(n,Math.min(i,this._spherical.theta));else this._spherical.theta=this._spherical.theta>(n+i)/2?Math.max(n,this._spherical.theta):Math.min(i,this._spherical.theta)}if(this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0)this.target.addScaledVector(this._panOffset,this.dampingFactor);else this.target.add(this._panOffset);this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let s=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=s!=this._spherical.radius}if(Ot.setFromSpherical(this._spherical),Ot.applyQuaternion(this._quatInverse),t.copy(this.target).add(Ot),this.object.lookAt(this.target),this.enableDamping===!0)this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor);else this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0);if(this.zoomToCursor&&this._performCursorZoom){let s=null;if(this.object.isPerspectiveCamera){let o=Ot.length();s=this._clampDistance(o*this._scale);let a=o-s;this.object.position.addScaledVector(this._dollyDirection,a),this.object.updateMatrixWorld(),r=!!a}else if(this.object.isOrthographicCamera){let o=new L(this._mouse.x,this._mouse.y,0);o.unproject(this.object);let a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=a!==this.object.zoom;let l=new L(this._mouse.x,this._mouse.y,0);l.unproject(this.object),this.object.position.sub(l).add(o),this.object.updateMatrixWorld(),s=Ot.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;if(s!==null)if(this.screenSpacePanning)this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(s).add(this.object.position);else if(pl.origin.copy(this.object.position),pl.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(pl.direction))<oE)this.object.lookAt(this.target);else p0.setFromNormalAndCoplanarPoint(this.object.up,this.target),pl.intersectPlane(p0,this.target)}else if(this.object.isOrthographicCamera){let s=this.object.zoom;if(this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),s!==this.object.zoom)this.object.updateProjectionMatrix(),r=!0}if(this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>Tf||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Tf||this._lastTargetPosition.distanceToSquared(this.target)>Tf)return this.dispatchEvent(d0),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0;return!1}_getAutoRotationAngle(e){if(e!==null)return cn/60*this.autoRotateSpeed*e;else return cn/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*0.01);return Math.pow(0.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Ot.setFromMatrixColumn(t,0),Ot.multiplyScalar(-e),this._panOffset.add(Ot)}_panUp(e,t){if(this.screenSpacePanning===!0)Ot.setFromMatrixColumn(t,1);else Ot.setFromMatrixColumn(t,0),Ot.crossVectors(this.object.up,Ot);Ot.multiplyScalar(e),this._panOffset.add(Ot)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let i=this.object.position;Ot.copy(i).sub(this.target);let r=Ot.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/n.clientHeight,this.object.matrix),this._panUp(2*t*r/n.clientHeight,this.object.matrix)}else if(this.object.isOrthographicCamera)this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix);else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1}_dollyOut(e){if(this.object.isPerspectiveCamera||this.object.isOrthographicCamera)this._scale/=e;else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1}_dollyIn(e){if(this.object.isPerspectiveCamera||this.object.isOrthographicCamera)this._scale*=e;else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),i=e-n.left,r=t-n.top,{width:s,height:o}=n;this._mouse.x=i/s*2-1,this._mouse.y=-(r/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(cn*this._rotateDelta.x/t.clientHeight),this._rotateUp(cn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){if(this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0)this._dollyOut(this._getZoomScale(this._dollyDelta.y));else if(this._dollyDelta.y<0)this._dollyIn(this._getZoomScale(this._dollyDelta.y));this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){if(this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0)this._dollyIn(this._getZoomScale(e.deltaY));else if(e.deltaY>0)this._dollyOut(this._getZoomScale(e.deltaY));this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateUp(cn*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(0,this.keyPanSpeed);t=!0;break;case this.keys.BOTTOM:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateUp(-cn*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(0,-this.keyPanSpeed);t=!0;break;case this.keys.LEFT:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateLeft(cn*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(this.keyPanSpeed,0);t=!0;break;case this.keys.RIGHT:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateLeft(-cn*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(-this.keyPanSpeed,0);t=!0;break}if(t)e.preventDefault(),this.update()}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=0.5*(e.pageX+t.x),i=0.5*(e.pageY+t.y);this._rotateStart.set(n,i)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=0.5*(e.pageX+t.x),i=0.5*(e.pageY+t.y);this._panStart.set(n,i)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y,r=Math.sqrt(n*n+i*i);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){if(this.enableZoom)this._handleTouchStartDolly(e);if(this.enablePan)this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){if(this.enableZoom)this._handleTouchStartDolly(e);if(this.enableRotate)this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let n=this._getSecondPointerPosition(e),i=0.5*(e.pageX+n.x),r=0.5*(e.pageY+n.y);this._rotateEnd.set(i,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(cn*this._rotateDelta.x/t.clientHeight),this._rotateUp(cn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=0.5*(e.pageX+t.x),i=0.5*(e.pageY+t.y);this._panEnd.set(n,i)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y,r=Math.sqrt(n*n+i*i);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let s=(e.pageX+t.x)*0.5,o=(e.pageY+t.y)*0.5;this._updateZoomParameters(s,o)}_handleTouchMoveDollyPan(e){if(this.enableZoom)this._handleTouchMoveDolly(e);if(this.enablePan)this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){if(this.enableZoom)this._handleTouchMoveDolly(e);if(this.enableRotate)this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];if(t===void 0)t=new ne,this._pointerPositions[e.pointerId]=t;t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}if(e.ctrlKey&&!this._controlActive)n.deltaY*=10;return n}}function aE(e){if(this.enabled===!1)return;if(this._pointers.length===0)this.domElement.setPointerCapture(e.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp);if(this._isTrackingPointer(e))return;if(this._addPointer(e),e.pointerType==="touch")this._onTouchStart(e);else this._onMouseDown(e);if(this._cursorStyle==="grab")this.domElement.style.cursor="grabbing"}function lE(e){if(this.enabled===!1)return;if(e.pointerType==="touch")this._onTouchMove(e);else this._onMouseMove(e)}function cE(e){switch(this._removePointer(e),this._pointers.length){case 0:if(this.domElement.releasePointerCapture(e.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(m0),this.state=ct.NONE,this._cursorStyle==="grab")this.domElement.style.cursor="grab";break;case 1:let t=this._pointers[0],n=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:n.x,pageY:n.y});break}}function hE(e){let t;switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case Mt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(e),this.state=ct.DOLLY;break;case Mt.ROTATE:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=ct.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=ct.ROTATE}break;case Mt.PAN:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=ct.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=ct.PAN}break;default:this.state=ct.NONE}if(this.state!==ct.NONE)this.dispatchEvent(Ef)}function uE(e){switch(this.state){case ct.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(e);break;case ct.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(e);break;case ct.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(e);break}}function fE(e){if(this.enabled===!1||this.enableZoom===!1||this.state!==ct.NONE)return;e.preventDefault(),this.dispatchEvent(Ef),this._handleMouseWheel(this._customWheelEvent(e)),this.dispatchEvent(m0)}function dE(e){if(this.enabled===!1)return;this._handleKeyDown(e)}function pE(e){switch(this._trackPointer(e),this._pointers.length){case 1:switch(this.touches.ONE){case xn.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(e),this.state=ct.TOUCH_ROTATE;break;case xn.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(e),this.state=ct.TOUCH_PAN;break;default:this.state=ct.NONE}break;case 2:switch(this.touches.TWO){case xn.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(e),this.state=ct.TOUCH_DOLLY_PAN;break;case xn.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(e),this.state=ct.TOUCH_DOLLY_ROTATE;break;default:this.state=ct.NONE}break;default:this.state=ct.NONE}if(this.state!==ct.NONE)this.dispatchEvent(Ef)}function mE(e){switch(this._trackPointer(e),this.state){case ct.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(e),this.update();break;case ct.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(e),this.update();break;case ct.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(e),this.update();break;case ct.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(e),this.update();break;default:this.state=ct.NONE}}function gE(e){if(this.enabled===!1)return;e.preventDefault()}function _E(e){if(e.key==="Control")this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0})}function vE(e){if(e.key==="Control")this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0})}var yE={type:"change"},g0=0.000001,_0=new Gt;class Af extends Wn{constructor(e,t=null){super(e,t);if(this.movementSpeed=1,this.rollSpeed=0.005,this.dragToLook=!1,this.autoForward=!1,this._moveState={up:0,down:0,left:0,right:0,forward:0,back:0,pitchUp:0,pitchDown:0,yawLeft:0,yawRight:0,rollLeft:0,rollRight:0},this._moveVector=new L(0,0,0),this._rotationVector=new L(0,0,0),this._lastQuaternion=new Gt,this._lastPosition=new L,this._status=0,this._onKeyDown=xE.bind(this),this._onKeyUp=bE.bind(this),this._onPointerMove=ME.bind(this),this._onPointerDown=SE.bind(this),this._onPointerUp=wE.bind(this),this._onPointerCancel=TE.bind(this),this._onContextMenu=EE.bind(this),t!==null)this.connect(t)}connect(e){super.connect(e),window.addEventListener("keydown",this._onKeyDown),window.addEventListener("keyup",this._onKeyUp),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointerup",this._onPointerUp),this.domElement.addEventListener("pointercancel",this._onPointerCancel),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="none"}disconnect(){window.removeEventListener("keydown",this._onKeyDown),window.removeEventListener("keyup",this._onKeyUp),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerCancel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction=""}dispose(){this.disconnect()}update(e){if(this.enabled===!1)return;let t=this.object,n=e*this.movementSpeed,i=e*this.rollSpeed;if(t.translateX(this._moveVector.x*n),t.translateY(this._moveVector.y*n),t.translateZ(this._moveVector.z*n),_0.set(this._rotationVector.x*i,this._rotationVector.y*i,this._rotationVector.z*i,1).normalize(),t.quaternion.multiply(_0),this._lastPosition.distanceToSquared(t.position)>g0||8*(1-this._lastQuaternion.dot(t.quaternion))>g0)this.dispatchEvent(yE),this._lastQuaternion.copy(t.quaternion),this._lastPosition.copy(t.position)}_updateMovementVector(){let e=this._moveState.forward||this.autoForward&&!this._moveState.back?1:0;this._moveVector.x=-this._moveState.left+this._moveState.right,this._moveVector.y=-this._moveState.down+this._moveState.up,this._moveVector.z=-e+this._moveState.back}_updateRotationVector(){this._rotationVector.x=-this._moveState.pitchDown+this._moveState.pitchUp,this._rotationVector.y=-this._moveState.yawRight+this._moveState.yawLeft,this._rotationVector.z=-this._moveState.rollRight+this._moveState.rollLeft}_getContainerDimensions(){if(this.domElement!=document)return{size:[this.domElement.offsetWidth,this.domElement.offsetHeight],offset:[this.domElement.offsetLeft,this.domElement.offsetTop]};else return{size:[window.innerWidth,window.innerHeight],offset:[0,0]}}}function xE(e){if(e.altKey||this.enabled===!1)return;switch(e.code){case"ShiftLeft":case"ShiftRight":this.movementSpeedMultiplier=0.1;break;case"KeyW":this._moveState.forward=1;break;case"KeyS":this._moveState.back=1;break;case"KeyA":this._moveState.left=1;break;case"KeyD":this._moveState.right=1;break;case"KeyR":this._moveState.up=1;break;case"KeyF":this._moveState.down=1;break;case"ArrowUp":this._moveState.pitchUp=1;break;case"ArrowDown":this._moveState.pitchDown=1;break;case"ArrowLeft":this._moveState.yawLeft=1;break;case"ArrowRight":this._moveState.yawRight=1;break;case"KeyQ":this._moveState.rollLeft=1;break;case"KeyE":this._moveState.rollRight=1;break}this._updateMovementVector(),this._updateRotationVector()}function bE(e){if(this.enabled===!1)return;switch(e.code){case"ShiftLeft":case"ShiftRight":this.movementSpeedMultiplier=1;break;case"KeyW":this._moveState.forward=0;break;case"KeyS":this._moveState.back=0;break;case"KeyA":this._moveState.left=0;break;case"KeyD":this._moveState.right=0;break;case"KeyR":this._moveState.up=0;break;case"KeyF":this._moveState.down=0;break;case"ArrowUp":this._moveState.pitchUp=0;break;case"ArrowDown":this._moveState.pitchDown=0;break;case"ArrowLeft":this._moveState.yawLeft=0;break;case"ArrowRight":this._moveState.yawRight=0;break;case"KeyQ":this._moveState.rollLeft=0;break;case"KeyE":this._moveState.rollRight=0;break}this._updateMovementVector(),this._updateRotationVector()}function SE(e){if(this.enabled===!1)return;if(this.dragToLook)this._status++;else{switch(e.button){case 0:this._moveState.forward=1;break;case 2:this._moveState.back=1;break}this._updateMovementVector()}}function ME(e){if(this.enabled===!1)return;if(!this.dragToLook||this._status>0){let t=this._getContainerDimensions(),n=t.size[0]/2,i=t.size[1]/2;this._moveState.yawLeft=-(e.pageX-t.offset[0]-n)/n,this._moveState.pitchDown=(e.pageY-t.offset[1]-i)/i,this._updateRotationVector()}}function wE(e){if(this.enabled===!1)return;if(this.dragToLook)this._status--,this._moveState.yawLeft=this._moveState.pitchDown=0;else{switch(e.button){case 0:this._moveState.forward=0;break;case 2:this._moveState.back=0;break}this._updateMovementVector()}this._updateRotationVector()}function TE(){if(this.enabled===!1)return;if(this.dragToLook)this._status=0,this._moveState.yawLeft=this._moveState.pitchDown=0;else this._moveState.forward=0,this._moveState.back=0,this._updateMovementVector();this._updateRotationVector()}function EE(e){if(this.enabled===!1)return;e.preventDefault()}var rs={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class wn{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}var AE=new nr(-1,1,1,-1,0,1);class v0 extends xt{constructor(){super();this.setAttribute("position",new rt([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new rt([0,2,0,0,2,0],2))}}var CE=new v0;class lr{constructor(e){this._mesh=new Bt(CE,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,AE)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class Cf extends wn{constructor(e,t="tDiffuse"){super();if(this.textureID=t,this.uniforms=null,this.material=null,e instanceof At)this.uniforms=e.uniforms,this.material=e;else if(e)this.uniforms=oi.clone(e.uniforms),this.material=new At({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader});this._fsQuad=new lr(this.material)}render(e,t,n){if(this.uniforms[this.textureID])this.uniforms[this.textureID].value=n.texture;if(this._fsQuad.material=this.material,this.renderToScreen)e.setRenderTarget(null),this._fsQuad.render(e);else{if(e.setRenderTarget(t),this.clear)e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil);this._fsQuad.render(e)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class gl extends wn{constructor(e,t){super();this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let i=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let s,o;if(this.inverse)s=0,o=1;else s=1,o=0;if(r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(i.REPLACE,i.REPLACE,i.REPLACE),r.buffers.stencil.setFunc(i.ALWAYS,s,4294967295),r.buffers.stencil.setClear(o),r.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear)e.clear();if(e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear)e.clear();e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(i.EQUAL,1,4294967295),r.buffers.stencil.setOp(i.KEEP,i.KEEP,i.KEEP),r.buffers.stencil.setLocked(!0)}}class Rf extends wn{constructor(){super();this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class _l{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new ne);this._width=n.width,this._height=n.height,t=new It(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:jt}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Cf(rs),this.copyPass.material.blending=bn,this.timer=new jr}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);if(t!==-1)this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){if(this.timer.update(),e===void 0)e=this.timer.getDelta();let t=this.renderer.getRenderTarget(),n=!1;for(let i=0,r=this.passes.length;i<r;i++){let s=this.passes[i];if(s.enabled===!1)continue;if(s.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i),s.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),s.needsSwap){if(n){let o=this.renderer.getContext(),a=this.renderer.state.buffers.stencil;a.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),a.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}if(gl!==void 0){if(s instanceof gl)n=!0;else if(s instanceof Rf)n=!1}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new ne);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(n,i),this.renderTarget2.setSize(n,i);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(n,i)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class vl extends wn{constructor(e,t,n=null,i=null,r=null){super();this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=i,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new Le}render(e,t,n){let i=e.autoClear;e.autoClear=!1;let r,s;if(this.overrideMaterial!==null)s=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial;if(this.clearColor!==null)e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha());if(this.clearAlpha!==null)r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha);if(this.clearDepth==!0)e.clearDepth();if(e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0)e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil);if(e.render(this.scene,this.camera),this.clearColor!==null)e.setClearColor(this._oldClearColor);if(this.clearAlpha!==null)e.setClearAlpha(r);if(this.overrideMaterial!==null)this.scene.overrideMaterial=s;e.autoClear=i}}function tn(){return tn=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var i in n)({}).hasOwnProperty.call(n,i)&&(e[i]=n[i])}return e},tn.apply(null,arguments)}function y0(e){if(e===void 0)throw ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function Ri(e,t){return Ri=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(n,i){return n.__proto__=i,n},Ri(e,t)}function x0(e,t){e.prototype=Object.create(t.prototype),e.prototype.constructor=e,Ri(e,t)}function yl(e){return yl=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(t){return t.__proto__||Object.getPrototypeOf(t)},yl(e)}function b0(e){try{return Function.toString.call(e).indexOf("[native code]")!==-1}catch(t){return typeof e=="function"}}function Pf(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],function(){}))}catch(t){}return(Pf=function(){return!!e})()}function S0(e,t,n){if(Pf())return Reflect.construct.apply(null,arguments);var i=[null];i.push.apply(i,t);var r=new(e.bind.apply(e,i));return n&&Ri(r,n.prototype),r}function xl(e){var t=typeof Map=="function"?new Map:void 0;return xl=function(i){if(i===null||!b0(i))return i;if(typeof i!="function")throw TypeError("Super expression must either be null or a function");if(t!==void 0){if(t.has(i))return t.get(i);t.set(i,r)}function r(){return S0(i,arguments,yl(this).constructor)}return r.prototype=Object.create(i.prototype,{constructor:{value:r,enumerable:!1,writable:!0,configurable:!0}}),Ri(r,i)},xl(e)}var RE={"1":`Passed invalid arguments to hsl, please pass multiple numbers e.g. hsl(360, 0.75, 0.4) or an object e.g. rgb({ hue: 255, saturation: 0.4, lightness: 0.75 }).

`,"2":`Passed invalid arguments to hsla, please pass multiple numbers e.g. hsla(360, 0.75, 0.4, 0.7) or an object e.g. rgb({ hue: 255, saturation: 0.4, lightness: 0.75, alpha: 0.7 }).

`,"3":`Passed an incorrect argument to a color function, please pass a string representation of a color.

`,"4":`Couldn't generate valid rgb string from %s, it returned %s.

`,"5":`Couldn't parse the color string. Please provide the color as a string in hex, rgb, rgba, hsl or hsla notation.

`,"6":`Passed invalid arguments to rgb, please pass multiple numbers e.g. rgb(255, 205, 100) or an object e.g. rgb({ red: 255, green: 205, blue: 100 }).

`,"7":`Passed invalid arguments to rgba, please pass multiple numbers e.g. rgb(255, 205, 100, 0.75) or an object e.g. rgb({ red: 255, green: 205, blue: 100, alpha: 0.75 }).

`,"8":`Passed invalid argument to toColorString, please pass a RgbColor, RgbaColor, HslColor or HslaColor object.

`,"9":`Please provide a number of steps to the modularScale helper.

`,"10":`Please pass a number or one of the predefined scales to the modularScale helper as the ratio.

`,"11":`Invalid value passed as base to modularScale, expected number or em string but got "%s"

`,"12":`Expected a string ending in "px" or a number passed as the first argument to %s(), got "%s" instead.

`,"13":`Expected a string ending in "px" or a number passed as the second argument to %s(), got "%s" instead.

`,"14":`Passed invalid pixel value ("%s") to %s(), please pass a value like "12px" or 12.

`,"15":`Passed invalid base value ("%s") to %s(), please pass a value like "12px" or 12.

`,"16":`You must provide a template to this method.

`,"17":`You passed an unsupported selector state to this method.

`,"18":`minScreen and maxScreen must be provided as stringified numbers with the same units.

`,"19":`fromSize and toSize must be provided as stringified numbers with the same units.

`,"20":`expects either an array of objects or a single object with the properties prop, fromSize, and toSize.

`,"21":"expects the objects in the first argument array to have the properties `prop`, `fromSize`, and `toSize`.\n\n","22":"expects the first argument object to have the properties `prop`, `fromSize`, and `toSize`.\n\n","23":`fontFace expects a name of a font-family.

`,"24":`fontFace expects either the path to the font file(s) or a name of a local copy.

`,"25":`fontFace expects localFonts to be an array.

`,"26":`fontFace expects fileFormats to be an array.

`,"27":`radialGradient requries at least 2 color-stops to properly render.

`,"28":`Please supply a filename to retinaImage() as the first argument.

`,"29":`Passed invalid argument to triangle, please pass correct pointingDirection e.g. 'right'.

`,"30":"Passed an invalid value to `height` or `width`. Please provide a pixel based unit.\n\n","31":`The animation shorthand only takes 8 arguments. See the specification for more information: http://mdn.io/animation

`,"32":`To pass multiple animations please supply them in arrays, e.g. animation(['rotate', '2s'], ['move', '1s'])
To pass a single animation please supply them in simple values, e.g. animation('rotate', '2s')

`,"33":`The animation shorthand arrays can only have 8 elements. See the specification for more information: http://mdn.io/animation

`,"34":`borderRadius expects a radius value as a string or number as the second argument.

`,"35":`borderRadius expects one of "top", "bottom", "left" or "right" as the first argument.

`,"36":`Property must be a string value.

`,"37":`Syntax Error at %s.

`,"38":`Formula contains a function that needs parentheses at %s.

`,"39":`Formula is missing closing parenthesis at %s.

`,"40":`Formula has too many closing parentheses at %s.

`,"41":`All values in a formula must have the same unit or be unitless.

`,"42":`Please provide a number of steps to the modularScale helper.

`,"43":`Please pass a number or one of the predefined scales to the modularScale helper as the ratio.

`,"44":`Invalid value passed as base to modularScale, expected number or em/rem string but got %s.

`,"45":`Passed invalid argument to hslToColorString, please pass a HslColor or HslaColor object.

`,"46":`Passed invalid argument to rgbToColorString, please pass a RgbColor or RgbaColor object.

`,"47":`minScreen and maxScreen must be provided as stringified numbers with the same units.

`,"48":`fromSize and toSize must be provided as stringified numbers with the same units.

`,"49":`Expects either an array of objects or a single object with the properties prop, fromSize, and toSize.

`,"50":`Expects the objects in the first argument array to have the properties prop, fromSize, and toSize.

`,"51":`Expects the first argument object to have the properties prop, fromSize, and toSize.

`,"52":`fontFace expects either the path to the font file(s) or a name of a local copy.

`,"53":`fontFace expects localFonts to be an array.

`,"54":`fontFace expects fileFormats to be an array.

`,"55":`fontFace expects a name of a font-family.

`,"56":`linearGradient requries at least 2 color-stops to properly render.

`,"57":`radialGradient requries at least 2 color-stops to properly render.

`,"58":`Please supply a filename to retinaImage() as the first argument.

`,"59":`Passed invalid argument to triangle, please pass correct pointingDirection e.g. 'right'.

`,"60":"Passed an invalid value to `height` or `width`. Please provide a pixel based unit.\n\n","61":`Property must be a string value.

`,"62":`borderRadius expects a radius value as a string or number as the second argument.

`,"63":`borderRadius expects one of "top", "bottom", "left" or "right" as the first argument.

`,"64":`The animation shorthand only takes 8 arguments. See the specification for more information: http://mdn.io/animation.

`,"65":`To pass multiple animations please supply them in arrays, e.g. animation(['rotate', '2s'], ['move', '1s'])\\nTo pass a single animation please supply them in simple values, e.g. animation('rotate', '2s').

`,"66":`The animation shorthand arrays can only have 8 elements. See the specification for more information: http://mdn.io/animation.

`,"67":`You must provide a template to this method.

`,"68":`You passed an unsupported selector state to this method.

`,"69":`Expected a string ending in "px" or a number passed as the first argument to %s(), got %s instead.

`,"70":`Expected a string ending in "px" or a number passed as the second argument to %s(), got %s instead.

`,"71":`Passed invalid pixel value %s to %s(), please pass a value like "12px" or 12.

`,"72":`Passed invalid base value %s to %s(), please pass a value like "12px" or 12.

`,"73":`Please provide a valid CSS variable.

`,"74":`CSS variable not found and no default was provided.

`,"75":`important requires a valid style object, got a %s instead.

`,"76":`fromSize and toSize must be provided as stringified numbers with the same units as minScreen and maxScreen.

`,"77":`remToPx expects a value in "rem" but you provided it in "%s".

`,"78":`base must be set in "px" or "%" but you set it in "%s".
`};function PE(){for(var e=arguments.length,t=Array(e),n=0;n<e;n++)t[n]=arguments[n];var i=t[0],r=[],s;for(s=1;s<t.length;s+=1)r.push(t[s]);return r.forEach(function(o){i=i.replace(/%[a-z]/,o)}),i}var hn=function(e){x0(t,e);function t(n){var i;for(var r=arguments.length,s=Array(r>1?r-1:0),o=1;o<r;o++)s[o-1]=arguments[o];return i=e.call(this,PE.apply(void 0,[RE[n]].concat(s)))||this,y0(i)}return t}(xl(Error));function M0(e,t){return e.substr(-t.length)===t}var IE=/^([+-]?(?:\d+|\d*\.\d+))([a-z]*|%)$/;function w0(e){if(typeof e!=="string")return e;var t=e.match(IE);return t?parseFloat(e):e}var LE=function(t){return function(n,i){if(i===void 0)i="16px";var r=n,s=i;if(typeof n==="string"){if(!M0(n,"px"))throw new hn(69,t,n);r=w0(n)}if(typeof i==="string"){if(!M0(i,"px"))throw new hn(70,t,i);s=w0(i)}if(typeof r==="string")throw new hn(71,n,t);if(typeof s==="string")throw new hn(72,i,t);return""+r/s+t}},E0=LE,Dz=E0("em");var Nz=E0("rem");function If(e){return Math.round(e*255)}function DE(e,t,n){return If(e)+","+If(t)+","+If(n)}function mo(e,t,n,i){if(i===void 0)i=DE;if(t===0)return i(n,n,n);var r=(e%360+360)%360/60,s=(1-Math.abs(2*n-1))*t,o=s*(1-Math.abs(r%2-1)),a=0,l=0,c=0;if(r>=0&&r<1)a=s,l=o;else if(r>=1&&r<2)a=o,l=s;else if(r>=2&&r<3)l=s,c=o;else if(r>=3&&r<4)l=o,c=s;else if(r>=4&&r<5)a=o,c=s;else if(r>=5&&r<6)a=s,c=o;var u=n-s/2,f=a+u,h=l+u,d=c+u;return i(f,h,d)}var T0={aliceblue:"f0f8ff",antiquewhite:"faebd7",aqua:"00ffff",aquamarine:"7fffd4",azure:"f0ffff",beige:"f5f5dc",bisque:"ffe4c4",black:"000",blanchedalmond:"ffebcd",blue:"0000ff",blueviolet:"8a2be2",brown:"a52a2a",burlywood:"deb887",cadetblue:"5f9ea0",chartreuse:"7fff00",chocolate:"d2691e",coral:"ff7f50",cornflowerblue:"6495ed",cornsilk:"fff8dc",crimson:"dc143c",cyan:"00ffff",darkblue:"00008b",darkcyan:"008b8b",darkgoldenrod:"b8860b",darkgray:"a9a9a9",darkgreen:"006400",darkgrey:"a9a9a9",darkkhaki:"bdb76b",darkmagenta:"8b008b",darkolivegreen:"556b2f",darkorange:"ff8c00",darkorchid:"9932cc",darkred:"8b0000",darksalmon:"e9967a",darkseagreen:"8fbc8f",darkslateblue:"483d8b",darkslategray:"2f4f4f",darkslategrey:"2f4f4f",darkturquoise:"00ced1",darkviolet:"9400d3",deeppink:"ff1493",deepskyblue:"00bfff",dimgray:"696969",dimgrey:"696969",dodgerblue:"1e90ff",firebrick:"b22222",floralwhite:"fffaf0",forestgreen:"228b22",fuchsia:"ff00ff",gainsboro:"dcdcdc",ghostwhite:"f8f8ff",gold:"ffd700",goldenrod:"daa520",gray:"808080",green:"008000",greenyellow:"adff2f",grey:"808080",honeydew:"f0fff0",hotpink:"ff69b4",indianred:"cd5c5c",indigo:"4b0082",ivory:"fffff0",khaki:"f0e68c",lavender:"e6e6fa",lavenderblush:"fff0f5",lawngreen:"7cfc00",lemonchiffon:"fffacd",lightblue:"add8e6",lightcoral:"f08080",lightcyan:"e0ffff",lightgoldenrodyellow:"fafad2",lightgray:"d3d3d3",lightgreen:"90ee90",lightgrey:"d3d3d3",lightpink:"ffb6c1",lightsalmon:"ffa07a",lightseagreen:"20b2aa",lightskyblue:"87cefa",lightslategray:"789",lightslategrey:"789",lightsteelblue:"b0c4de",lightyellow:"ffffe0",lime:"0f0",limegreen:"32cd32",linen:"faf0e6",magenta:"f0f",maroon:"800000",mediumaquamarine:"66cdaa",mediumblue:"0000cd",mediumorchid:"ba55d3",mediumpurple:"9370db",mediumseagreen:"3cb371",mediumslateblue:"7b68ee",mediumspringgreen:"00fa9a",mediumturquoise:"48d1cc",mediumvioletred:"c71585",midnightblue:"191970",mintcream:"f5fffa",mistyrose:"ffe4e1",moccasin:"ffe4b5",navajowhite:"ffdead",navy:"000080",oldlace:"fdf5e6",olive:"808000",olivedrab:"6b8e23",orange:"ffa500",orangered:"ff4500",orchid:"da70d6",palegoldenrod:"eee8aa",palegreen:"98fb98",paleturquoise:"afeeee",palevioletred:"db7093",papayawhip:"ffefd5",peachpuff:"ffdab9",peru:"cd853f",pink:"ffc0cb",plum:"dda0dd",powderblue:"b0e0e6",purple:"800080",rebeccapurple:"639",red:"f00",rosybrown:"bc8f8f",royalblue:"4169e1",saddlebrown:"8b4513",salmon:"fa8072",sandybrown:"f4a460",seagreen:"2e8b57",seashell:"fff5ee",sienna:"a0522d",silver:"c0c0c0",skyblue:"87ceeb",slateblue:"6a5acd",slategray:"708090",slategrey:"708090",snow:"fffafa",springgreen:"00ff7f",steelblue:"4682b4",tan:"d2b48c",teal:"008080",thistle:"d8bfd8",tomato:"ff6347",turquoise:"40e0d0",violet:"ee82ee",wheat:"f5deb3",white:"fff",whitesmoke:"f5f5f5",yellow:"ff0",yellowgreen:"9acd32"};function NE(e){if(typeof e!=="string")return e;var t=e.toLowerCase();return T0[t]?"#"+T0[t]:e}var OE=/^#[a-fA-F0-9]{6}$/,UE=/^#[a-fA-F0-9]{8}$/,FE=/^#[a-fA-F0-9]{3}$/,BE=/^#[a-fA-F0-9]{4}$/,Lf=/^rgb\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*\)$/i,kE=/^rgb(?:a)?\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i,zE=/^hsl\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*\)$/i,GE=/^hsl(?:a)?\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i;function Pi(e){if(typeof e!=="string")throw new hn(3);var t=NE(e);if(t.match(OE))return{red:parseInt(""+t[1]+t[2],16),green:parseInt(""+t[3]+t[4],16),blue:parseInt(""+t[5]+t[6],16)};if(t.match(UE)){var n=parseFloat((parseInt(""+t[7]+t[8],16)/255).toFixed(2));return{red:parseInt(""+t[1]+t[2],16),green:parseInt(""+t[3]+t[4],16),blue:parseInt(""+t[5]+t[6],16),alpha:n}}if(t.match(FE))return{red:parseInt(""+t[1]+t[1],16),green:parseInt(""+t[2]+t[2],16),blue:parseInt(""+t[3]+t[3],16)};if(t.match(BE)){var i=parseFloat((parseInt(""+t[4]+t[4],16)/255).toFixed(2));return{red:parseInt(""+t[1]+t[1],16),green:parseInt(""+t[2]+t[2],16),blue:parseInt(""+t[3]+t[3],16),alpha:i}}var r=Lf.exec(t);if(r)return{red:parseInt(""+r[1],10),green:parseInt(""+r[2],10),blue:parseInt(""+r[3],10)};var s=kE.exec(t.substring(0,50));if(s)return{red:parseInt(""+s[1],10),green:parseInt(""+s[2],10),blue:parseInt(""+s[3],10),alpha:parseFloat(""+s[4])>1?parseFloat(""+s[4])/100:parseFloat(""+s[4])};var o=zE.exec(t);if(o){var a=parseInt(""+o[1],10),l=parseInt(""+o[2],10)/100,c=parseInt(""+o[3],10)/100,u="rgb("+mo(a,l,c)+")",f=Lf.exec(u);if(!f)throw new hn(4,t,u);return{red:parseInt(""+f[1],10),green:parseInt(""+f[2],10),blue:parseInt(""+f[3],10)}}var h=GE.exec(t.substring(0,50));if(h){var d=parseInt(""+h[1],10),g=parseInt(""+h[2],10)/100,_=parseInt(""+h[3],10)/100,m="rgb("+mo(d,g,_)+")",p=Lf.exec(m);if(!p)throw new hn(4,t,m);return{red:parseInt(""+p[1],10),green:parseInt(""+p[2],10),blue:parseInt(""+p[3],10),alpha:parseFloat(""+h[4])>1?parseFloat(""+h[4])/100:parseFloat(""+h[4])}}throw new hn(5)}function HE(e){var t=e.red/255,n=e.green/255,i=e.blue/255,r=Math.max(t,n,i),s=Math.min(t,n,i),o=(r+s)/2;if(r===s)if(e.alpha!==void 0)return{hue:0,saturation:0,lightness:o,alpha:e.alpha};else return{hue:0,saturation:0,lightness:o};var a,l=r-s,c=o>0.5?l/(2-r-s):l/(r+s);switch(r){case t:a=(n-i)/l+(n<i?6:0);break;case n:a=(i-t)/l+2;break;default:a=(t-n)/l+4;break}if(a*=60,e.alpha!==void 0)return{hue:a,saturation:c,lightness:o,alpha:e.alpha};return{hue:a,saturation:c,lightness:o}}function Ii(e){return HE(Pi(e))}var VE=function(t){if(t.length===7&&t[1]===t[2]&&t[3]===t[4]&&t[5]===t[6])return"#"+t[1]+t[3]+t[5];return t},Nf=VE;function cr(e){var t=e.toString(16);return t.length===1?"0"+t:t}function Df(e){return cr(Math.round(e*255))}function WE(e,t,n){return Nf("#"+Df(e)+Df(t)+Df(n))}function bl(e,t,n){return mo(e,t,n,WE)}function XE(e,t,n){if(typeof e==="number"&&typeof t==="number"&&typeof n==="number")return bl(e,t,n);else if(typeof e==="object"&&t===void 0&&n===void 0)return bl(e.hue,e.saturation,e.lightness);throw new hn(1)}function qE(e,t,n,i){if(typeof e==="number"&&typeof t==="number"&&typeof n==="number"&&typeof i==="number")return i>=1?bl(e,t,n):"rgba("+mo(e,t,n)+","+i+")";else if(typeof e==="object"&&t===void 0&&n===void 0&&i===void 0)return e.alpha>=1?bl(e.hue,e.saturation,e.lightness):"rgba("+mo(e.hue,e.saturation,e.lightness)+","+e.alpha+")";throw new hn(2)}function Of(e,t,n){if(typeof e==="number"&&typeof t==="number"&&typeof n==="number")return Nf("#"+cr(e)+cr(t)+cr(n));else if(typeof e==="object"&&t===void 0&&n===void 0)return Nf("#"+cr(e.red)+cr(e.green)+cr(e.blue));throw new hn(6)}function Sl(e,t,n,i){if(typeof e==="string"&&typeof t==="number"){var r=Pi(e);return"rgba("+r.red+","+r.green+","+r.blue+","+t+")"}else if(typeof e==="number"&&typeof t==="number"&&typeof n==="number"&&typeof i==="number")return i>=1?Of(e,t,n):"rgba("+e+","+t+","+n+","+i+")";else if(typeof e==="object"&&t===void 0&&n===void 0&&i===void 0)return e.alpha>=1?Of(e.red,e.green,e.blue):"rgba("+e.red+","+e.green+","+e.blue+","+e.alpha+")";throw new hn(7)}var jE=function(t){return typeof t.red==="number"&&typeof t.green==="number"&&typeof t.blue==="number"&&(typeof t.alpha!=="number"||typeof t.alpha>"u")},YE=function(t){return typeof t.red==="number"&&typeof t.green==="number"&&typeof t.blue==="number"&&typeof t.alpha==="number"},$E=function(t){return typeof t.hue==="number"&&typeof t.saturation==="number"&&typeof t.lightness==="number"&&(typeof t.alpha!=="number"||typeof t.alpha>"u")},ZE=function(t){return typeof t.hue==="number"&&typeof t.saturation==="number"&&typeof t.lightness==="number"&&typeof t.alpha==="number"};function Li(e){if(typeof e!=="object")throw new hn(8);if(YE(e))return Sl(e);if(jE(e))return Of(e);if(ZE(e))return qE(e);if($E(e))return XE(e);throw new hn(8)}function A0(e,t,n){return function(){var r=n.concat(Array.prototype.slice.call(arguments));return r.length>=t?e.apply(this,r):A0(e,t,r)}}function _n(e){return A0(e,e.length,[])}function JE(e,t){if(t==="transparent")return t;var n=Ii(t);return Li(tn({},n,{hue:n.hue+parseFloat(e)}))}var Oz=_n(JE);function ss(e,t,n){return Math.max(e,Math.min(t,n))}function KE(e,t){if(t==="transparent")return t;var n=Ii(t);return Li(tn({},n,{lightness:ss(0,1,n.lightness-parseFloat(e))}))}var Uz=_n(KE);function QE(e,t){if(t==="transparent")return t;var n=Ii(t);return Li(tn({},n,{saturation:ss(0,1,n.saturation-parseFloat(e))}))}var Fz=_n(QE);function eA(e,t){if(t==="transparent")return t;var n=Ii(t);return Li(tn({},n,{lightness:ss(0,1,n.lightness+parseFloat(e))}))}var Bz=_n(eA);function tA(e,t,n){if(t==="transparent")return n;if(n==="transparent")return t;if(e===0)return n;var i=Pi(t),r=tn({},i,{alpha:typeof i.alpha==="number"?i.alpha:1}),s=Pi(n),o=tn({},s,{alpha:typeof s.alpha==="number"?s.alpha:1}),a=r.alpha-o.alpha,l=parseFloat(e)*2-1,c=l*a===-1?l:l+a,u=1+l*a,f=(c/u+1)/2,h=1-f,d={red:Math.floor(r.red*f+o.red*h),green:Math.floor(r.green*f+o.green*h),blue:Math.floor(r.blue*f+o.blue*h),alpha:r.alpha*parseFloat(e)+o.alpha*(1-parseFloat(e))};return Sl(d)}var nA=_n(tA),C0=nA;function iA(e,t){if(t==="transparent")return t;var n=Pi(t),i=typeof n.alpha==="number"?n.alpha:1,r=tn({},n,{alpha:ss(0,1,(i*100+parseFloat(e)*100)/100)});return Sl(r)}var rA=_n(iA),R0=rA;function sA(e,t){if(t==="transparent")return t;var n=Ii(t);return Li(tn({},n,{saturation:ss(0,1,n.saturation+parseFloat(e))}))}var kz=_n(sA);function oA(e,t){if(t==="transparent")return t;return Li(tn({},Ii(t),{hue:parseFloat(e)}))}var zz=_n(oA);function aA(e,t){if(t==="transparent")return t;return Li(tn({},Ii(t),{lightness:parseFloat(e)}))}var Gz=_n(aA);function lA(e,t){if(t==="transparent")return t;return Li(tn({},Ii(t),{saturation:parseFloat(e)}))}var Hz=_n(lA);function cA(e,t){if(t==="transparent")return t;return C0(parseFloat(e),"rgb(0, 0, 0)",t)}var Vz=_n(cA);function hA(e,t){if(t==="transparent")return t;return C0(parseFloat(e),"rgb(255, 255, 255)",t)}var Wz=_n(hA);function uA(e,t){if(t==="transparent")return t;var n=Pi(t),i=typeof n.alpha==="number"?n.alpha:1,r=tn({},n,{alpha:ss(0,1,+(i*100-parseFloat(e)*100).toFixed(2)/100)});return Sl(r)}var Xz=_n(uA);var Di=Object.freeze({Linear:Object.freeze({None:function(e){return e},In:function(e){return e},Out:function(e){return e},InOut:function(e){return e}}),Quadratic:Object.freeze({In:function(e){return e*e},Out:function(e){return e*(2-e)},InOut:function(e){if((e*=2)<1)return 0.5*e*e;return-0.5*(--e*(e-2)-1)}}),Cubic:Object.freeze({In:function(e){return e*e*e},Out:function(e){return--e*e*e+1},InOut:function(e){if((e*=2)<1)return 0.5*e*e*e;return 0.5*((e-=2)*e*e+2)}}),Quartic:Object.freeze({In:function(e){return e*e*e*e},Out:function(e){return 1- --e*e*e*e},InOut:function(e){if((e*=2)<1)return 0.5*e*e*e*e;return-0.5*((e-=2)*e*e*e-2)}}),Quintic:Object.freeze({In:function(e){return e*e*e*e*e},Out:function(e){return--e*e*e*e*e+1},InOut:function(e){if((e*=2)<1)return 0.5*e*e*e*e*e;return 0.5*((e-=2)*e*e*e*e+2)}}),Sinusoidal:Object.freeze({In:function(e){return 1-Math.sin((1-e)*Math.PI/2)},Out:function(e){return Math.sin(e*Math.PI/2)},InOut:function(e){return 0.5*(1-Math.sin(Math.PI*(0.5-e)))}}),Exponential:Object.freeze({In:function(e){return e===0?0:Math.pow(1024,e-1)},Out:function(e){return e===1?1:1-Math.pow(2,-10*e)},InOut:function(e){if(e===0)return 0;if(e===1)return 1;if((e*=2)<1)return 0.5*Math.pow(1024,e-1);return 0.5*(-Math.pow(2,-10*(e-1))+2)}}),Circular:Object.freeze({In:function(e){return 1-Math.sqrt(1-e*e)},Out:function(e){return Math.sqrt(1- --e*e)},InOut:function(e){if((e*=2)<1)return-0.5*(Math.sqrt(1-e*e)-1);return 0.5*(Math.sqrt(1-(e-=2)*e)+1)}}),Elastic:Object.freeze({In:function(e){if(e===0)return 0;if(e===1)return 1;return-Math.pow(2,10*(e-1))*Math.sin((e-1.1)*5*Math.PI)},Out:function(e){if(e===0)return 0;if(e===1)return 1;return Math.pow(2,-10*e)*Math.sin((e-0.1)*5*Math.PI)+1},InOut:function(e){if(e===0)return 0;if(e===1)return 1;if(e*=2,e<1)return-0.5*Math.pow(2,10*(e-1))*Math.sin((e-1.1)*5*Math.PI);return 0.5*Math.pow(2,-10*(e-1))*Math.sin((e-1.1)*5*Math.PI)+1}}),Back:Object.freeze({In:function(e){var t=1.70158;return e===1?1:e*e*((t+1)*e-t)},Out:function(e){var t=1.70158;return e===0?0:--e*e*((t+1)*e+t)+1},InOut:function(e){var t=2.5949095;if((e*=2)<1)return 0.5*(e*e*((t+1)*e-t));return 0.5*((e-=2)*e*((t+1)*e+t)+2)}}),Bounce:Object.freeze({In:function(e){return 1-Di.Bounce.Out(1-e)},Out:function(e){if(e<0.36363636363636365)return 7.5625*e*e;else if(e<0.7272727272727273)return 7.5625*(e-=0.5454545454545454)*e+0.75;else if(e<0.9090909090909091)return 7.5625*(e-=0.8181818181818182)*e+0.9375;else return 7.5625*(e-=0.9545454545454546)*e+0.984375},InOut:function(e){if(e<0.5)return Di.Bounce.In(e*2)*0.5;return Di.Bounce.Out(e*2-1)*0.5+0.5}}),generatePow:function(e){if(e===void 0)e=4;return e=e<Number.EPSILON?Number.EPSILON:e,e=e>1e4?1e4:e,{In:function(t){return Math.pow(t,e)},Out:function(t){return 1-Math.pow(1-t,e)},InOut:function(t){if(t<0.5)return Math.pow(t*2,e)/2;return(1-Math.pow(2-t*2,e))/2+0.5}}}}),go=function(){return performance.now()},Ff=function(){function e(){var t=[];for(var n=0;n<arguments.length;n++)t[n]=arguments[n];this._tweens={},this._tweensAddedDuringUpdate={},this.add.apply(this,t)}return e.prototype.getAll=function(){var t=this;return Object.keys(this._tweens).map(function(n){return t._tweens[n]})},e.prototype.removeAll=function(){this._tweens={}},e.prototype.add=function(){var t,n=[];for(var i=0;i<arguments.length;i++)n[i]=arguments[i];for(var r=0,s=n;r<s.length;r++){var o=s[r];(t=o._group)===null||t===void 0||t.remove(o),o._group=this,this._tweens[o.getId()]=o,this._tweensAddedDuringUpdate[o.getId()]=o}},e.prototype.remove=function(){var t=[];for(var n=0;n<arguments.length;n++)t[n]=arguments[n];for(var i=0,r=t;i<r.length;i++){var s=r[i];s._group=void 0,delete this._tweens[s.getId()],delete this._tweensAddedDuringUpdate[s.getId()]}},e.prototype.allStopped=function(){return this.getAll().every(function(t){return!t.isPlaying()})},e.prototype.update=function(t,n){if(t===void 0)t=go();if(n===void 0)n=!0;var i=Object.keys(this._tweens);if(i.length===0)return;while(i.length>0){this._tweensAddedDuringUpdate={};for(var r=0;r<i.length;r++){var s=this._tweens[i[r]],o=!n;if(s&&s.update(t,o)===!1&&!n)this.remove(s)}i=Object.keys(this._tweensAddedDuringUpdate)}},e}(),os={Linear:function(e,t){var n=e.length-1,i=n*t,r=Math.floor(i),s=os.Utils.Linear;if(t<0)return s(e[0],e[1],i);if(t>1)return s(e[n],e[n-1],n-i);return s(e[r],e[r+1>n?n:r+1],i-r)},Bezier:function(e,t){var n=0,i=e.length-1,r=Math.pow,s=os.Utils.Bernstein;for(var o=0;o<=i;o++)n+=r(1-t,i-o)*r(t,o)*e[o]*s(i,o);return n},CatmullRom:function(e,t){var n=e.length-1,i=n*t,r=Math.floor(i),s=os.Utils.CatmullRom;if(e[0]===e[n]){if(t<0)r=Math.floor(i=n*(1+t));return s(e[(r-1+n)%n],e[r],e[(r+1)%n],e[(r+2)%n],i-r)}else{if(t<0)return e[0]-(s(e[0],e[0],e[1],e[1],-i)-e[0]);if(t>1)return e[n]-(s(e[n],e[n],e[n-1],e[n-1],i-n)-e[n]);return s(e[r?r-1:0],e[r],e[n<r+1?n:r+1],e[n<r+2?n:r+2],i-r)}},Utils:{Linear:function(e,t,n){return(t-e)*n+e},Bernstein:function(e,t){var n=os.Utils.Factorial;return n(e)/n(t)/n(e-t)},Factorial:function(){var e=[1];return function(t){var n=1;if(e[t])return e[t];for(var i=t;i>1;i--)n*=i;return e[t]=n,n}}(),CatmullRom:function(e,t,n,i,r){var s=(n-e)*0.5,o=(i-t)*0.5,a=r*r,l=r*a;return(2*t-2*n+s+o)*l+(-3*t+3*n-2*s-o)*a+s*r+t}}},P0=function(){function e(){}return e.nextId=function(){return e._nextId++},e._nextId=0,e}(),Uf=new Ff,Bf=function(){function e(t,n){if(this._isPaused=!1,this._pauseStart=0,this._valuesStart={},this._valuesEnd={},this._valuesStartRepeat={},this._duration=1000,this._isDynamic=!1,this._initialRepeat=0,this._repeat=0,this._yoyo=!1,this._isPlaying=!1,this._reversed=!1,this._delayTime=0,this._startTime=0,this._easingFunction=Di.Linear.None,this._interpolationFunction=os.Linear,this._chainedTweens=[],this._onStartCallbackFired=!1,this._onEveryStartCallbackFired=!1,this._id=P0.nextId(),this._isChainStopped=!1,this._propertiesAreSetUp=!1,this._goToEnd=!1,this._object=t,typeof n==="object")this._group=n,n.add(this);else if(n===!0)this._group=Uf,Uf.add(this)}return e.prototype.getId=function(){return this._id},e.prototype.isPlaying=function(){return this._isPlaying},e.prototype.isPaused=function(){return this._isPaused},e.prototype.getDuration=function(){return this._duration},e.prototype.to=function(t,n){if(n===void 0)n=1000;if(this._isPlaying)throw Error("Can not call Tween.to() while Tween is already started or paused. Stop the Tween first.");return this._valuesEnd=t,this._propertiesAreSetUp=!1,this._duration=n<0?0:n,this},e.prototype.duration=function(t){if(t===void 0)t=1000;return this._duration=t<0?0:t,this},e.prototype.dynamic=function(t){if(t===void 0)t=!1;return this._isDynamic=t,this},e.prototype.start=function(t,n){if(t===void 0)t=go();if(n===void 0)n=!1;if(this._isPlaying)return this;if(this._repeat=this._initialRepeat,this._reversed){this._reversed=!1;for(var i in this._valuesStartRepeat)this._swapEndStartRepeatValues(i),this._valuesStart[i]=this._valuesStartRepeat[i]}if(this._isPlaying=!0,this._isPaused=!1,this._onStartCallbackFired=!1,this._onEveryStartCallbackFired=!1,this._isChainStopped=!1,this._startTime=t,this._startTime+=this._delayTime,!this._propertiesAreSetUp||n){if(this._propertiesAreSetUp=!0,!this._isDynamic){var r={};for(var s in this._valuesEnd)r[s]=this._valuesEnd[s];this._valuesEnd=r}this._setupProperties(this._object,this._valuesStart,this._valuesEnd,this._valuesStartRepeat,n)}return this},e.prototype.startFromCurrentValues=function(t){return this.start(t,!0)},e.prototype._setupProperties=function(t,n,i,r,s){for(var o in i){var a=t[o],l=Array.isArray(a),c=l?"array":typeof a,u=!l&&Array.isArray(i[o]);if(c==="undefined"||c==="function")continue;if(u){var f=i[o];if(f.length===0)continue;var h=[a];for(var d=0,g=f.length;d<g;d+=1){var _=this._handleRelativeValue(a,f[d]);if(isNaN(_)){u=!1,console.warn("Found invalid interpolation list. Skipping.");break}h.push(_)}if(u)i[o]=h}if((c==="object"||l)&&a&&!u){n[o]=l?[]:{};var m=a;for(var p in m)n[o][p]=m[p];r[o]=l?[]:{};var f=i[o];if(!this._isDynamic){var x={};for(var p in f)x[p]=f[p];i[o]=f=x}this._setupProperties(m,n[o],f,r[o],s)}else{if(typeof n[o]>"u"||s)n[o]=a;if(!l)n[o]*=1;if(u)r[o]=i[o].slice().reverse();else r[o]=n[o]||0}}},e.prototype.stop=function(){if(!this._isChainStopped)this._isChainStopped=!0,this.stopChainedTweens();if(!this._isPlaying)return this;if(this._isPlaying=!1,this._isPaused=!1,this._onStopCallback)this._onStopCallback(this._object);return this},e.prototype.end=function(){return this._goToEnd=!0,this.update(this._startTime+this._duration),this},e.prototype.pause=function(t){if(t===void 0)t=go();if(this._isPaused||!this._isPlaying)return this;return this._isPaused=!0,this._pauseStart=t,this},e.prototype.resume=function(t){if(t===void 0)t=go();if(!this._isPaused||!this._isPlaying)return this;return this._isPaused=!1,this._startTime+=t-this._pauseStart,this._pauseStart=0,this},e.prototype.stopChainedTweens=function(){for(var t=0,n=this._chainedTweens.length;t<n;t++)this._chainedTweens[t].stop();return this},e.prototype.group=function(t){if(!t)return console.warn("tween.group() without args has been removed, use group.add(tween) instead."),this;return t.add(this),this},e.prototype.remove=function(){var t;return(t=this._group)===null||t===void 0||t.remove(this),this},e.prototype.delay=function(t){if(t===void 0)t=0;return this._delayTime=t,this},e.prototype.repeat=function(t){if(t===void 0)t=0;return this._initialRepeat=t,this._repeat=t,this},e.prototype.repeatDelay=function(t){return this._repeatDelayTime=t,this},e.prototype.yoyo=function(t){if(t===void 0)t=!1;return this._yoyo=t,this},e.prototype.easing=function(t){if(t===void 0)t=Di.Linear.None;return this._easingFunction=t,this},e.prototype.interpolation=function(t){if(t===void 0)t=os.Linear;return this._interpolationFunction=t,this},e.prototype.chain=function(){var t=[];for(var n=0;n<arguments.length;n++)t[n]=arguments[n];return this._chainedTweens=t,this},e.prototype.onStart=function(t){return this._onStartCallback=t,this},e.prototype.onEveryStart=function(t){return this._onEveryStartCallback=t,this},e.prototype.onUpdate=function(t){return this._onUpdateCallback=t,this},e.prototype.onRepeat=function(t){return this._onRepeatCallback=t,this},e.prototype.onComplete=function(t){return this._onCompleteCallback=t,this},e.prototype.onStop=function(t){return this._onStopCallback=t,this},e.prototype.update=function(t,n){var i=this,r;if(t===void 0)t=go();if(n===void 0)n=e.autoStartOnUpdate;if(this._isPaused)return!0;var s;if(!this._goToEnd&&!this._isPlaying)if(n)this.start(t,!0);else return!1;if(this._goToEnd=!1,t<this._startTime)return!0;if(this._onStartCallbackFired===!1){if(this._onStartCallback)this._onStartCallback(this._object);this._onStartCallbackFired=!0}if(this._onEveryStartCallbackFired===!1){if(this._onEveryStartCallback)this._onEveryStartCallback(this._object);this._onEveryStartCallbackFired=!0}var o=t-this._startTime,a=this._duration+((r=this._repeatDelayTime)!==null&&r!==void 0?r:this._delayTime),l=this._duration+this._repeat*a,c=function(){if(i._duration===0)return 1;if(o>l)return 1;var _=Math.trunc(o/a),m=o-_*a,p=Math.min(m/i._duration,1);if(p===0&&o===i._duration)return 1;return p},u=c(),f=this._easingFunction(u);if(this._updateProperties(this._object,this._valuesStart,this._valuesEnd,f),this._onUpdateCallback)this._onUpdateCallback(this._object,u);if(this._duration===0||o>=this._duration)if(this._repeat>0){var h=Math.min(Math.trunc((o-this._duration)/a)+1,this._repeat);if(isFinite(this._repeat))this._repeat-=h;for(s in this._valuesStartRepeat){if(!this._yoyo&&typeof this._valuesEnd[s]==="string")this._valuesStartRepeat[s]=this._valuesStartRepeat[s]+parseFloat(this._valuesEnd[s]);if(this._yoyo)this._swapEndStartRepeatValues(s);this._valuesStart[s]=this._valuesStartRepeat[s]}if(this._yoyo)this._reversed=!this._reversed;if(this._startTime+=a*h,this._onRepeatCallback)this._onRepeatCallback(this._object);return this._onEveryStartCallbackFired=!1,!0}else{if(this._onCompleteCallback)this._onCompleteCallback(this._object);for(var d=0,g=this._chainedTweens.length;d<g;d++)this._chainedTweens[d].start(this._startTime+this._duration,!1);return this._isPlaying=!1,!1}return!0},e.prototype._updateProperties=function(t,n,i,r){for(var s in i){if(n[s]===void 0)continue;var o=n[s]||0,a=i[s],l=Array.isArray(t[s]),c=Array.isArray(a),u=!l&&c;if(u)t[s]=this._interpolationFunction(a,r);else if(typeof a==="object"&&a)this._updateProperties(t[s],o,a,r);else if(a=this._handleRelativeValue(o,a),typeof a==="number")t[s]=o+(a-o)*r}},e.prototype._handleRelativeValue=function(t,n){if(typeof n!=="string")return n;if(n.charAt(0)==="+"||n.charAt(0)==="-")return t+parseFloat(n);return parseFloat(n)},e.prototype._swapEndStartRepeatValues=function(t){var n=this._valuesStartRepeat[t],i=this._valuesEnd[t];if(typeof i==="string")this._valuesStartRepeat[t]=this._valuesStartRepeat[t]+parseFloat(i);else this._valuesStartRepeat[t]=this._valuesEnd[t];this._valuesEnd[t]=n},e.autoStartOnUpdate=!1,e}();var jz=P0.nextId,Yn=Uf,Yz=Yn.getAll.bind(Yn),$z=Yn.removeAll.bind(Yn),Zz=Yn.add.bind(Yn),Jz=Yn.remove.bind(Yn),Kz=Yn.update.bind(Yn);function kf(e){let t;while(t=e.sourceEvent)e=t;return e}function Ml(e,t){if(e=kf(e),t===void 0)t=e.currentTarget;if(t){var n=t.ownerSVGElement||t;if(n.createSVGPoint){var i=n.createSVGPoint();return i.x=e.clientX,i.y=e.clientY,i=i.matrixTransform(t.getScreenCTM().inverse()),[i.x,i.y]}if(t.getBoundingClientRect){var r=t.getBoundingClientRect();return[e.clientX-r.left-t.clientLeft,e.clientY-r.top-t.clientTop]}}return[e.pageX,e.pageY]}function fA(){}function _o(e){return e==null?fA:function(){return this.querySelector(e)}}function zf(e){if(typeof e!=="function")e=_o(e);for(var t=this._groups,n=t.length,i=Array(n),r=0;r<n;++r)for(var s=t[r],o=s.length,a=i[r]=Array(o),l,c,u=0;u<o;++u)if((l=s[u])&&(c=e.call(l,l.__data__,u,s))){if("__data__"in l)c.__data__=l.__data__;a[u]=c}return new bt(i,this._parents)}function Gf(e){return e==null?[]:Array.isArray(e)?e:Array.from(e)}function dA(){return[]}function Hf(e){return e==null?dA:function(){return this.querySelectorAll(e)}}function pA(e){return function(){return Gf(e.apply(this,arguments))}}function Vf(e){if(typeof e==="function")e=pA(e);else e=Hf(e);for(var t=this._groups,n=t.length,i=[],r=[],s=0;s<n;++s)for(var o=t[s],a=o.length,l,c=0;c<a;++c)if(l=o[c])i.push(e.call(l,l.__data__,c,o)),r.push(l);return new bt(i,r)}function Wf(e){return function(){return this.matches(e)}}function wl(e){return function(t){return t.matches(e)}}var mA=Array.prototype.find;function gA(e){return function(){return mA.call(this.children,e)}}function _A(){return this.firstElementChild}function Xf(e){return this.select(e==null?_A:gA(typeof e==="function"?e:wl(e)))}var vA=Array.prototype.filter;function yA(){return Array.from(this.children)}function xA(e){return function(){return vA.call(this.children,e)}}function qf(e){return this.selectAll(e==null?yA:xA(typeof e==="function"?e:wl(e)))}function jf(e){if(typeof e!=="function")e=Wf(e);for(var t=this._groups,n=t.length,i=Array(n),r=0;r<n;++r)for(var s=t[r],o=s.length,a=i[r]=[],l,c=0;c<o;++c)if((l=s[c])&&e.call(l,l.__data__,c,s))a.push(l);return new bt(i,this._parents)}function vo(e){return Array(e.length)}function Yf(){return new bt(this._enter||this._groups.map(vo),this._parents)}function yo(e,t){this.ownerDocument=e.ownerDocument,this.namespaceURI=e.namespaceURI,this._next=null,this._parent=e,this.__data__=t}yo.prototype={constructor:yo,appendChild:function(e){return this._parent.insertBefore(e,this._next)},insertBefore:function(e,t){return this._parent.insertBefore(e,t)},querySelector:function(e){return this._parent.querySelector(e)},querySelectorAll:function(e){return this._parent.querySelectorAll(e)}};function $f(e){return function(){return e}}function bA(e,t,n,i,r,s){var o=0,a,l=t.length,c=s.length;for(;o<c;++o)if(a=t[o])a.__data__=s[o],i[o]=a;else n[o]=new yo(e,s[o]);for(;o<l;++o)if(a=t[o])r[o]=a}function SA(e,t,n,i,r,s,o){var a,l,c=new Map,u=t.length,f=s.length,h=Array(u),d;for(a=0;a<u;++a)if(l=t[a])if(h[a]=d=o.call(l,l.__data__,a,t)+"",c.has(d))r[a]=l;else c.set(d,l);for(a=0;a<f;++a)if(d=o.call(e,s[a],a,s)+"",l=c.get(d))i[a]=l,l.__data__=s[a],c.delete(d);else n[a]=new yo(e,s[a]);for(a=0;a<u;++a)if((l=t[a])&&c.get(h[a])===l)r[a]=l}function MA(e){return e.__data__}function Zf(e,t){if(!arguments.length)return Array.from(this,MA);var n=t?SA:bA,i=this._parents,r=this._groups;if(typeof e!=="function")e=$f(e);for(var s=r.length,o=Array(s),a=Array(s),l=Array(s),c=0;c<s;++c){var u=i[c],f=r[c],h=f.length,d=wA(e.call(u,u&&u.__data__,c,i)),g=d.length,_=a[c]=Array(g),m=o[c]=Array(g),p=l[c]=Array(h);n(u,f,_,m,p,d,t);for(var x=0,S=0,v,b;x<g;++x)if(v=_[x]){if(x>=S)S=x+1;while(!(b=m[S])&&++S<g);v._next=b||null}}return o=new bt(o,i),o._enter=a,o._exit=l,o}function wA(e){return typeof e==="object"&&"length"in e?e:Array.from(e)}function Jf(){return new bt(this._exit||this._groups.map(vo),this._parents)}function Kf(e,t,n){var i=this.enter(),r=this,s=this.exit();if(typeof e==="function"){if(i=e(i),i)i=i.selection()}else i=i.append(e+"");if(t!=null){if(r=t(r),r)r=r.selection()}if(n==null)s.remove();else n(s);return i&&r?i.merge(r).order():r}function Qf(e){var t=e.selection?e.selection():e;for(var n=this._groups,i=t._groups,r=n.length,s=i.length,o=Math.min(r,s),a=Array(r),l=0;l<o;++l)for(var c=n[l],u=i[l],f=c.length,h=a[l]=Array(f),d,g=0;g<f;++g)if(d=c[g]||u[g])h[g]=d;for(;l<r;++l)a[l]=n[l];return new bt(a,this._parents)}function ed(){for(var e=this._groups,t=-1,n=e.length;++t<n;)for(var i=e[t],r=i.length-1,s=i[r],o;--r>=0;)if(o=i[r]){if(s&&o.compareDocumentPosition(s)^4)s.parentNode.insertBefore(o,s);s=o}return this}function td(e){if(!e)e=TA;function t(f,h){return f&&h?e(f.__data__,h.__data__):!f-!h}for(var n=this._groups,i=n.length,r=Array(i),s=0;s<i;++s){for(var o=n[s],a=o.length,l=r[s]=Array(a),c,u=0;u<a;++u)if(c=o[u])l[u]=c;l.sort(t)}return new bt(r,this._parents).order()}function TA(e,t){return e<t?-1:e>t?1:e>=t?0:NaN}function nd(){var e=arguments[0];return arguments[0]=this,e.apply(null,arguments),this}function id(){return Array.from(this)}function rd(){for(var e=this._groups,t=0,n=e.length;t<n;++t)for(var i=e[t],r=0,s=i.length;r<s;++r){var o=i[r];if(o)return o}return null}function sd(){let e=0;for(let t of this)++e;return e}function od(){return!this.node()}function ad(e){for(var t=this._groups,n=0,i=t.length;n<i;++n)for(var r=t[n],s=0,o=r.length,a;s<o;++s)if(a=r[s])e.call(a,a.__data__,s,r);return this}var Tl="http://www.w3.org/1999/xhtml",ld={svg:"http://www.w3.org/2000/svg",xhtml:Tl,xlink:"http://www.w3.org/1999/xlink",xml:"http://www.w3.org/XML/1998/namespace",xmlns:"http://www.w3.org/2000/xmlns/"};function xo(e){var t=e+="",n=t.indexOf(":");if(n>=0&&(t=e.slice(0,n))!=="xmlns")e=e.slice(n+1);return ld.hasOwnProperty(t)?{space:ld[t],local:e}:e}function EA(e){return function(){this.removeAttribute(e)}}function AA(e){return function(){this.removeAttributeNS(e.space,e.local)}}function CA(e,t){return function(){this.setAttribute(e,t)}}function RA(e,t){return function(){this.setAttributeNS(e.space,e.local,t)}}function PA(e,t){return function(){var n=t.apply(this,arguments);if(n==null)this.removeAttribute(e);else this.setAttribute(e,n)}}function IA(e,t){return function(){var n=t.apply(this,arguments);if(n==null)this.removeAttributeNS(e.space,e.local);else this.setAttributeNS(e.space,e.local,n)}}function cd(e,t){var n=xo(e);if(arguments.length<2){var i=this.node();return n.local?i.getAttributeNS(n.space,n.local):i.getAttribute(n)}return this.each((t==null?n.local?AA:EA:typeof t==="function"?n.local?IA:PA:n.local?RA:CA)(n,t))}function bo(e){return e.ownerDocument&&e.ownerDocument.defaultView||e.document&&e||e.defaultView}function LA(e){return function(){this.style.removeProperty(e)}}function DA(e,t,n){return function(){this.style.setProperty(e,t,n)}}function NA(e,t,n){return function(){var i=t.apply(this,arguments);if(i==null)this.style.removeProperty(e);else this.style.setProperty(e,i,n)}}function hd(e,t,n){return arguments.length>1?this.each((t==null?LA:typeof t==="function"?NA:DA)(e,t,n==null?"":n)):OA(this.node(),e)}function OA(e,t){return e.style.getPropertyValue(t)||bo(e).getComputedStyle(e,null).getPropertyValue(t)}function UA(e){return function(){delete this[e]}}function FA(e,t){return function(){this[e]=t}}function BA(e,t){return function(){var n=t.apply(this,arguments);if(n==null)delete this[e];else this[e]=n}}function ud(e,t){return arguments.length>1?this.each((t==null?UA:typeof t==="function"?BA:FA)(e,t)):this.node()[e]}function I0(e){return e.trim().split(/^|\s+/)}function fd(e){return e.classList||new L0(e)}function L0(e){this._node=e,this._names=I0(e.getAttribute("class")||"")}L0.prototype={add:function(e){var t=this._names.indexOf(e);if(t<0)this._names.push(e),this._node.setAttribute("class",this._names.join(" "))},remove:function(e){var t=this._names.indexOf(e);if(t>=0)this._names.splice(t,1),this._node.setAttribute("class",this._names.join(" "))},contains:function(e){return this._names.indexOf(e)>=0}};function D0(e,t){var n=fd(e),i=-1,r=t.length;while(++i<r)n.add(t[i])}function N0(e,t){var n=fd(e),i=-1,r=t.length;while(++i<r)n.remove(t[i])}function kA(e){return function(){D0(this,e)}}function zA(e){return function(){N0(this,e)}}function GA(e,t){return function(){(t.apply(this,arguments)?D0:N0)(this,e)}}function dd(e,t){var n=I0(e+"");if(arguments.length<2){var i=fd(this.node()),r=-1,s=n.length;while(++r<s)if(!i.contains(n[r]))return!1;return!0}return this.each((typeof t==="function"?GA:t?kA:zA)(n,t))}function HA(){this.textContent=""}function VA(e){return function(){this.textContent=e}}function WA(e){return function(){var t=e.apply(this,arguments);this.textContent=t==null?"":t}}function pd(e){return arguments.length?this.each(e==null?HA:(typeof e==="function"?WA:VA)(e)):this.node().textContent}function XA(){this.innerHTML=""}function qA(e){return function(){this.innerHTML=e}}function jA(e){return function(){var t=e.apply(this,arguments);this.innerHTML=t==null?"":t}}function md(e){return arguments.length?this.each(e==null?XA:(typeof e==="function"?jA:qA)(e)):this.node().innerHTML}function YA(){if(this.nextSibling)this.parentNode.appendChild(this)}function gd(){return this.each(YA)}function $A(){if(this.previousSibling)this.parentNode.insertBefore(this,this.parentNode.firstChild)}function _d(){return this.each($A)}function ZA(e){return function(){var t=this.ownerDocument,n=this.namespaceURI;return n===Tl&&t.documentElement.namespaceURI===Tl?t.createElement(e):t.createElementNS(n,e)}}function JA(e){return function(){return this.ownerDocument.createElementNS(e.space,e.local)}}function So(e){var t=xo(e);return(t.local?JA:ZA)(t)}function vd(e){var t=typeof e==="function"?e:So(e);return this.select(function(){return this.appendChild(t.apply(this,arguments))})}function KA(){return null}function yd(e,t){var n=typeof e==="function"?e:So(e),i=t==null?KA:typeof t==="function"?t:_o(t);return this.select(function(){return this.insertBefore(n.apply(this,arguments),i.apply(this,arguments)||null)})}function QA(){var e=this.parentNode;if(e)e.removeChild(this)}function xd(){return this.each(QA)}function eC(){var e=this.cloneNode(!1),t=this.parentNode;return t?t.insertBefore(e,this.nextSibling):e}function tC(){var e=this.cloneNode(!0),t=this.parentNode;return t?t.insertBefore(e,this.nextSibling):e}function bd(e){return this.select(e?tC:eC)}function Sd(e){return arguments.length?this.property("__data__",e):this.node().__data__}function nC(e){return function(t){e.call(this,t,this.__data__)}}function iC(e){return e.trim().split(/^|\s+/).map(function(t){var n="",i=t.indexOf(".");if(i>=0)n=t.slice(i+1),t=t.slice(0,i);return{type:t,name:n}})}function rC(e){return function(){var t=this.__on;if(!t)return;for(var n=0,i=-1,r=t.length,s;n<r;++n)if(s=t[n],(!e.type||s.type===e.type)&&s.name===e.name)this.removeEventListener(s.type,s.listener,s.options);else t[++i]=s;if(++i)t.length=i;else delete this.__on}}function sC(e,t,n){return function(){var i=this.__on,r,s=nC(t);if(i){for(var o=0,a=i.length;o<a;++o)if((r=i[o]).type===e.type&&r.name===e.name){this.removeEventListener(r.type,r.listener,r.options),this.addEventListener(r.type,r.listener=s,r.options=n),r.value=t;return}}if(this.addEventListener(e.type,s,n),r={type:e.type,name:e.name,value:t,listener:s,options:n},!i)this.__on=[r];else i.push(r)}}function Md(e,t,n){var i=iC(e+""),r,s=i.length,o;if(arguments.length<2){var a=this.node().__on;if(a){for(var l=0,c=a.length,u;l<c;++l)for(r=0,u=a[l];r<s;++r)if((o=i[r]).type===u.type&&o.name===u.name)return u.value}return}a=t?sC:rC;for(r=0;r<s;++r)this.each(a(i[r],t,n));return this}function O0(e,t,n){var i=bo(e),r=i.CustomEvent;if(typeof r==="function")r=new r(t,n);else if(r=i.document.createEvent("Event"),n)r.initEvent(t,n.bubbles,n.cancelable),r.detail=n.detail;else r.initEvent(t,!1,!1);e.dispatchEvent(r)}function oC(e,t){return function(){return O0(this,e,t)}}function aC(e,t){return function(){return O0(this,e,t.apply(this,arguments))}}function wd(e,t){return this.each((typeof t==="function"?aC:oC)(e,t))}function*Td(){for(var e=this._groups,t=0,n=e.length;t<n;++t)for(var i=e[t],r=0,s=i.length,o;r<s;++r)if(o=i[r])yield o}var Ed=[null];function bt(e,t){this._groups=e,this._parents=t}function lC(){return new bt([[document.documentElement]],Ed)}function cC(){return this}bt.prototype=lC.prototype={constructor:bt,select:zf,selectAll:Vf,selectChild:Xf,selectChildren:qf,filter:jf,data:Zf,enter:Yf,exit:Jf,join:Kf,merge:Qf,selection:cC,order:ed,sort:td,call:nd,nodes:id,node:rd,size:sd,empty:od,each:ad,attr:cd,style:hd,property:ud,classed:dd,text:pd,html:md,raise:gd,lower:_d,append:vd,insert:yd,remove:xd,clone:bd,datum:Sd,on:Md,dispatch:wd,[Symbol.iterator]:Td};function El(e){return typeof e==="string"?new bt([[document.querySelector(e)]],[document.documentElement]):new bt([[e]],Ed)}var To,vt,z0,Pd,Ni,U0,G0,H0,Ad,Cl,Mo,V0,Id,Cd,Rd,hC,Pl={},Il=[],uC=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,Dl=Array.isArray;function $n(e,t){for(var n in t)e[n]=t[n];return e}function Ld(e){e&&e.parentNode&&e.parentNode.removeChild(e)}function fC(e,t,n){var i,r,s,o={};for(s in t)s=="key"?i=t[s]:s=="ref"?r=t[s]:o[s]=t[s];if(arguments.length>2&&(o.children=arguments.length>3?To.call(arguments,2):n),typeof e=="function"&&e.defaultProps!=null)for(s in e.defaultProps)o[s]===void 0&&(o[s]=e.defaultProps[s]);return wo(e,o,i,r,null)}function wo(e,t,n,i,r){var s={type:e,props:t,key:n,ref:i,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:r==null?++z0:r,__i:-1,__u:0};return r==null&&vt.vnode!=null&&vt.vnode(s),s}function Nl(e){return e.children}function Rl(e,t){this.props=e,this.context=t}function hr(e,t){if(t==null)return e.__?hr(e.__,e.__i+1):null;for(var n;t<e.__k.length;t++)if((n=e.__k[t])!=null&&n.__e!=null)return n.__e;return typeof e.type=="function"?hr(e):null}function dC(e){if(e.__P&&e.__d){var t=e.__v,n=t.__e,i=[],r=[],s=$n({},t);s.__v=t.__v+1,vt.vnode&&vt.vnode(s),Dd(e.__P,s,t,e.__n,e.__P.namespaceURI,32&t.__u?[n]:null,i,n==null?hr(t):n,!!(32&t.__u),r),s.__v=t.__v,s.__.__k[s.__i]=s,Y0(i,s,r),t.__e=t.__=null,s.__e!=n&&W0(s)}}function W0(e){if((e=e.__)!=null&&e.__c!=null)return e.__e=e.__c.base=null,e.__k.some(function(t){if(t!=null&&t.__e!=null)return e.__e=e.__c.base=t.__e}),W0(e)}function F0(e){(!e.__d&&(e.__d=!0)&&Ni.push(e)&&!Ll.__r++||U0!=vt.debounceRendering)&&((U0=vt.debounceRendering)||G0)(Ll)}function Ll(){try{for(var e,t=1;Ni.length;)Ni.length>t&&Ni.sort(H0),e=Ni.shift(),t=Ni.length,dC(e)}finally{Ni.length=Ll.__r=0}}function X0(e,t,n,i,r,s,o,a,l,c,u){var f,h,d,g,_,m,p=i&&i.__k||Il,x=t.length;for(l=pC(n,t,p,l,x),f=0;f<x;f++)(d=n.__k[f])!=null&&(h=d.__i!=-1&&p[d.__i]||Pl,d.__i=f,m=Dd(e,d,h,r,s,o,a,l,c,u),g=d.__e,d.ref&&h.ref!=d.ref&&(h.ref&&Nd(h.ref,null,d),u.push(d.ref,d.__c||g,d)),_==null&&g!=null&&(_=g),4&d.__u?(l=q0(d,l,e),h.__e&&(h.__e=null)):typeof d.type=="function"&&m!==void 0?l=m:g&&(l=g.nextSibling),d.__u&=-7);return n.__e=_,l}function pC(e,t,n,i,r){var s,o,a,l,c,u=n.length,f=u,h=0;for(e.__k=Array(r),s=0;s<r;s++)(o=t[s])!=null&&typeof o!="boolean"&&typeof o!="function"?(typeof o=="string"||typeof o=="number"||typeof o=="bigint"||o.constructor==String?o=e.__k[s]=wo(null,o,null,null,null):Dl(o)?o=e.__k[s]=wo(Nl,{children:o},null,null,null):o.constructor===void 0&&o.__b>0?o=e.__k[s]=wo(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):e.__k[s]=o,l=s+h,o.__=e,o.__b=e.__b+1,a=null,(c=o.__i=mC(o,n,l,f))!=-1&&(f--,(a=n[c])&&(a.__u|=2)),a==null||a.__v==null?(c==-1&&(r>u?h--:r<u&&h++),typeof o.type!="function"&&(o.__u|=4)):c!=l&&(c==l-1?h--:c==l+1?h++:(c>l?h--:h++,o.__u|=4))):e.__k[s]=null;if(f)for(s=0;s<u;s++)(a=n[s])!=null&&(2&a.__u)==0&&(a.__e==i&&(i=hr(a)),Z0(a,a));return i}function q0(e,t,n){var i,r;if(typeof e.type=="function"){for(i=e.__k,r=0;i&&r<i.length;r++)i[r]&&(i[r].__=e,t=q0(i[r],t,n));return t}e.__e!=t&&(t&&e.type&&!t.parentNode&&(t=hr(e)),t=n.insertBefore(e.__e,t||null));do t=t&&t.nextSibling;while(t!=null&&t.nodeType==8);return t}function mC(e,t,n,i){var r,s,o,{key:a,type:l}=e,c=t[n],u=c!=null&&(2&c.__u)==0;if(c===null&&a==null||u&&a==c.key&&l==c.type)return n;if(i>(u?1:0)){for(r=n-1,s=n+1;r>=0||s<t.length;)if((c=t[o=r>=0?r--:s++])!=null&&(2&c.__u)==0&&a==c.key&&l==c.type)return o}return-1}function B0(e,t,n){t[0]=="-"?e.setProperty(t,n==null?"":n):e[t]=n==null?"":typeof n!="number"||uC.test(t)?n:n+"px"}function Al(e,t,n,i,r){var s,o;e:if(t=="style")if(typeof n=="string")e.style.cssText=n;else{if(typeof i=="string"&&(e.style.cssText=i=""),i)for(t in i)n&&t in n||B0(e.style,t,"");if(n)for(t in n)i&&n[t]==i[t]||B0(e.style,t,n[t])}else if(t[0]=="o"&&t[1]=="n")s=t!=(t=t.replace(V0,"$1")),o=t.toLowerCase(),t=o in e||t=="onFocusOut"||t=="onFocusIn"?o.slice(2):t.slice(2),e.l||(e.l={}),e.l[t+s]=n,n?i?n[Mo]=i[Mo]:(n[Mo]=Id,e.addEventListener(t,s?Rd:Cd,s)):e.removeEventListener(t,s?Rd:Cd,s);else{if(r=="http://www.w3.org/2000/svg")t=t.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if(t!="width"&&t!="height"&&t!="href"&&t!="list"&&t!="form"&&t!="tabIndex"&&t!="download"&&t!="rowSpan"&&t!="colSpan"&&t!="role"&&t!="popover"&&t in e)try{e[t]=n==null?"":n;break e}catch(a){}typeof n=="function"||(n==null||n===!1&&t[4]!="-"?e.removeAttribute(t):e.setAttribute(t,t=="popover"&&n==1?"":n))}}function k0(e){return function(t){if(this.l){var n=this.l[t.type+e];if(t[Cl]==null)t[Cl]=Id++;else if(t[Cl]<n[Mo])return;return n(vt.event?vt.event(t):t)}}}function Dd(e,t,n,i,r,s,o,a,l,c){var u,f,h,d,g,_,m,p,x,S,v,b,w,E,y,A,N=t.type;if(t.constructor!==void 0)return null;128&n.__u&&(l=!!(32&n.__u),s=[a=t.__e=n.__e]),(u=vt.__b)&&u(t);e:if(typeof N=="function"){f=o.length;try{if(x=t.props,S=N.prototype&&N.prototype.render,v=(u=N.contextType)&&i[u.__c],b=u?v?v.props.value:u.__:i,n.__c?p=(h=t.__c=n.__c).__=h.__E:(S?t.__c=h=new N(x,b):(t.__c=h=new Rl(x,b),h.constructor=N,h.render=_C),v&&v.sub(h),h.state||(h.state={}),h.__n=i,d=h.__d=!0,h.__h=[],h._sb=[]),S&&h.__s==null&&(h.__s=h.state),S&&N.getDerivedStateFromProps!=null&&(h.__s==h.state&&(h.__s=$n({},h.__s)),$n(h.__s,N.getDerivedStateFromProps(x,h.__s))),g=h.props,_=h.state,h.__v=t,d)S&&N.getDerivedStateFromProps==null&&h.componentWillMount!=null&&h.componentWillMount(),S&&h.componentDidMount!=null&&h.__h.push(h.componentDidMount);else{if(S&&N.getDerivedStateFromProps==null&&x!==g&&h.componentWillReceiveProps!=null&&h.componentWillReceiveProps(x,b),t.__v==n.__v||!h.__e&&h.shouldComponentUpdate!=null&&h.shouldComponentUpdate(x,h.__s,b)===!1){t.__v!=n.__v&&(h.props=x,h.state=h.__s,h.__d=!1),t.__e=n.__e,t.__k=n.__k,t.__k.some(function(P){P&&(P.__=t)}),Il.push.apply(h.__h,h._sb),h._sb=[],h.__h.length&&o.push(h),a=hr(n);break e}h.componentWillUpdate!=null&&h.componentWillUpdate(x,h.__s,b),S&&h.componentDidUpdate!=null&&h.__h.push(function(){h.componentDidUpdate(g,_,m)})}if(h.context=b,h.props=x,h.__P=e,h.__e=!1,w=vt.__r,E=0,S)h.state=h.__s,h.__d=!1,w&&w(t),u=h.render(h.props,h.state,h.context),Il.push.apply(h.__h,h._sb),h._sb=[];else do h.__d=!1,w&&w(t),u=h.render(h.props,h.state,h.context),h.state=h.__s;while(h.__d&&++E<25);h.state=h.__s,h.getChildContext!=null&&(i=$n($n({},i),h.getChildContext())),S&&!d&&h.getSnapshotBeforeUpdate!=null&&(m=h.getSnapshotBeforeUpdate(g,_)),y=u!=null&&u.type===Nl&&u.key==null?$0(u.props.children):u,a=X0(e,Dl(y)?y:[y],t,n,i,r,s,o,a,l,c),h.base=t.__e,t.__u&=-161,h.__h.length&&o.push(h),p&&(h.__E=h.__=null)}catch(P){if(o.length=f,t.__v=null,l||s!=null){if(P.then){for(t.__u|=l?160:128;a&&a.nodeType==8&&a.nextSibling;)a=a.nextSibling;s!=null&&(s[s.indexOf(a)]=null),t.__e=a}else if(s!=null)for(A=s.length;A--;)Ld(s[A])}else t.__e=n.__e;t.__k==null&&(t.__k=n.__k||[]),P.then||j0(t),vt.__e(P,t,n)}}else s==null&&t.__v==n.__v?(t.__k=n.__k,t.__e=n.__e):a=t.__e=gC(n.__e,t,n,i,r,s,o,l,c);return(u=vt.diffed)&&u(t),128&t.__u?void 0:a}function j0(e){e&&(e.__c&&(e.__c.__e=!0),e.__k&&e.__k.some(j0))}function Y0(e,t,n){for(var i=0;i<n.length;i++)Nd(n[i],n[++i],n[++i]);vt.__c&&vt.__c(t,e),e.some(function(r){try{e=r.__h,r.__h=[],e.some(function(s){s.call(r)})}catch(s){vt.__e(s,r.__v)}})}function $0(e){return typeof e!="object"||e==null||e.__b>0?e:Dl(e)?e.map($0):e.constructor!==void 0?null:$n({},e)}function gC(e,t,n,i,r,s,o,a,l){var c,u,f,h,d,g,_,m=n.props||Pl,{props:p,type:x}=t;if(x=="svg"?r="http://www.w3.org/2000/svg":x=="math"?r="http://www.w3.org/1998/Math/MathML":r||(r="http://www.w3.org/1999/xhtml"),s!=null){for(c=0;c<s.length;c++)if((d=s[c])&&"setAttribute"in d==!!x&&(x?d.localName==x:d.nodeType==3)){e=d,s[c]=null;break}}if(e==null){if(x==null)return document.createTextNode(p);e=document.createElementNS(r,x,p.is&&p),a&&(vt.__m&&vt.__m(t,s),a=!1),s=null}if(x==null)m===p||a&&e.data==p||(e.data=p);else{if(s=x=="textarea"&&p.defaultValue!=null?null:s&&To.call(e.childNodes),!a&&s!=null)for(m={},c=0;c<e.attributes.length;c++)m[(d=e.attributes[c]).name]=d.value;for(c in m)d=m[c],c=="dangerouslySetInnerHTML"?f=d:c=="children"||(c in p)||c=="value"&&("defaultValue"in p)||c=="checked"&&("defaultChecked"in p)||Al(e,c,null,d,r);for(c in p)d=p[c],c=="children"?h=d:c=="dangerouslySetInnerHTML"?u=d:c=="value"?g=d:c=="checked"?_=d:a&&typeof d!="function"||m[c]===d||Al(e,c,d,m[c],r);if(u)a||f&&(u.__html==f.__html||u.__html==e.innerHTML)||(e.innerHTML=u.__html),t.__k=[];else if(f&&(e.innerHTML=""),X0(t.type=="template"?e.content:e,Dl(h)?h:[h],t,n,i,x=="foreignObject"?"http://www.w3.org/1999/xhtml":r,s,o,s?s[0]:n.__k&&hr(n,0),a,l),s!=null)for(c=s.length;c--;)Ld(s[c]);a&&x!="textarea"||(c="value",x=="progress"&&g==null?e.removeAttribute("value"):g!=null&&(g!==e[c]||x=="progress"&&!g||x=="option"&&g!=m[c])&&Al(e,c,g,m[c],r),c="checked",_!=null&&_!=e[c]&&Al(e,c,_,m[c],r))}return e}function Nd(e,t,n){try{if(typeof e=="function"){var i=typeof e.__u=="function";i&&e.__u(),i&&t==null||(e.__u=e(t))}else e.current=t}catch(r){vt.__e(r,n)}}function Z0(e,t,n){var i,r;if(vt.unmount&&vt.unmount(e),(i=e.ref)&&(i.current&&i.current!=e.__e||Nd(i,null,t)),(i=e.__c)!=null){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(s){vt.__e(s,t)}i.base=i.__P=i.__n=null}if(i=e.__k)for(r=0;r<i.length;r++)i[r]&&Z0(i[r],t,n||typeof e.type!="function");n||Ld(e.__e),e.__c=e.__=e.__e=void 0}function _C(e,t,n){return this.constructor(e,n)}function J0(e,t,n){var i,r,s,o;t==document&&(t=document.documentElement),vt.__&&vt.__(e,t),r=(i=typeof n=="function")?null:n&&n.__k||t.__k,s=[],o=[],Dd(t,e=(!i&&n||t).__k=fC(Nl,null,[e]),r||Pl,Pl,t.namespaceURI,!i&&n?[n]:r?null:t.firstChild?To.call(t.childNodes):null,s,!i&&n?n:r?r.__e:t.firstChild,i,o),Y0(s,e,o),e.props.children=null}function Od(e,t,n){var i,r,s,o,a=$n({},e.props);for(s in e.type&&e.type.defaultProps&&(o=e.type.defaultProps),t)s=="key"?i=t[s]:s=="ref"?r=t[s]:a[s]=t[s]===void 0&&o!=null?o[s]:t[s];return arguments.length>2&&(a.children=arguments.length>3?To.call(arguments,2):n),wo(e.type,a,i||e.key,r||e.ref,null)}To=Il.slice,vt={__e:function(e,t,n,i){for(var r,s,o;t=t.__;)if((r=t.__c)&&!r.__)try{if((s=r.constructor)&&s.getDerivedStateFromError!=null&&(r.setState(s.getDerivedStateFromError(e)),o=r.__d),r.componentDidCatch!=null&&(r.componentDidCatch(e,i||{}),o=r.__d),o)return r.__E=r}catch(a){e=a}throw e}},z0=0,Pd=function(e){return e!=null&&e.constructor===void 0},Rl.prototype.setState=function(e,t){var n;n=this.__s!=null&&this.__s!=this.state?this.__s:this.__s=$n({},this.state),typeof e=="function"&&(e=e($n({},n),this.props)),e&&$n(n,e),e!=null&&this.__v&&(t&&this._sb.push(t),F0(this))},Rl.prototype.forceUpdate=function(e){this.__v&&(this.__e=!0,e&&this.__h.push(e),F0(this))},Rl.prototype.render=Nl,Ni=[],G0=typeof Promise=="function"?Promise.prototype.then.bind(Promise.resolve()):setTimeout,H0=function(e,t){return e.__v.__b-t.__v.__b},Ll.__r=0,Ad=Math.random().toString(8),Cl="__d"+Ad,Mo="__a"+Ad,V0=/(PointerCapture)$|Capture$/i,Id=0,Cd=k0(!1),Rd=k0(!0),hC=0;function K0(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function vC(e){if(Array.isArray(e))return e}function yC(e,t,n){return(t=TC(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function xC(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0);else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(u){c=!0,r=u}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function bC(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function Q0(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);t&&(i=i.filter(function(r){return Object.getOwnPropertyDescriptor(e,r).enumerable})),n.push.apply(n,i)}return n}function SC(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]!=null?arguments[t]:{};t%2?Q0(Object(n),!0).forEach(function(i){yC(e,i,n[i])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):Q0(Object(n)).forEach(function(i){Object.defineProperty(e,i,Object.getOwnPropertyDescriptor(n,i))})}return e}function MC(e,t){return vC(e)||xC(e,t)||EC(e,t)||bC()}function wC(e,t){if(typeof e!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var i=n.call(e,t);if(typeof i!="object")return i;throw TypeError("@@toPrimitive must return a primitive value.")}return(t==="string"?String:Number)(e)}function TC(e){var t=wC(e,"string");return typeof t=="symbol"?t:t+""}function Ol(e){return Ol=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(t){return typeof t}:function(t){return t&&typeof Symbol=="function"&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},Ol(e)}function EC(e,t){if(e){if(typeof e=="string")return K0(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?K0(e,t):void 0}}var Ud=function(t){if(Ol(t)!=="object")return t;var n=Od(t);if(n.props){var i;if(n.props=SC({},n.props),n!==null&&n!==void 0&&(i=n.props)!==null&&i!==void 0&&i.children)n.props.children=Array.isArray(n.props.children)?n.props.children.map(Ud):Ud(n.props.children)}return n},AC=function(t){return Pd(Od(t))},CC=function(t,n){delete n.__k,J0(Ud(t),n)};var ev=Ei({props:{content:{default:!1},offsetX:{triggerUpdate:!1},offsetY:{triggerUpdate:!1}},init:function(t,n){var i=arguments.length>2&&arguments[2]!==void 0?arguments[2]:{},r=i.style,s=r===void 0?{}:r,o=!!t&&Ol(t)==="object"&&!!t.node&&typeof t.node==="function",a=El(o?t.node():t);a.style("position")==="static"&&a.style("position","relative"),n.tooltipEl=a.append("div").attr("class","float-tooltip-kap"),Object.entries(s).forEach(function(c){var u=MC(c,2),f=u[0],h=u[1];return n.tooltipEl.style(f,h)}),n.tooltipEl.style("left","-10000px").style("display","none");var l="tooltip-".concat(Math.round(Math.random()*1000000000000));n.mouseInside=!1,a.on("mousemove.".concat(l),function(c){n.mouseInside=!0;var u=Ml(c),f=a.node(),{offsetWidth:h,offsetHeight:d}=f,g=[n.offsetX===null||n.offsetX===void 0?"-".concat(u[0]/h*100,"%"):typeof n.offsetX==="number"?"calc(-50% + ".concat(n.offsetX,"px)"):n.offsetX,n.offsetY===null||n.offsetY===void 0?d>130&&d-u[1]<100?"calc(-100% - 6px)":"21px":typeof n.offsetY==="number"?n.offsetY<0?"calc(-100% - ".concat(Math.abs(n.offsetY),"px)"):"".concat(n.offsetY,"px"):n.offsetY];n.tooltipEl.style("left",u[0]+"px").style("top",u[1]+"px").style("transform","translate(".concat(g.join(","),")")),n.content&&n.tooltipEl.style("display","inline")}),a.on("mouseover.".concat(l),function(){n.mouseInside=!0,n.content&&n.tooltipEl.style("display","inline")}),a.on("mouseout.".concat(l),function(){n.mouseInside=!1,n.tooltipEl.style("display","none")})},update:function(t){if(t.tooltipEl.style("display",!!t.content&&t.mouseInside?"inline":"none"),!t.content)t.tooltipEl.text("");else if(t.content instanceof HTMLElement)t.tooltipEl.text(""),t.tooltipEl.append(function(){return t.content});else if(typeof t.content==="string")t.tooltipEl.text(t.content);else if(AC(t.content))t.tooltipEl.text(""),CC(t.content,t.tooltipEl.node());else t.tooltipEl.style("display","none"),console.warn("Tooltip content is invalid, skipping.",t.content,t.content.toString())}});var RC=null;var tv=(e)=>{if(e instanceof Array)e.forEach(tv);else{if(e.map)e.map.dispose();e.dispose()}},nv=(e)=>{if(e.geometry)e.geometry.dispose();if(e.material)tv(e.material);if(e.texture)e.texture.dispose();if(e.children)e.children.forEach(nv)},PC=(e)=>{while(e.children.length){let t=e.children[0];e.remove(t),nv(t)}},$e=window.THREE?window.THREE:{WebGLRenderer:Ba,Scene:Us,PerspectiveCamera:zt,Raycaster:ir,SRGBColorSpace:ji,TextureLoader:Pa,Vector2:ne,Vector3:L,Box3:Ln,Color:Le,Mesh:Bt,SphereGeometry:Si,MeshBasicMaterial:si,BackSide:qt,Timer:jr},Fd=Ei({props:{width:{default:window.innerWidth,onChange(e,t,n){isNaN(e)&&(t.width=n)}},height:{default:window.innerHeight,onChange(e,t,n){isNaN(e)&&(t.height=n)}},viewOffset:{default:[0,0]},backgroundColor:{default:"#000011"},backgroundImageUrl:{},onBackgroundImageLoaded:{},showNavInfo:{default:!0},skyRadius:{default:50000},objects:{default:[]},lights:{default:[]},enablePointerInteraction:{default:!0,onChange(e,t){t.hoverObj=null,t.tooltip&&t.tooltip.content(null)},triggerUpdate:!1},pointerRaycasterThrottleMs:{default:50,triggerUpdate:!1},lineHoverPrecision:{default:1,triggerUpdate:!1},pointsHoverPrecision:{default:1,triggerUpdate:!1},hoverOrderComparator:{triggerUpdate:!1},hoverFilter:{default:()=>!0,triggerUpdate:!1},tooltipContent:{triggerUpdate:!1},hoverDuringDrag:{default:!1,triggerUpdate:!1},clickAfterDrag:{default:!1,triggerUpdate:!1},onHover:{default:()=>{},triggerUpdate:!1},onClick:{default:()=>{},triggerUpdate:!1},onRightClick:{triggerUpdate:!1}},methods:{tick:function(e){if(e.initialised){e.controls.enabled&&e.controls.update&&e.controls.update(Math.min(1,e.timer.update().getDelta())),e.postProcessingComposer?e.postProcessingComposer.render():e.renderer.render(e.scene,e.camera),e.extraRenderers.forEach((n)=>n.render(e.scene,e.camera));let t=+new Date;if(e.enablePointerInteraction&&t-e.lastRaycasterCheck>=e.pointerRaycasterThrottleMs){e.lastRaycasterCheck=t;let n=null;if(e.hoverDuringDrag||!e.isPointerDragging){let i=this.intersectingObjects(e.pointerPos.x,e.pointerPos.y);e.hoverOrderComparator&&i.sort((s,o)=>e.hoverOrderComparator(s.object,o.object));let r=i.find((s)=>e.hoverFilter(s.object))||null;n=r?r.object:null,e.intersection=r||null}if(n!==e.hoverObj)e.onHover(n,e.hoverObj,e.intersection),e.tooltip.content(n?ze(e.tooltipContent)(n,e.intersection)||null:null),e.hoverObj=n}e.tweenGroup.update()}return this},getPointerPos:function(e){let{x:t,y:n}=e.pointerPos;return{x:t,y:n}},cameraPosition:function(e,t,n,i){let r=e.camera;if(t&&e.initialised){let l=t,c=n||{x:0,y:0,z:0};if(e.povPosTween?.end(),e.povTgtTween?.end(),!i)s(l),o(c);else{let u=Object.assign({},r.position),f=a();e.tweenGroup.add(e.povPosTween=new Bf(u).to(l,i).easing(Di.Quadratic.Out).onUpdate(s).onComplete(function(){e.povPosTween=void 0,e.tweenGroup.remove(this)}).start()),e.tweenGroup.add(e.povTgtTween=new Bf(f).to(c,i/3).easing(Di.Quadratic.Out).onUpdate(o).onComplete(function(){e.povTgtTween=void 0,e.tweenGroup.remove(this)}).start())}return this}return Object.assign({},r.position,{lookAt:a()});function s(l){let{x:c,y:u,z:f}=l;if(c!==void 0)r.position.x=c;if(u!==void 0)r.position.y=u;if(f!==void 0)r.position.z=f}function o(l){let c=new $e.Vector3(l.x,l.y,l.z);if(e.controls.enabled&&e.controls.target)e.controls.target=c;else r.lookAt(c)}function a(){return Object.assign(new $e.Vector3(0,0,-1000).applyQuaternion(r.quaternion).add(r.position))}},zoomToFit:function(e,t=0,n=10,i,r){return this.fitToBbox(this.getBbox(i),t,n,r)},fitToBbox:function(e,t,n=0,i=10,r=!1){let s=e.camera;if(t){s.updateMatrixWorld();let o=new $e.Vector3,a=new $e.Vector3,l=new $e.Vector3,c=new $e.Vector3;s.getWorldPosition(c),s.getWorldDirection(l),o.crossVectors(l,s.up).normalize(),a.crossVectors(o,l).normalize();let f=(1-i*2/e.height)*s.fov/2*(Math.PI/180),h=Math.atan(Math.tan(f)*s.aspect),d=new $e.Vector3((t.x[0]+t.x[1])/2,(t.y[0]+t.y[1])/2,(t.z[0]+t.z[1])/2),g=r?l.clone().multiplyScalar(c.distanceTo(d)).add(c):d,_=Math.max(0,...[new $e.Vector3(t.x[0],t.y[0],t.z[0]),new $e.Vector3(t.x[0],t.y[0],t.z[1]),new $e.Vector3(t.x[0],t.y[1],t.z[0]),new $e.Vector3(t.x[0],t.y[1],t.z[1]),new $e.Vector3(t.x[1],t.y[0],t.z[0]),new $e.Vector3(t.x[1],t.y[0],t.z[1]),new $e.Vector3(t.x[1],t.y[1],t.z[0]),new $e.Vector3(t.x[1],t.y[1],t.z[1])].map((x)=>{let S=x.clone().sub(g);return Math.max(Math.abs(S.dot(a))/Math.tan(f),Math.abs(S.dot(o))/Math.tan(h))-S.dot(l)})),m=l.clone().negate(),p={x:g.x+m.x*_,y:g.y+m.y*_,z:g.z+m.z*_};this.cameraPosition(p,g,n)}return this},getBbox:function(e,t=()=>!0){let n=new $e.Box3,i=e.objects.filter(t);if(!i.length)return null;return i.forEach((r)=>n.expandByObject(r)),Object.assign(...["x","y","z"].map((r)=>({[r]:[n.min[r],n.max[r]]})))},getScreenCoords:function(e,t,n,i){let r=new $e.Vector3(t,n,i);return r.project(this.camera()),{x:(r.x+1)*e.width/2,y:-(r.y-1)*e.height/2}},getSceneCoords:function(e,t,n,i=0){let r=new $e.Vector2(t/e.width*2-1,-(n/e.height)*2+1),s=new $e.Raycaster;return s.setFromCamera(r,e.camera),Object.assign({},s.ray.at(i,new $e.Vector3))},intersectingObjects:function(e,t,n){let i=new $e.Vector2(t/e.width*2-1,-(n/e.height)*2+1),r=new $e.Raycaster;return r.params.Line.threshold=e.lineHoverPrecision,r.params.Points.threshold=e.pointsHoverPrecision,r.setFromCamera(i,e.camera),r.intersectObjects(e.objects,!0)},renderer:(e)=>e.renderer,scene:(e)=>e.scene,camera:(e)=>e.camera,postProcessingComposer:(e)=>e.postProcessingComposer,controls:(e)=>e.controls,tbControls:(e)=>e.controls,_destructor:function(e){PC(e.scene),e.controls?.dispose(),e.renderer?.dispose(),e.postProcessingComposer?.dispose()}},stateInit:()=>({scene:new $e.Scene,camera:new $e.PerspectiveCamera,timer:new $e.Timer,tweenGroup:new Ff,lastRaycasterCheck:0}),init(e,t,{controlType:n="trackball",useWebGPU:i=!1,rendererConfig:r={},extraRenderers:s=[],waitForLoadComplete:o=!0}={}){if(e.innerHTML="",e.appendChild(t.container=document.createElement("div")),t.container.className="scene-container",t.container.style.position="relative",t.container.appendChild(t.navInfo=document.createElement("div")),t.navInfo.className="scene-nav-info",t.navInfo.textContent={orbit:"Left-click: rotate, Mouse-wheel/middle-click: zoom, Right-click: pan",trackball:"Left-click: rotate, Mouse-wheel/middle-click: zoom, Right-click: pan",fly:"WASD: move, R|F: up | down, Q|E: roll, up|down: pitch, left|right: yaw"}[n]||"",t.navInfo.style.display=t.showNavInfo?null:"none",t.tooltip=new ev(t.container),t.pointerPos=new $e.Vector2,t.pointerPos.x=-2,t.pointerPos.y=-2,["pointermove","pointerdown"].forEach((a)=>t.container.addEventListener(a,(l)=>{if(a==="pointerdown"&&(t.isPointerPressed=!0),!t.isPointerDragging&&l.type==="pointermove"&&(l.pressure>0||t.isPointerPressed)&&(l.pointerType==="mouse"||l.movementX===void 0||[l.movementX,l.movementY].some((u)=>Math.abs(u)>1))&&(t.isPointerDragging=!0),t.enablePointerInteraction){let u=c(t.container);t.pointerPos.x=l.pageX-u.left,t.pointerPos.y=l.pageY-u.top}function c(u){let f=u.getBoundingClientRect(),h=window.pageXOffset||document.documentElement.scrollLeft,d=window.pageYOffset||document.documentElement.scrollTop;return{top:f.top+d,left:f.left+h}}},{passive:!0})),t.container.addEventListener("pointerup",(a)=>{if(!t.isPointerPressed)return;if(t.isPointerPressed=!1,t.isPointerDragging){if(t.isPointerDragging=!1,!t.clickAfterDrag)return}requestAnimationFrame(()=>{if(a.button===0)t.onClick(t.hoverObj||null,a,t.intersection);if(a.button===2&&t.onRightClick)t.onRightClick(t.hoverObj||null,a,t.intersection)})},{passive:!0,capture:!0}),t.container.addEventListener("contextmenu",(a)=>{if(t.onRightClick)a.preventDefault()}),t.renderer=new(i?RC:$e.WebGLRenderer)(Object.assign({antialias:!0,alpha:!0},r)),t.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio)),t.container.appendChild(t.renderer.domElement),t.extraRenderers=s,t.extraRenderers.forEach((a)=>{a.domElement.style.position="absolute",a.domElement.style.top="0px",a.domElement.style.pointerEvents="none",t.container.appendChild(a.domElement)}),t.postProcessingComposer=new _l(t.renderer),t.postProcessingComposer.addPass(new vl(t.scene,t.camera)),t.controls=new{trackball:wf,orbit:ml,fly:Af}[n](t.camera,t.renderer.domElement),n==="fly")t.controls.movementSpeed=300,t.controls.rollSpeed=Math.PI/6,t.controls.dragToLook=!0;if(n==="trackball"||n==="orbit")t.controls.minDistance=0.1,t.controls.maxDistance=t.skyRadius,t.controls.addEventListener("start",()=>{t.controlsEngaged=!0}),t.controls.addEventListener("change",()=>{if(t.controlsEngaged)t.controlsDragging=!0}),t.controls.addEventListener("end",()=>{t.controlsEngaged=!1,t.controlsDragging=!1});[t.renderer,t.postProcessingComposer,...t.extraRenderers].forEach((a)=>a.setSize(t.width,t.height)),t.camera.aspect=t.width/t.height,t.camera.updateProjectionMatrix(),t.camera.position.z=1000,t.scene.add(t.skysphere=new $e.Mesh),t.skysphere.visible=!1,t.loadComplete=t.scene.visible=!o,window.scene=t.scene},update(e,t){if(e.width&&e.height&&(t.hasOwnProperty("width")||t.hasOwnProperty("height"))){let{width:i,height:r}=e;e.container.style.width=`${i}px`,e.container.style.height=`${r}px`,[e.renderer,e.postProcessingComposer,...e.extraRenderers].forEach((o)=>o.setSize(i,r)),e.camera.aspect=i/r;let s=e.viewOffset.slice(0,2);s.some((o)=>o)&&e.camera.setViewOffset(i,r,...s,i,r),e.camera.updateProjectionMatrix()}if(t.hasOwnProperty("viewOffset")){let{width:i,height:r}=e,s=e.viewOffset.slice(0,2);s.some((o)=>o)?e.camera.setViewOffset(i,r,...s,i,r):e.camera.clearViewOffset()}if(t.hasOwnProperty("skyRadius")&&e.skyRadius)e.controls.hasOwnProperty("maxDistance")&&t.skyRadius&&(e.controls.maxDistance=Math.min(e.controls.maxDistance,e.skyRadius)),e.camera.far=e.skyRadius*2.5,e.camera.updateProjectionMatrix(),e.skysphere.geometry=new $e.SphereGeometry(e.skyRadius);if(t.hasOwnProperty("backgroundColor")){let i=Pi(e.backgroundColor).alpha;if(i===void 0)i=1;e.renderer.setClearColor(new $e.Color(R0(1,e.backgroundColor)),i)}if(t.hasOwnProperty("backgroundImageUrl"))if(!e.backgroundImageUrl)e.skysphere.visible=!1,e.skysphere.material.map=null,!e.loadComplete&&n();else new $e.TextureLoader().load(e.backgroundImageUrl,(i)=>{i.colorSpace=$e.SRGBColorSpace,e.skysphere.material=new $e.MeshBasicMaterial({map:i,side:$e.BackSide}),e.skysphere.visible=!0,e.onBackgroundImageLoaded&&setTimeout(e.onBackgroundImageLoaded),!e.loadComplete&&n()});if(t.hasOwnProperty("showNavInfo")&&(e.navInfo.style.display=e.showNavInfo?null:"none"),t.hasOwnProperty("lights"))(t.lights||[]).forEach((i)=>e.scene.remove(i)),e.lights.forEach((i)=>e.scene.add(i));if(t.hasOwnProperty("objects"))(t.objects||[]).forEach((i)=>e.scene.remove(i)),e.objects.forEach((i)=>e.scene.add(i));function n(){e.loadComplete=e.scene.visible=!0}}});function iv(e,t){let n=new t;return n._destructor&&n._destructor(),{linkProp:function(i){return{default:n[i](),onChange(r,s){s[e][i](r)},triggerUpdate:!1}},linkMethod:function(i){return function(r,...s){let o=r[e],a=o[i](...s);return a===o?this:a}}}}var Bd=window.THREE?window.THREE:{AmbientLight:js,DirectionalLight:Da,REVISION:oa},IC=170,rv=iv("forceGraph",vf),LC=Object.assign(...["jsonUrl","graphData","numDimensions","dagMode","dagLevelDistance","dagNodeFilter","onDagError","nodeRelSize","nodeId","nodeVal","nodeResolution","nodeColor","nodeAutoColorBy","nodeOpacity","nodeVisibility","nodeThreeObject","nodeThreeObjectExtend","nodePositionUpdate","linkSource","linkTarget","linkVisibility","linkColor","linkAutoColorBy","linkOpacity","linkWidth","linkResolution","linkCurvature","linkCurveRotation","linkMaterial","linkThreeObject","linkThreeObjectExtend","linkPositionUpdate","linkDirectionalArrowLength","linkDirectionalArrowColor","linkDirectionalArrowRelPos","linkDirectionalArrowResolution","linkDirectionalParticles","linkDirectionalParticleSpeed","linkDirectionalParticleOffset","linkDirectionalParticleWidth","linkDirectionalParticleColor","linkDirectionalParticleResolution","linkDirectionalParticleThreeObject","forceEngine","d3AlphaDecay","d3VelocityDecay","d3AlphaMin","ngraphPhysics","warmupTicks","cooldownTicks","cooldownTime","onEngineTick","onEngineStop"].map((e)=>({[e]:rv.linkProp(e)}))),DC=Object.assign(...["refresh","getGraphBbox","d3Force","d3ReheatSimulation","emitParticle"].map((e)=>({[e]:rv.linkMethod(e)}))),Ul=iv("renderObjs",Fd),NC=Object.assign(...["width","height","backgroundColor","showNavInfo","enablePointerInteraction"].map((e)=>({[e]:Ul.linkProp(e)}))),OC=Object.assign(...["lights","cameraPosition","postProcessingComposer"].map((e)=>({[e]:Ul.linkMethod(e)})),{graph2ScreenCoords:Ul.linkMethod("getScreenCoords"),screen2GraphCoords:Ul.linkMethod("getSceneCoords")}),UC=Ei({props:{nodeLabel:{default:"name",triggerUpdate:!1},linkLabel:{default:"name",triggerUpdate:!1},linkHoverPrecision:{default:1,onChange:(e,t)=>t.renderObjs.lineHoverPrecision(e),triggerUpdate:!1},enableNavigationControls:{default:!0,onChange(e,t){let n=t.renderObjs.controls();if(n)n.enabled=e,e&&n.domElement&&n.domElement.dispatchEvent(new PointerEvent("pointerup"))},triggerUpdate:!1},enableNodeDrag:{default:!0,triggerUpdate:!1},onNodeDrag:{default:()=>{},triggerUpdate:!1},onNodeDragEnd:{default:()=>{},triggerUpdate:!1},onNodeClick:{triggerUpdate:!1},onNodeRightClick:{triggerUpdate:!1},onNodeHover:{triggerUpdate:!1},onLinkClick:{triggerUpdate:!1},onLinkRightClick:{triggerUpdate:!1},onLinkHover:{triggerUpdate:!1},onBackgroundClick:{triggerUpdate:!1},onBackgroundRightClick:{triggerUpdate:!1},showPointerCursor:{default:!0,triggerUpdate:!1},...LC,...NC},methods:{zoomToFit:function(e,t,n,...i){return e.renderObjs.fitToBbox(e.forceGraph.getGraphBbox(...i),t,n),this},pauseAnimation:function(e){if(e.animationFrameRequestId!==null)cancelAnimationFrame(e.animationFrameRequestId),e.animationFrameRequestId=null;return this},resumeAnimation:function(e){if(e.animationFrameRequestId===null)this._animationCycle();return this},_animationCycle(e){if(e.enablePointerInteraction)this.renderer().domElement.style.cursor=null;e.forceGraph.tickFrame(),e.renderObjs.tick(),e.animationFrameRequestId=requestAnimationFrame(this._animationCycle)},scene:(e)=>e.renderObjs.scene(),camera:(e)=>e.renderObjs.camera(),renderer:(e)=>e.renderObjs.renderer(),controls:(e)=>e.renderObjs.controls(),_destructor:function(e){this.pauseAnimation(),this.graphData({nodes:[],links:[]}),e.forceGraph._destructor?.(),e.renderObjs._destructor()},...DC,...OC},stateInit:({controlType:e,rendererConfig:t,extraRenderers:n})=>{let i=new vf;return{forceGraph:i,renderObjs:Fd({controlType:e,rendererConfig:t,extraRenderers:n}).objects([i]).lights([new Bd.AmbientLight(13421772,Math.PI),new Bd.DirectionalLight(16777215,0.6*Math.PI)])}},init:function(e,t){e.innerHTML="",e.appendChild(t.container=document.createElement("div")),t.container.style.position="relative";let n=document.createElement("div");t.container.appendChild(n),t.renderObjs(n);let i=t.renderObjs.camera(),r=t.renderObjs.renderer(),s=t.renderObjs.controls();s.enabled=!!t.enableNavigationControls,t.lastSetCameraZ=i.position.z;let o;t.container.appendChild(o=document.createElement("div")),o.className="graph-info-msg",o.textContent="",t.forceGraph.onLoading(()=>{o.textContent="Loading..."}).onFinishLoading(()=>{o.textContent=""}).onUpdate(()=>{if(t.graphData=t.forceGraph.graphData(),i.position.x===0&&i.position.y===0&&i.position.z===t.lastSetCameraZ&&t.graphData.nodes.length)i.lookAt(t.forceGraph.position),t.lastSetCameraZ=i.position.z=Math.cbrt(t.graphData.nodes.length)*IC}).onFinishUpdate(()=>{if(t._dragControls){let a=t.graphData.nodes.find((l)=>l.__initialFixedPos&&!l.__disposeControlsAfterDrag);if(a)a.__disposeControlsAfterDrag=!0;else t._dragControls.dispose();t._dragControls=void 0}if(t.enableNodeDrag&&t.enablePointerInteraction&&t.forceEngine==="d3"){let a=t._dragControls=new tu(t.graphData.nodes.map((l)=>l.__threeObj).filter((l)=>l),i,r.domElement);a.addEventListener("dragstart",function(l){let c=hi(l.object);if(!c)return;s.enabled=!1,l.object.__initialPos=l.object.position.clone(),l.object.__prevPos=l.object.position.clone();let u=c.__data;!u.__initialFixedPos&&(u.__initialFixedPos={fx:u.fx,fy:u.fy,fz:u.fz}),!u.__initialPos&&(u.__initialPos={x:u.x,y:u.y,z:u.z}),["x","y","z"].forEach((f)=>u[`f${f}`]=u[f]),r.domElement.classList.add("grabbable")}),a.addEventListener("drag",function(l){let c=hi(l.object);if(!c)return;if(!l.object.hasOwnProperty("__graphObjType")){let d=l.object.__initialPos,g=l.object.__prevPos,_=l.object.position;c.position.add(_.clone().sub(g)),g.copy(_),_.copy(d)}let{__data:u,position:f}=c,h={x:f.x-u.x,y:f.y-u.y,z:f.z-u.z};["x","y","z"].forEach((d)=>u[`f${d}`]=u[d]=f[d]),t.forceGraph.d3AlphaTarget(0.3).resetCountdown(),u.__dragged=!0,t.onNodeDrag(u,h)}),a.addEventListener("dragend",function(l){let c=hi(l.object);if(!c)return;delete l.object.__initialPos,delete l.object.__prevPos;let u=c.__data;if(u.__disposeControlsAfterDrag)a.dispose(),delete u.__disposeControlsAfterDrag;let{__initialFixedPos:f,__initialPos:h}=u,d={x:h.x-u.x,y:h.y-u.y,z:h.z-u.z};if(f){if(["x","y","z"].forEach((g)=>{let _=`f${g}`;if(f[_]===void 0)delete u[_]}),delete u.__initialFixedPos,delete u.__initialPos,u.__dragged)delete u.__dragged,t.onNodeDragEnd(u,d)}if(t.forceGraph.d3AlphaTarget(0).resetCountdown(),t.enableNavigationControls)s.enabled=!0,s._status&&s._onPointerCancel?.(),s.domElement&&s.domElement.ownerDocument&&s.domElement.ownerDocument.dispatchEvent(new PointerEvent("pointerup",{pointerType:"touch"}));r.domElement.classList.remove("grabbable")})}}),Bd.REVISION<155&&(t.renderObjs.renderer().useLegacyLights=!1),t.renderObjs.hoverOrderComparator((a,l)=>{let c=hi(a);if(!c)return 1;let u=hi(l);if(!u)return-1;let f=(h)=>h.__graphObjType==="node";return f(u)-f(c)}).tooltipContent((a)=>{let l=hi(a);return l?ze(t[`${l.__graphObjType}Label`])(l.__data)||"":""}).hoverDuringDrag(!1).onHover((a)=>{let l=hi(a);if(l!==t.hoverObj){let c=t.hoverObj?t.hoverObj.__graphObjType:null,u=t.hoverObj?t.hoverObj.__data:null,f=l?l.__graphObjType:null,h=l?l.__data:null;if(c&&c!==f){let d=t[`on${c==="node"?"Node":"Link"}Hover`];d&&d(null,u)}if(f){let d=t[`on${f==="node"?"Node":"Link"}Hover`];d&&d(h,c===f?u:null)}r.domElement.classList[(l&&t[`on${f==="node"?"Node":"Link"}Click`]||!l&&t.onBackgroundClick)&&ze(t.showPointerCursor)(h)?"add":"remove"]("clickable"),t.hoverObj=l}}).clickAfterDrag(!1).onClick((a,l)=>{let c=hi(a);if(c){let u=t[`on${c.__graphObjType==="node"?"Node":"Link"}Click`];u&&u(c.__data,l)}else t.onBackgroundClick&&t.onBackgroundClick(l)}).onRightClick((a,l)=>{let c=hi(a);if(c){let u=t[`on${c.__graphObjType==="node"?"Node":"Link"}RightClick`];u&&u(c.__data,l)}else t.onBackgroundRightClick&&t.onBackgroundRightClick(l)}),this._animationCycle()}});function hi(e){let t=e;while(t&&!t.hasOwnProperty("__graphObjType"))t=t.parent;return t}function kd(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function FC(e){if(Array.isArray(e))return e}function BC(e){if(Array.isArray(e))return kd(e)}function kC(e){if(e===void 0)throw ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function zC(e,t,n){return t=Fl(t),$C(e,ov()?Reflect.construct(t,n||[],Fl(e).constructor):t.apply(e,n))}function GC(e,t){if(!(e instanceof t))throw TypeError("Cannot call a class as a function")}function HC(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,JC(i.key),i)}}function VC(e,t,n){return t&&HC(e.prototype,t),Object.defineProperty(e,"prototype",{writable:!1}),e}function Fl(e){return Fl=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(t){return t.__proto__||Object.getPrototypeOf(t)},Fl(e)}function WC(e,t){if(typeof t!="function"&&t!==null)throw TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&zd(e,t)}function ov(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],function(){}))}catch(t){}return(ov=function(){return!!e})()}function XC(e){if(typeof Symbol<"u"&&e[Symbol.iterator]!=null||e["@@iterator"]!=null)return Array.from(e)}function qC(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0){if(Object(n)!==n)return;l=!1}else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(u){c=!0,r=u}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function jC(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function YC(){throw TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function $C(e,t){if(t&&(typeof t=="object"||typeof t=="function"))return t;if(t!==void 0)throw TypeError("Derived constructors may only return object or undefined");return kC(e)}function zd(e,t){return zd=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(n,i){return n.__proto__=i,n},zd(e,t)}function sv(e,t){return FC(e)||qC(e,t)||av(e,t)||jC()}function Eo(e){return BC(e)||XC(e)||av(e)||YC()}function ZC(e,t){if(typeof e!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var i=n.call(e,t);if(typeof i!="object")return i;throw TypeError("@@toPrimitive must return a primitive value.")}return String(e)}function JC(e){var t=ZC(e,"string");return typeof t=="symbol"?t:t+""}function av(e,t){if(e){if(typeof e=="string")return kd(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?kd(e,t):void 0}}var Ao=typeof window<"u"&&window.THREE?window.THREE:{CanvasTexture:ks,Sprite:Fs,SpriteMaterial:Vr,SRGBColorSpace:ji},KC=function(e){function t(){var n,i=arguments.length>0&&arguments[0]!==void 0?arguments[0]:"",r=arguments.length>1&&arguments[1]!==void 0?arguments[1]:10,s=arguments.length>2&&arguments[2]!==void 0?arguments[2]:"rgba(255, 255, 255, 1)";return GC(this,t),n=zC(this,t,[new Ao.SpriteMaterial]),n._text="".concat(i),n._textHeight=r,n._color=s,n._backgroundColor=!1,n._padding=0,n._borderWidth=0,n._borderRadius=0,n._borderColor="white",n._offsetX=0,n._offsetY=0,n._strokeWidth=0,n._strokeColor="white",n._fontFace="system-ui",n._fontSize=90,n._fontWeight="normal",n._canvas=document.createElement("canvas"),n._genCanvas(),n}return WC(t,e),VC(t,[{key:"text",get:function(){return this._text},set:function(i){this._text=i,this._genCanvas()}},{key:"textHeight",get:function(){return this._textHeight},set:function(i){this._textHeight=i,this._genCanvas()}},{key:"color",get:function(){return this._color},set:function(i){this._color=i,this._genCanvas()}},{key:"backgroundColor",get:function(){return this._backgroundColor},set:function(i){this._backgroundColor=i,this._genCanvas()}},{key:"padding",get:function(){return this._padding},set:function(i){this._padding=i,this._genCanvas()}},{key:"borderWidth",get:function(){return this._borderWidth},set:function(i){this._borderWidth=i,this._genCanvas()}},{key:"borderRadius",get:function(){return this._borderRadius},set:function(i){this._borderRadius=i,this._genCanvas()}},{key:"borderColor",get:function(){return this._borderColor},set:function(i){this._borderColor=i,this._genCanvas()}},{key:"offsetX",get:function(){return this._offsetX},set:function(i){this._offsetX=i,this._genCanvas()}},{key:"offsetY",get:function(){return this._offsetY},set:function(i){this._offsetY=i,this._genCanvas()}},{key:"fontFace",get:function(){return this._fontFace},set:function(i){this._fontFace=i,this._genCanvas()}},{key:"fontSize",get:function(){return this._fontSize},set:function(i){this._fontSize=i,this._genCanvas()}},{key:"fontWeight",get:function(){return this._fontWeight},set:function(i){this._fontWeight=i,this._genCanvas()}},{key:"strokeWidth",get:function(){return this._strokeWidth},set:function(i){this._strokeWidth=i,this._genCanvas()}},{key:"strokeColor",get:function(){return this._strokeColor},set:function(i){this._strokeColor=i,this._genCanvas()}},{key:"_genCanvas",value:function(){var i=this,r=this._canvas,s=r.getContext("2d"),o=1/this.textHeight,a=Array.isArray(this.borderWidth)?this.borderWidth:[this.borderWidth,this.borderWidth],l=a.map(function(P){return P*i.fontSize*o}),c=Array.isArray(this.borderRadius)?this.borderRadius:[this.borderRadius,this.borderRadius,this.borderRadius,this.borderRadius],u=c.map(function(P){return P*i.fontSize*o}),f=Array.isArray(this.padding)?this.padding:[this.padding,this.padding],h=f.map(function(P){return P*i.fontSize*o}),d=[this.offsetX,this.offsetY].map(function(P){return P*i.fontSize*o}),g=this.text.split(`
`),_="".concat(this.fontWeight," ").concat(this.fontSize,"px ").concat(this.fontFace);s.font=_;var m=Math.max.apply(Math,Eo(g.map(function(P){return s.measureText(P).width}))),p=this.fontSize*g.length,x=m+l[0]*2+h[0]*2,S=p+l[1]*2+h[1]*2;if(r.width=x+Math.abs(d[0]),r.height=S+Math.abs(d[1]),s.translate.apply(s,Eo(d.map(function(P){return Math.max(0,P)}))),this.borderWidth){if(s.strokeStyle=this.borderColor,l[0]){var v=l[0]/2;s.lineWidth=l[0],s.beginPath(),s.moveTo(v,u[0]),s.lineTo(v,S-u[3]),s.moveTo(x-v,u[1]),s.lineTo(x-v,S-u[2]),s.stroke()}if(l[1]){var b=l[1]/2;s.lineWidth=l[1],s.beginPath(),s.moveTo(Math.max(l[0],u[0]),b),s.lineTo(x-Math.max(l[0],u[1]),b),s.moveTo(Math.max(l[0],u[3]),S-b),s.lineTo(x-Math.max(l[0],u[2]),S-b),s.stroke()}if(this.borderRadius){var w=Math.max.apply(Math,Eo(l)),E=w/2;s.lineWidth=w,s.beginPath(),[!!u[0]&&[u[0],E,E,u[0]],!!u[1]&&[x-u[1],x-E,E,u[1]],!!u[2]&&[x-u[2],x-E,S-E,S-u[2]],!!u[3]&&[u[3],E,S-E,S-u[3]]].filter(function(P){return P}).forEach(function(P){var D=sv(P,4),W=D[0],R=D[1],I=D[2],k=D[3];s.moveTo(W,I),s.quadraticCurveTo(R,I,R,k)}),s.stroke()}}if(this.backgroundColor)if(s.fillStyle=this.backgroundColor,!this.borderRadius)s.fillRect(l[0],l[1],x-l[0]*2,S-l[1]*2);else s.beginPath(),s.moveTo(l[0],u[0]),[[l[0],u[0],x-u[1],l[1],l[1],l[1]],[x-l[0],x-l[0],x-l[0],l[1],u[1],S-u[2]],[x-l[0],x-u[2],u[3],S-l[1],S-l[1],S-l[1]],[l[0],l[0],l[0],S-l[1],S-u[3],u[0]]].forEach(function(P){var D=sv(P,6),W=D[0],R=D[1],I=D[2],k=D[3],z=D[4],te=D[5];s.quadraticCurveTo(W,k,R,z),s.lineTo(I,te)}),s.closePath(),s.fill();s.translate.apply(s,Eo(l)),s.translate.apply(s,Eo(h)),s.font=_,s.fillStyle=this.color,s.textBaseline="bottom";var y=this.strokeWidth>0;if(y)s.lineWidth=this.strokeWidth*this.fontSize/10,s.strokeStyle=this.strokeColor;if(g.forEach(function(P,D){var W=(m-s.measureText(P).width)/2,R=(D+1)*i.fontSize;y&&s.strokeText(P,W,R),s.fillText(P,W,R)}),this.material.map)this.material.map.dispose();var A=this.material.map=new Ao.CanvasTexture(r);A.colorSpace=Ao.SRGBColorSpace;var N=this.textHeight*g.length+a[1]*2+f[1]*2+Math.abs(this.offsetY);this.scale.set(N*r.width/r.height,N,0)}},{key:"clone",value:function(){return new this.constructor(this.text,this.textHeight,this.color).copy(this)}},{key:"copy",value:function(i){return Ao.Sprite.prototype.copy.call(this,i),this.color=i.color,this.backgroundColor=i.backgroundColor,this.padding=i.padding,this.borderWidth=i.borderWidth,this.borderColor=i.borderColor,this.offsetX=i.offsetX,this.offsetY=i.offsetY,this.fontFace=i.fontFace,this.fontSize=i.fontSize,this.fontWeight=i.fontWeight,this.strokeWidth=i.strokeWidth,this.strokeColor=i.strokeColor,this}}])}(Ao.Sprite);var lv={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Le(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class as extends wn{constructor(e,t=1,n,i){super();this.strength=t,this.radius=n,this.threshold=i,this.resolution=e!==void 0?new ne(e.x,e.y):new ne(256,256),this.clearColor=new Le(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);this.renderTargetBright=new It(r,s,{type:jt,depthBuffer:!1}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let c=0;c<this.nMips;c++){let u=new It(r,s,{type:jt,depthBuffer:!1});u.texture.name="UnrealBloomPass.h"+c,u.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(u);let f=new It(r,s,{type:jt,depthBuffer:!1});f.texture.name="UnrealBloomPass.v"+c,f.texture.generateMipmaps=!1,this.renderTargetsVertical.push(f),r=Math.round(r/2),s=Math.round(s/2)}let o=lv;this.highPassUniforms=oi.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=0.01,this.materialHighPassFilter=new At({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let a=[6,10,14,18,22];r=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);for(let c=0;c<this.nMips;c++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(a[c])),this.separableBlurMaterials[c].uniforms.invSize.value=new ne(1/r,1/s),r=Math.round(r/2),s=Math.round(s/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=0.1;let l=[1,0.8,0.6,0.4,0.2];this.compositeMaterial.uniforms.bloomFactors.value=l,this.bloomTintColors=[new L(1,1,1),new L(1,1,1),new L(1,1,1),new L(1,1,1),new L(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=oi.clone(rs.uniforms),this.blendMaterial=new At({uniforms:this.copyUniforms,vertexShader:rs.vertexShader,fragmentShader:rs.fragmentShader,premultipliedAlpha:!0,blending:Br,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new Le,this._oldClearAlpha=1,this._basic=new si,this._fsQuad=new lr(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),i=Math.round(t/2);this.renderTargetBright.setSize(n,i);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(n,i),this.renderTargetsVertical[r].setSize(n,i),this.separableBlurMaterials[r].uniforms.invSize.value=new ne(1/n,1/i),n=Math.round(n/2),i=Math.round(i/2)}render(e,t,n,i,r){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();let s=e.autoClear;if(e.autoClear=!1,e.setClearColor(this.clearColor,0),r)e.state.buffers.stencil.setTest(!1);if(this.renderToScreen)this._fsQuad.material=this._basic,this._basic.map=n.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e);this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let o=this.renderTargetBright;for(let a=0;a<this.nMips;a++)this._fsQuad.material=this.separableBlurMaterials[a],this.separableBlurMaterials[a].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[a].uniforms.direction.value=as.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[a]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[a].uniforms.colorTexture.value=this.renderTargetsHorizontal[a].texture,this.separableBlurMaterials[a].uniforms.direction.value=as.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[a]),e.clear(),this._fsQuad.render(e),o=this.renderTargetsVertical[a];if(this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r)e.state.buffers.stencil.setTest(!0);if(this.renderToScreen)e.setRenderTarget(null),this._fsQuad.render(e);else e.setRenderTarget(n),this._fsQuad.render(e);e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=s}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let s=0;s<e;s++)t.push(0.39894*Math.exp(-0.5*s*s/(n*n))/n);let i=[],r=[];for(let s=1;s<e;s+=2){let o=t[s],a=s+1<e?t[s+1]:0,l=o+a;i.push((s*o+(s+1)*a)/l),r.push(l)}return new At({defines:{KERNEL_PAIRS:i.length},uniforms:{colorTexture:{value:null},invSize:{value:new ne(0.5,0.5)},direction:{value:new ne(0.5,0.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:i},gaussianWeights:{value:r}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new At({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}}as.BlurDirectionX=new ne(1,0);as.BlurDirectionY=new ne(0,1);var Co={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class cv extends wn{constructor(){super();this.isOutputPass=!0,this.uniforms=oi.clone(Co.uniforms),this.material=new Ws({name:Co.name,uniforms:this.uniforms,vertexShader:Co.vertexShader,fragmentShader:Co.fragmentShader}),this._fsQuad=new lr(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){if(this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping){if(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},We.getTransfer(this._outputColorSpace)===lt)this.material.defines.SRGB_TRANSFER="";if(this._toneMapping===Ms)this.material.defines.LINEAR_TONE_MAPPING="";else if(this._toneMapping===ws)this.material.defines.REINHARD_TONE_MAPPING="";else if(this._toneMapping===Ts)this.material.defines.CINEON_TONE_MAPPING="";else if(this._toneMapping===Es)this.material.defines.ACES_FILMIC_TONE_MAPPING="";else if(this._toneMapping===Cs)this.material.defines.AGX_TONE_MAPPING="";else if(this._toneMapping===Rs)this.material.defines.NEUTRAL_TONE_MAPPING="";else if(this._toneMapping===As)this.material.defines.CUSTOM_TONE_MAPPING="";this.material.needsUpdate=!0}if(this.renderToScreen===!0)e.setRenderTarget(null),this._fsQuad.render(e);else{if(e.setRenderTarget(t),this.clear)e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil);this._fsQuad.render(e)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}export{Br as AdditiveBlending,js as AmbientLight,Zi as BoxGeometry,Qt as BufferAttribute,xt as BufferGeometry,ks as CanvasTexture,Le as Color,Ji as CylinderGeometry,Rn as DoubleSide,_l as EffectComposer,UC as ForceGraph3D,zn as Group,Xr as Line,Wr as LineBasicMaterial,uh as LineLoop,Bt as Mesh,si as MeshBasicMaterial,Mh as MeshStandardMaterial,Fr as NormalBlending,ml as OrbitControls,cv as OutputPass,zt as PerspectiveCamera,Uh as PointLight,fh as Points,Sa as PointsMaterial,ir as Raycaster,vl as RenderPass,Ea as RingGeometry,ji as SRGBColorSpace,Us as Scene,Si as SphereGeometry,Fs as Sprite,Vr as SpriteMaterial,KC as SpriteText,Aa as TorusGeometry,as as UnrealBloomPass,ne as Vector2,L as Vector3,Ba as WebGLRenderer};
