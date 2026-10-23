/* ui/vendor/map-lib.js: 3d-force-graph and three-spritetext with three, built by scripts/vendor-map.ts. Do not edit; see map-lib.inputs.json and THIRD-PARTY-NOTICES.txt. */
var iv=Object.create;var{getPrototypeOf:rv,defineProperty:Gd,getOwnPropertyNames:sv}=Object;var Hd=Object.prototype.hasOwnProperty;function ov(e){return this[e]}var av,lv,cv=(e,t,n)=>{var i=e!=null&&typeof e==="object";if(i){var r=t?av??=new WeakMap:lv??=new WeakMap,s=r.get(e);if(s)return s}n=e!=null?iv(rv(e)):{};let o=t||!e||!e.__esModule||!Hd.call(e,"default")?Gd(n,"default",{value:e,enumerable:!0}):n;if(e&&typeof e==="object"||typeof e==="function"){for(let a of sv(e))if(!Hd.call(o,a))Gd(o,a,{get:ov.bind(e,a),enumerable:!0})}if(i)r.set(e,o);return o};var rn=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var Fu=rn(function(XD,Wg){Wg.exports=function(t){if(t===0)return"x";if(t===1)return"y";if(t===2)return"z";return"c"+(t+1)}});var tr=rn(function(qD,Xg){var Mw=Fu();Xg.exports=function(t){return n;function n(i,r){let s=r&&r.indent||0,o=r&&r.join!==void 0?r.join:`
`,a=Array(s+1).join(" "),l=[];for(let c=0;c<t;++c){let h=Mw(c),f=c===0?"":a;l.push(f+i.replace(/{var}/g,h))}return l.join(o)}}});var Zg=rn(function(jD,eo){var qg=tr();eo.exports=ww;eo.exports.generateCreateBodyFunctionBody=jg;eo.exports.getVectorCode=$g;eo.exports.getBodyCode=Yg;function ww(e,t){let n=jg(e,t),{Body:i}=Function(n)();return i}function jg(e,t){return`
${$g(e,t)}
${Yg(e,t)}
return {Body: Body, Vector: Vector};
`}function Yg(e){let t=qg(e),n=t("{var}",{join:", "});return`
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
};`}function $g(e,t){let n=qg(e),i="";if(t)i=`${n(`
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
  };`}});var i_=rn(function(YD,Mi){var Bu=tr(),Si=Fu();Mi.exports=Tw;Mi.exports.generateQuadTreeFunctionBody=Jg;Mi.exports.getInsertStackCode=n_;Mi.exports.getQuadNodeCode=t_;Mi.exports.isSamePosition=Kg;Mi.exports.getChildBodyCode=e_;Mi.exports.setChildBodyCode=Qg;function Tw(e){let t=Jg(e);return Function(t)()}function Jg(e){let t=Bu(e),n=Math.pow(2,e);return`
${n_()}
${t_(e)}
${Kg(e)}
${e_(e)}
${Qg(e)}

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
        if ((node.max_${Si(0)} - node.min_${Si(0)}) / r < theta) {
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

`;function r(a){let l=[],c=Array(a+1).join(" ");for(let h=0;h<e;++h)l.push(c+`if (${Si(h)} > max_${Si(h)}) {`),l.push(c+`  quadIdx = quadIdx + ${Math.pow(2,h)};`),l.push(c+`  min_${Si(h)} = max_${Si(h)};`),l.push(c+`  max_${Si(h)} = node.max_${Si(h)};`),l.push(c+"}");return l.join(`
`)}function s(){let a=Array(11).join(" "),l=[];for(let c=0;c<n;++c)l.push(a+`if (node.quad${c}) {`),l.push(a+`  queue[pushIdx] = node.quad${c};`),l.push(a+"  queueLength += 1;"),l.push(a+"  pushIdx += 1;"),l.push(a+"}");return l.join(`
`)}function o(a){let l=[];for(let c=0;c<n;++c)l.push(`${a}quad${c} = null;`);return l.join(`
`)}}function Kg(e){let t=Bu(e);return`
  function isSamePosition(point1, point2) {
    ${t("var d{var} = Math.abs(point1.{var} - point2.{var});",{indent:2})}
  
    return ${t("d{var} < 1e-8",{join:" && "})};
  }  
`}function Qg(e){var t=Math.pow(2,e);return`
function setChild(node, idx, child) {
  ${n()}
}`;function n(){let i=[];for(let r=0;r<t;++r){let s=r===0?"  ":"  else ";i.push(`${s}if (idx === ${r}) node.quad${r} = child;`)}return i.join(`
`)}}function e_(e){return`function getChild(node, idx) {
${t()}
  return null;
}`;function t(){let n=[],i=Math.pow(2,e);for(let r=0;r<i;++r)n.push(`  if (idx === ${r}) return node.quad${r};`);return n.join(`
`)}}function t_(e){let t=Bu(e),n=Math.pow(2,e);var i=`
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
`)}}function n_(){return`
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
`}});var s_=rn(function($D,ku){ku.exports=Aw;ku.exports.generateFunctionBody=r_;var Ew=tr();function Aw(e){let t=r_(e);return Function("bodies","settings","random",t)}function r_(e){let t=Ew(e);return`
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
`}});var a_=rn(function(ZD,zu){var Cw=tr();zu.exports=Rw;zu.exports.generateCreateDragForceFunctionBody=o_;function Rw(e){let t=o_(e);return Function("options",t)}function o_(e){return`
  if (!Number.isFinite(options.dragCoefficient)) throw new Error('dragCoefficient is not a finite number');

  return {
    update: function(body) {
      ${Cw(e)("body.force.{var} -= options.dragCoefficient * body.velocity.{var};",{indent:6})}
    }
  };
`}});var c_=rn(function(JD,Gu){var Pw=tr();Gu.exports=Iw;Gu.exports.generateCreateSpringForceFunctionBody=l_;function Iw(e){let t=l_(e);return Function("options","random",t)}function l_(e){let t=Pw(e);return`
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
`}});var u_=rn(function(KD,Hu){var Lw=tr();Hu.exports=Dw;Hu.exports.generateIntegratorFunctionBody=h_;function Dw(e){let t=h_(e);return Function("bodies","timeStep","adaptiveTimeStepWeight",t)}function h_(e){let t=Lw(e);return`
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
`}});var d_=rn(function(QD,f_){f_.exports=Nw;function Nw(e,t,n,i){this.from=e,this.to=t,this.length=n,this.coefficient=i}});var g_=rn(function(eN,m_){m_.exports=p_;function p_(e,t){var n;if(!e)e={};if(t){for(n in t)if(t.hasOwnProperty(n)){var i=e.hasOwnProperty(n),r=typeof t[n],s=!i||typeof e[n]!==r;if(s)e[n]=t[n];else if(r==="object")e[n]=p_(e[n],t[n])}}return e}});var Vu=rn(function(tN,__){function Ow(e){Fw(e);let t=Uw(e);return e.on=t.on,e.off=t.off,e.fire=t.fire,e}function Uw(e){let t=Object.create(null);return{on:function(n,i,r){if(typeof i!="function")throw Error("callback is expected to be a function");let s=t[n];return s||(s=t[n]=[]),s.push({callback:i,ctx:r}),e},off:function(n,i){if(typeof n>"u")return t=Object.create(null),e;if(t[n])if(typeof i!="function")delete t[n];else{let r=t[n];for(let s=0;s<r.length;++s)r[s].callback===i&&r.splice(s,1)}return e},fire:function(n){let i=t[n];if(!i)return e;let r;arguments.length>1&&(r=Array.prototype.slice.call(arguments,1));for(let s=0;s<i.length;++s){let o=i[s];o.callback.apply(o.ctx,r)}return e}}}function Fw(e){if(!e)throw Error("Eventify cannot use falsy object as events subject");let t=["on","fire","off"];for(let n=0;n<t.length;++n)if(e.hasOwnProperty(t[n]))throw Error("Subject cannot be eventified, since it already has property '"+t[n]+"'")}__.exports=Ow});var y_=rn(function(nN,qa){qa.exports=Wu;qa.exports.random=Wu,qa.exports.randomIterator=Gw;function Wu(e){var t=typeof e==="number"?e:+new Date;return new nr(t)}function nr(e){this.seed=e}nr.prototype.next=zw;nr.prototype.nextDouble=Xu;nr.prototype.uniform=Xu;nr.prototype.gaussian=Bw;nr.prototype.random=Xu;function Bw(){var e,t,n;do t=this.nextDouble()*2-1,n=this.nextDouble()*2-1,e=t*t+n*n;while(e>=1||e===0);return t*Math.sqrt(-2*Math.log(e)/e)}nr.prototype.levy=kw;function kw(){var e=1.5,t=Math.pow(v_(1+e)*Math.sin(Math.PI*e/2)/(v_((1+e)/2)*e*Math.pow(2,(e-1)/2)),1/e);return this.gaussian()*t/Math.pow(Math.abs(this.gaussian()),1/e)}function v_(e){return Math.sqrt(2*Math.PI/e)*Math.pow(1/Math.E*(e+1/(12*e-1/(10*e))),e)}function Xu(){var e=this.seed;return e=e+2127912214+(e<<12)&4294967295,e=(e^3345072700^e>>>19)&4294967295,e=e+374761393+(e<<5)&4294967295,e=(e+3550635116^e<<9)&4294967295,e=e+4251993797+(e<<3)&4294967295,e=(e^3042594569^e>>>16)&4294967295,this.seed=e,(e&268435455)/268435456}function zw(e){return Math.floor(this.nextDouble()*e)}function Gw(e,t){var n=t||Wu();if(typeof n.next!=="function")throw Error("customRandom does not match expected API: next() function is missing");return{forEach:r,shuffle:i};function i(){var s,o,a;for(s=e.length-1;s>0;--s)o=n.next(s+1),a=e[o],e[o]=e[s],e[s]=a;return e}function r(s){var o,a,l;for(o=e.length-1;o>0;--o)a=n.next(o+1),l=e[a],e[a]=e[o],e[o]=l,s(l);if(e.length)s(e[0])}}});var qu=rn(function(iN,b_){b_.exports=Yw;var Hw=Zg(),Vw=i_(),Ww=s_(),Xw=a_(),qw=c_(),jw=u_(),x_={};function Yw(e){var t=d_(),n=g_(),i=Vu();if(e){if(e.springCoeff!==void 0)throw Error("springCoeff was renamed to springCoefficient");if(e.dragCoeff!==void 0)throw Error("dragCoeff was renamed to dragCoefficient")}e=n(e,{springLength:10,springCoefficient:0.8,gravity:-12,theta:0.8,dragCoefficient:0.9,timeStep:0.5,adaptiveTimeStepWeight:0,dimensions:2,debug:!1});var r=x_[e.dimensions];if(!r){var s=e.dimensions;r={Body:Hw(s,e.debug),createQuadTree:Vw(s),createBounds:Ww(s),createDragForce:Xw(s),createSpringForce:qw(s),integrate:jw(s)},x_[s]=r}var o=r.Body,a=r.createQuadTree,l=r.createBounds,c=r.createDragForce,h=r.createSpringForce,f=r.integrate,u=(I)=>new o(I),p=y_().random(42),g=[],y=[],m=a(e,p),d=l(g,e,p),b=h(e,p),S=c(e),_=0,x=[],w=new Map,E=0;N("nbody",W),N("spring",R);var v={bodies:g,quadTree:m,springs:y,settings:e,addForce:N,removeForce:P,getForces:D,step:function(){for(var I=0;I<x.length;++I)x[I](E);var k=f(g,e.timeStep,e.adaptiveTimeStepWeight);return E+=1,k},addBody:function(I){if(!I)throw Error("Body is required");return g.push(I),I},addBodyAt:function(I){if(!I)throw Error("Body position is required");var k=u(I);return g.push(k),k},removeBody:function(I){if(!I)return;var k=g.indexOf(I);if(k<0)return;if(g.splice(k,1),g.length===0)d.reset();return!0},addSpring:function(I,k,z,te){if(!I||!k)throw Error("Cannot add null spring to force simulator");if(typeof z!=="number")z=-1;var Y=new t(I,k,z,te>=0?te:-1);return y.push(Y),Y},getTotalMovement:function(){return _},removeSpring:function(I){if(!I)return;var k=y.indexOf(I);if(k>-1)return y.splice(k,1),!0},getBestNewBodyPosition:function(I){return d.getBestNewPosition(I)},getBBox:A,getBoundingBox:A,invalidateBBox:function(){console.warn("invalidateBBox() is deprecated, bounds always recomputed on `getBBox()` call")},gravity:function(I){if(I!==void 0)return e.gravity=I,m.options({gravity:I}),this;else return e.gravity},theta:function(I){if(I!==void 0)return e.theta=I,m.options({theta:I}),this;else return e.theta},random:p};return $w(e,v),i(v),v;function A(){return d.update(),d.box}function N(I,k){if(w.has(I))throw Error("Force "+I+" is already added");w.set(I,k),x.push(k)}function P(I){var k=x.indexOf(w.get(I));if(k<0)return;x.splice(k,1),w.delete(I)}function D(){return w}function W(){if(g.length===0)return;m.insertBodies(g);var I=g.length;while(I--){var k=g[I];if(!k.isPinned)k.reset(),m.updateBodyForce(k),S.update(k)}}function R(){var I=y.length;while(I--)b.update(y[I])}}function $w(e,t){for(var n in e)Zw(e,t,n)}function Zw(e,t,n){if(!e.hasOwnProperty(n))return;if(typeof t[n]==="function")return;var i=Number.isFinite(e[n]);if(i)t[n]=function(r){if(r!==void 0){if(!Number.isFinite(r))throw Error("Value of "+n+" should be a valid number.");return e[n]=r,t}return e[n]};else t[n]=function(r){if(r!==void 0)return e[n]=r,t;return e[n]}}});var S_=rn(function(rN,ju){ju.exports=Kw;ju.exports.simulator=qu();var Jw=Vu();function Kw(e,t){if(!e)throw Error("Graph structure cannot be undefined");var n=t&&t.createSimulator||qu(),i=n(t);if(Array.isArray(t))throw Error("Physics settings is expected to be an object");var r=e.version>19?W:D;if(t&&typeof t.nodeMass==="function")r=t.nodeMass;var s=new Map,o={},a=0,l=i.settings.springTransform||Qw;S(),m();var c=!1,h={step:function(){if(a===0)return f(!0),!0;var R=i.step();h.lastMove=R,h.fire("step");var I=R/a,k=I<=0.01;return f(k),k},getNodePosition:function(R){return P(R).pos},setNodePosition:function(R){var I=P(R);I.setPosition.apply(I,Array.prototype.slice.call(arguments,1))},getLinkPosition:function(R){var I=o[R];if(I)return{from:I.from.pos,to:I.to.pos}},getGraphRect:function(){return i.getBBox()},forEachBody:u,pinNode:function(R,I){var k=P(R.id);k.isPinned=!!I},isNodePinned:function(R){return P(R.id).isPinned},dispose:function(){e.off("changed",b),h.fire("disposed")},getBody:y,getSpring:g,getForceVectorLength:p,simulator:i,graph:e,lastMove:0};return Jw(h),h;function f(R){if(c!==R)c=R,d(R)}function u(R){s.forEach(R)}function p(){var R=0,I=0;return u(function(k){R+=Math.abs(k.force.x),I+=Math.abs(k.force.y)}),Math.sqrt(R*R+I*I)}function g(R,I){var k;if(I===void 0)if(typeof R!=="object")k=R;else k=R.id;else{var z=e.hasLink(R,I);if(!z)return;k=z.id}return o[k]}function y(R){return s.get(R)}function m(){e.on("changed",b)}function d(R){h.fire("stable",R)}function b(R){for(var I=0;I<R.length;++I){var k=R[I];if(k.changeType==="add"){if(k.node)_(k.node.id);if(k.link)w(k.link)}else if(k.changeType==="remove"){if(k.node)x(k.node);if(k.link)E(k.link)}}a=e.getNodesCount()}function S(){a=0,e.forEachNode(function(R){_(R.id),a+=1}),e.forEachLink(w)}function _(R){var I=s.get(R);if(!I){var k=e.getNode(R);if(!k)throw Error("initBody() was called with unknown node id");var z=k.position;if(!z){var te=v(k);z=i.getBestNewBodyPosition(te)}if(I=i.addBodyAt(z),I.id=R,s.set(R,I),A(R),N(k))I.isPinned=!0}}function x(R){var I=R.id,k=s.get(I);if(k)s.delete(I),i.removeBody(k)}function w(R){A(R.fromId),A(R.toId);var I=s.get(R.fromId),k=s.get(R.toId),z=i.addSpring(I,k,R.length);l(R,z),o[R.id]=z}function E(R){var I=o[R.id];if(I){var k=e.getNode(R.fromId),z=e.getNode(R.toId);if(k)A(k.id);if(z)A(z.id);delete o[R.id],i.removeSpring(I)}}function v(R){var I=[];if(!R.links)return I;var k=Math.min(R.links.length,2);for(var z=0;z<k;++z){var te=R.links[z],Y=te.fromId!==R.id?s.get(te.fromId):s.get(te.toId);if(Y&&Y.pos)I.push(Y)}return I}function A(R){var I=s.get(R);if(I.mass=r(R),Number.isNaN(I.mass))throw Error("Node mass should be a number")}function N(R){return R&&(R.isPinned||R.data&&R.data.isPinned)}function P(R){var I=s.get(R);if(!I)_(R),I=s.get(R);return I}function D(R){var I=e.getLinks(R);if(!I)return 1;return 1+I.length/3}function W(R){var I=e.getLinks(R);if(!I)return 1;return 1+I.size/3}}function Qw(){}});var Ko="186",St={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},xn={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},bp=0,sc=1,Sp=2;var _s=1,Mp=2,Pr=3,Ir=0,Xt=1,Bn=2,bn=0,vs=1,ys=2,oc=3,ac=4,wp=5;var Lr=100,Tp=101,Ep=102,Ap=103,Cp=104,Rp=200,Pp=201,Ip=202,Lp=203,Dp=204,Np=205,Op=206,Up=207,Fp=208,Bp=209,kp=210,zp=211,Gp=212,Hp=213,Vp=214,Wp=0,Xp=1,qp=2,lc=3,jp=4,Yp=5,$p=6,Zp=7,Jp=0,Kp=1,Qp=2,Rn=0,xs=1,bs=2,Ss=3,Ms=4,ws=5,Ts=6,Es=7;var Dr=301,ki=302,Qo=303,ea=304,As=306,em=1000,ta=1001,tm=1002,vi=1003,nm=1004;var Cs=1005;var an=1006,na=1007;var zi=1008;var Pn=1009,im=1010,rm=1011,Rs=1012,cc=1013,yi=1014,ii=1015,qt=1016,hc=1017,uc=1018,Nr=1020,sm=35902,om=35899,am=1021,lm=1022,kn=1023,Gi=1026,Hi=1027,cm=1028,fc=1029,Vi=1030,dc=1031;var pc=1033,ia=33776,ra=33777,sa=33778,oa=33779,mc=35840,gc=35841,_c=35842,vc=35843,yc=36196,xc=37492,bc=37496,Sc=37488,Mc=37489,aa=37490,wc=37491,Tc=37808,Ec=37809,Ac=37810,Cc=37811,Rc=37812,Pc=37813,Ic=37814,Lc=37815,Dc=37816,Nc=37817,Oc=37818,Uc=37819,Fc=37820,Bc=37821,kc=36492,zc=36494,Gc=36495,Hc=36283,Vc=36284,la=36285,Wc=36286;var Xc=0,hm=1,Wi="",Or="srgb",qc="srgb-linear",jc="linear",at="srgb";var um=512,fm=513,dm=514,ca=515,pm=516,mm=517,ha=518,gm=519;var Yc="300 es",$c=2000;function hv(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function uv(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function Ar(e){return document.createElementNS("http://www.w3.org/1999/xhtml",e)}function _m(){let e=Ar("canvas");return e.style.display="block",e}var Vd={},Cr=null;function ms(...e){let t="THREE."+e.shift();if(Cr)Cr("log",t,...e);else console.log(t,...e)}function vm(e){let t=e[0];if(typeof t==="string"&&t.startsWith("TSL:")){let n=e[1];if(n&&n.isStackTrace)e[0]+=" "+n.getLocation();else e[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return e}function Ie(...e){e=vm(e);let t="THREE."+e.shift();if(Cr)Cr("warn",t,...e);else{let n=e[0];if(n&&n.isStackTrace)console.warn(n.getError(t));else console.warn(t,...e)}}function De(...e){e=vm(e);let t="THREE."+e.shift();if(Cr)Cr("error",t,...e);else{let n=e[0];if(n&&n.isStackTrace)console.error(n.getError(t));else console.error(t,...e)}}function Bi(...e){let t=e.join(" ");if(t in Vd)return;Vd[t]=!0,Ie(...e)}function ym(e,t,n){return new Promise(function(i,r){function s(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:r();break;case e.TIMEOUT_EXPIRED:setTimeout(s,n);break;default:i()}}setTimeout(s,n)})}var xm={[0]:1,[2]:6,[4]:7,[3]:5,[1]:0,[6]:2,[7]:4,[5]:3};class zn{addEventListener(e,t){if(this._listeners===void 0)this._listeners={};let n=this._listeners;if(n[e]===void 0)n[e]=[];if(n[e].indexOf(t)===-1)n[e].push(t)}hasEventListener(e,t){let n=this._listeners;if(n===void 0)return!1;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let i=n[e];if(i!==void 0){let r=i.indexOf(t);if(r!==-1)i.splice(r,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let r=0,s=i.length;r<s;r++)i[r].call(this,e);e.target=null}}}var Vt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Wd=1234567,us=Math.PI/180,Rr=180/Math.PI;function ei(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Vt[e&255]+Vt[e>>8&255]+Vt[e>>16&255]+Vt[e>>24&255]+"-"+Vt[t&255]+Vt[t>>8&255]+"-"+Vt[t>>16&15|64]+Vt[t>>24&255]+"-"+Vt[n&63|128]+Vt[n>>8&255]+"-"+Vt[n>>16&255]+Vt[n>>24&255]+Vt[i&255]+Vt[i>>8&255]+Vt[i>>16&255]+Vt[i>>24&255]).toLowerCase()}function He(e,t,n){return Math.max(t,Math.min(n,e))}function Zc(e,t){return(e%t+t)%t}function fv(e,t,n,i,r){return i+(e-t)*(r-i)/(n-t)}function dv(e,t,n){if(e!==t)return(n-e)/(t-e);else return 0}function fs(e,t,n){return(1-n)*e+n*t}function pv(e,t,n,i){return fs(e,t,1-Math.exp(-n*i))}function mv(e,t=1){return t-Math.abs(Zc(e,t*2)-t)}function gv(e,t,n){if(e<=t)return 0;if(e>=n)return 1;return e=(e-t)/(n-t),e*e*(3-2*e)}function _v(e,t,n){if(e<=t)return 0;if(e>=n)return 1;return e=(e-t)/(n-t),e*e*e*(e*(e*6-15)+10)}function vv(e,t){return e+Math.floor(Math.random()*(t-e+1))}function yv(e,t){return e+Math.random()*(t-e)}function xv(e){return e*(0.5-Math.random())}function bv(e){if(e!==void 0)Wd=e;let t=Wd+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Sv(e){return e*us}function Mv(e){return e*Rr}function wv(e){return e>0&&Number.isInteger(e)&&2**Math.round(Math.log2(e))===e}function Tv(e){return Math.pow(2,Math.ceil(Math.log(e)/Math.LN2))}function Ev(e){return Math.pow(2,Math.floor(Math.log(e)/Math.LN2))}function Av(e,t,n,i,r){let{cos:s,sin:o}=Math,a=s(n/2),l=o(n/2),c=s((t+i)/2),h=o((t+i)/2),f=s((t-i)/2),u=o((t-i)/2),p=s((i-t)/2),g=o((i-t)/2);switch(r){case"XYX":e.set(a*h,l*f,l*u,a*c);break;case"YZY":e.set(l*u,a*h,l*f,a*c);break;case"ZXZ":e.set(l*f,l*u,a*h,a*c);break;case"XZX":e.set(a*h,l*g,l*p,a*c);break;case"YXY":e.set(l*p,a*h,l*g,a*c);break;case"ZYZ":e.set(l*g,l*p,a*h,a*c);break;default:Ie("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function Cn(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:case Uint8ClampedArray:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw Error("THREE.MathUtils: Invalid component type.")}}function st(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw Error("THREE.MathUtils: Invalid component type.")}}var Ur={DEG2RAD:us,RAD2DEG:Rr,generateUUID:ei,clamp:He,euclideanModulo:Zc,mapLinear:fv,inverseLerp:dv,lerp:fs,damp:pv,pingpong:mv,smoothstep:gv,smootherstep:_v,randInt:vv,randFloat:yv,randFloatSpread:xv,seededRandom:bv,degToRad:Sv,radToDeg:Mv,isPowerOfTwo:wv,ceilPowerOfTwo:Tv,floorPowerOfTwo:Ev,setQuaternionFromProperEuler:Av,normalize:st,denormalize:Cn};class re{static{re.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),r=this.x-e.x,s=this.y-e.y;return this.x=r*n-s*i+e.x,this.y=r*i+s*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class kt{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,r,s,o){let a=n[i+0],l=n[i+1],c=n[i+2],h=n[i+3],f=r[s+0],u=r[s+1],p=r[s+2],g=r[s+3];if(h!==g||a!==f||l!==u||c!==p){let y=a*f+l*u+c*p+h*g;if(y<0)f=-f,u=-u,p=-p,g=-g,y=-y;let m=1-o;if(y<0.9995){let d=Math.acos(y),b=Math.sin(d);m=Math.sin(m*d)/b,o=Math.sin(o*d)/b,a=a*m+f*o,l=l*m+u*o,c=c*m+p*o,h=h*m+g*o}else{a=a*m+f*o,l=l*m+u*o,c=c*m+p*o,h=h*m+g*o;let d=1/Math.sqrt(a*a+l*l+c*c+h*h);a*=d,l*=d,c*=d,h*=d}}e[t]=a,e[t+1]=l,e[t+2]=c,e[t+3]=h}static multiplyQuaternionsFlat(e,t,n,i,r,s){let o=n[i],a=n[i+1],l=n[i+2],c=n[i+3],h=r[s],f=r[s+1],u=r[s+2],p=r[s+3];return e[t]=o*p+c*h+a*u-l*f,e[t+1]=a*p+c*f+l*h-o*u,e[t+2]=l*p+c*u+o*f-a*h,e[t+3]=c*p-o*h-a*f-l*u,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let{_x:n,_y:i,_z:r,_order:s}=e,{cos:o,sin:a}=Math,l=o(n/2),c=o(i/2),h=o(r/2),f=a(n/2),u=a(i/2),p=a(r/2);switch(s){case"XYZ":this._x=f*c*h+l*u*p,this._y=l*u*h-f*c*p,this._z=l*c*p+f*u*h,this._w=l*c*h-f*u*p;break;case"YXZ":this._x=f*c*h+l*u*p,this._y=l*u*h-f*c*p,this._z=l*c*p-f*u*h,this._w=l*c*h+f*u*p;break;case"ZXY":this._x=f*c*h-l*u*p,this._y=l*u*h+f*c*p,this._z=l*c*p+f*u*h,this._w=l*c*h-f*u*p;break;case"ZYX":this._x=f*c*h-l*u*p,this._y=l*u*h+f*c*p,this._z=l*c*p-f*u*h,this._w=l*c*h+f*u*p;break;case"YZX":this._x=f*c*h+l*u*p,this._y=l*u*h+f*c*p,this._z=l*c*p-f*u*h,this._w=l*c*h-f*u*p;break;case"XZY":this._x=f*c*h-l*u*p,this._y=l*u*h-f*c*p,this._z=l*c*p+f*u*h,this._w=l*c*h+f*u*p;break;default:Ie("Quaternion: .setFromEuler() encountered an unknown order: "+s)}if(t===!0)this._onChangeCallback();return this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],r=t[8],s=t[1],o=t[5],a=t[9],l=t[2],c=t[6],h=t[10],f=n+o+h;if(f>0){let u=0.5/Math.sqrt(f+1);this._w=0.25/u,this._x=(c-a)*u,this._y=(r-l)*u,this._z=(s-i)*u}else if(n>o&&n>h){let u=2*Math.sqrt(1+n-o-h);this._w=(c-a)/u,this._x=0.25*u,this._y=(i+s)/u,this._z=(r+l)/u}else if(o>h){let u=2*Math.sqrt(1+o-n-h);this._w=(r-l)/u,this._x=(i+s)/u,this._y=0.25*u,this._z=(a+c)/u}else{let u=2*Math.sqrt(1+h-n-o);this._w=(s-i)/u,this._x=(r+l)/u,this._y=(a+c)/u,this._z=0.25*u}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;if(n<0.00000001)if(n=0,Math.abs(e.x)>Math.abs(e.z))this._x=-e.y,this._y=e.x,this._z=0,this._w=n;else this._x=0,this._y=-e.z,this._z=e.y,this._w=n;else this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n;return this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(He(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();if(e===0)this._x=0,this._y=0,this._z=0,this._w=1;else e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e;return this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let{_x:n,_y:i,_z:r,_w:s}=e,{_x:o,_y:a,_z:l,_w:c}=t;return this._x=n*c+s*o+i*l-r*a,this._y=i*c+s*a+r*o-n*l,this._z=r*c+s*l+n*a-i*o,this._w=s*c-n*o-i*a-r*l,this._onChangeCallback(),this}slerp(e,t){let{_x:n,_y:i,_z:r,_w:s}=e,o=this.dot(e);if(o<0)n=-n,i=-i,r=-r,s=-s,o=-o;let a=1-t;if(o<0.9995){let l=Math.acos(o),c=Math.sin(l);a=Math.sin(a*l)/c,t=Math.sin(t*l)/c,this._x=this._x*a+n*t,this._y=this._y*a+i*t,this._z=this._z*a+r*t,this._w=this._w*a+s*t,this._onChangeCallback()}else this._x=this._x*a+n*t,this._y=this._y*a+i*t,this._z=this._z*a+r*t,this._w=this._w*a+s*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class L{static{L.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){if(n===void 0)n=this.z;return this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Xd.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Xd.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*i,this.y=r[1]*t+r[4]*n+r[7]*i,this.z=r[2]*t+r[5]*n+r[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=e.elements,s=1/(r[3]*t+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*i+r[12])*s,this.y=(r[1]*t+r[5]*n+r[9]*i+r[13])*s,this.z=(r[2]*t+r[6]*n+r[10]*i+r[14])*s,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,{x:r,y:s,z:o,w:a}=e,l=2*(s*i-o*n),c=2*(o*t-r*i),h=2*(r*n-s*t);return this.x=t+a*l+s*h-o*c,this.y=n+a*c+o*l-r*h,this.z=i+a*h+r*c-s*l,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*i,this.y=r[1]*t+r[5]*n+r[9]*i,this.z=r[2]*t+r[6]*n+r[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let{x:n,y:i,z:r}=e,{x:s,y:o,z:a}=t;return this.x=i*a-r*o,this.y=r*s-n*a,this.z=n*o-i*s,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Ll.copy(this).projectOnVector(e),this.sub(Ll)}reflect(e){return this.sub(Ll.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}var Ll=new L,Xd=new kt;class Be{static{Be.prototype.isMatrix3=!0}constructor(e,t,n,i,r,s,o,a,l){if(this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0)this.set(e,t,n,i,r,s,o,a,l)}set(e,t,n,i,r,s,o,a,l){let c=this.elements;return c[0]=e,c[1]=i,c[2]=o,c[3]=t,c[4]=r,c[5]=a,c[6]=n,c[7]=s,c[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,s=n[0],o=n[3],a=n[6],l=n[1],c=n[4],h=n[7],f=n[2],u=n[5],p=n[8],g=i[0],y=i[3],m=i[6],d=i[1],b=i[4],S=i[7],_=i[2],x=i[5],w=i[8];return r[0]=s*g+o*d+a*_,r[3]=s*y+o*b+a*x,r[6]=s*m+o*S+a*w,r[1]=l*g+c*d+h*_,r[4]=l*y+c*b+h*x,r[7]=l*m+c*S+h*w,r[2]=f*g+u*d+p*_,r[5]=f*y+u*b+p*x,r[8]=f*m+u*S+p*w,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],s=e[4],o=e[5],a=e[6],l=e[7],c=e[8];return t*s*c-t*o*l-n*r*c+n*o*a+i*r*l-i*s*a}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],s=e[4],o=e[5],a=e[6],l=e[7],c=e[8],h=c*s-o*l,f=o*a-c*r,u=l*r-s*a,p=t*h+n*f+i*u;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let g=1/p;return e[0]=h*g,e[1]=(i*l-c*n)*g,e[2]=(o*n-i*s)*g,e[3]=f*g,e[4]=(c*t-i*a)*g,e[5]=(i*r-o*t)*g,e[6]=u*g,e[7]=(n*a-l*t)*g,e[8]=(s*t-n*r)*g,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,r,s,o){let a=Math.cos(r),l=Math.sin(r);return this.set(n*a,n*l,-n*(a*s+l*o)+s+e,-i*l,i*a,-i*(-l*s+a*o)+o+t,0,0,1),this}scale(e,t){return Bi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Dl.makeScale(e,t)),this}rotate(e){return Bi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Dl.makeRotation(-e)),this}translate(e,t){return Bi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Dl.makeTranslation(e,t)),this}makeTranslation(e,t){if(e.isVector2)this.set(1,0,e.x,0,1,e.y,0,0,1);else this.set(1,0,e,0,1,t,0,0,1);return this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}var Dl=new Be,qd=new Be().set(0.4123908,0.3575843,0.1804808,0.212639,0.7151687,0.0721923,0.0193308,0.1191948,0.9505322),jd=new Be().set(3.2409699,-1.5373832,-0.4986108,-0.9692436,1.8759675,0.0415551,0.0556301,-0.203977,1.0569715);function Cv(){let e={enabled:!0,workingColorSpace:"srgb-linear",spaces:{},convert:function(r,s,o){if(this.enabled===!1||s===o||!s||!o)return r;if(this.spaces[s].transfer==="srgb")r.r=ti(r.r),r.g=ti(r.g),r.b=ti(r.b);if(this.spaces[s].primaries!==this.spaces[o].primaries)r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[o].fromXYZ);if(this.spaces[o].transfer==="srgb")r.r=Er(r.r),r.g=Er(r.g),r.b=Er(r.b);return r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){if(r==="")return"linear";return this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,o){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Bi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),e.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Bi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),e.colorSpaceToWorking(r,s)}},t=[0.64,0.33,0.3,0.6,0.15,0.06],n=[0.2126,0.7152,0.0722],i=[0.3127,0.329];return e.define({["srgb-linear"]:{primaries:t,whitePoint:i,transfer:"linear",toXYZ:qd,fromXYZ:jd,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:"srgb"},outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}},["srgb"]:{primaries:t,whitePoint:i,transfer:"srgb",toXYZ:qd,fromXYZ:jd,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}}}),e}var We=Cv();function ti(e){return e<0.04045?e*0.0773993808:Math.pow(e*0.9478672986+0.0521327014,2.4)}function Er(e){return e<0.0031308?e*12.92:1.055*Math.pow(e,0.41666)-0.055}var lr;class Jc{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src))return e.src;if(typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{if(lr===void 0)lr=Ar("canvas");lr.width=e.width,lr.height=e.height;let i=lr.getContext("2d");if(e instanceof ImageData)i.putImageData(e,0,0);else i.drawImage(e,0,0,e.width,e.height);n=lr}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Ar("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let i=n.getImageData(0,0,e.width,e.height),r=i.data;for(let s=0;s<r.length;s++)r[s]=ti(r[s]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)if(t instanceof Uint8Array||t instanceof Uint8ClampedArray)t[n]=Math.floor(ti(t[n]/255)*255);else t[n]=ti(t[n]);return{data:t,width:e.width,height:e.height}}else return Ie("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}var Rv=0;class Ps{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Rv++}),this.uuid=ei(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;if(typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement)e.set(t.videoWidth,t.videoHeight,0);else if(typeof VideoFrame<"u"&&t instanceof VideoFrame)e.set(t.displayWidth,t.displayHeight,0);else if(t!==null)e.set(t.width,t.height,t.depth||0);else e.set(0,0,0);return e}set needsUpdate(e){if(e===!0)this.version++}toJSON(e){let t=e===void 0||typeof e==="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let s=0,o=i.length;s<o;s++)if(i[s].isDataTexture)r.push(Nl(i[s].image));else r.push(Nl(i[s]))}else r=Nl(i);n.url=r}if(!t)e.images[this.uuid]=n;return n}}function Nl(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap)return Jc.getDataURL(e);else if(e.data)return{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name};else return Ie("Texture: Unable to serialize Texture."),{}}var Pv=0,Ol=new L;class Ft extends zn{constructor(e=Ft.DEFAULT_IMAGE,t=Ft.DEFAULT_MAPPING,n=1001,i=1001,r=1006,s=1008,o=1023,a=1009,l=Ft.DEFAULT_ANISOTROPY,c=""){super();this.isTexture=!0,Object.defineProperty(this,"id",{value:Pv++}),this.uuid=ei(),this.name="",this.source=new Ps(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=s,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=a,this.offset=new re(0,0),this.repeat=new re(1,1),this.center=new re(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Be,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=c,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=e&&e.depth&&e.depth>1?!0:!1,this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Ol).x}get height(){return this.source.getSize(Ol).y}get depth(){return this.source.getSize(Ol).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){Ie(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){Ie(`Texture.setValues(): property '${t}' does not exist.`);continue}if(i&&n&&(i.isVector2&&n.isVector2))i.copy(n);else if(i&&n&&(i.isVector3&&n.isVector3))i.copy(n);else if(i&&n&&(i.isMatrix3&&n.isMatrix3))i.copy(n);else this[t]=n}}toJSON(e){let t=e===void 0||typeof e==="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};if(Object.keys(this.userData).length>0)n.userData=this.userData;if(!t)e.textures[this.uuid]=n;return n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==300)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case 1000:e.x=e.x-Math.floor(e.x);break;case 1001:e.x=e.x<0?0:1;break;case 1002:if(Math.abs(Math.floor(e.x)%2)===1)e.x=Math.ceil(e.x)-e.x;else e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case 1000:e.y=e.y-Math.floor(e.y);break;case 1001:e.y=e.y<0?0:1;break;case 1002:if(Math.abs(Math.floor(e.y)%2)===1)e.y=Math.ceil(e.y)-e.y;else e.y=e.y-Math.floor(e.y);break}if(this.flipY)e.y=1-e.y;return e}set needsUpdate(e){if(e===!0)this.version++,this.source.needsUpdate=!0}set needsPMREMUpdate(e){if(e===!0)this.pmremVersion++}}Ft.DEFAULT_IMAGE=null;Ft.DEFAULT_MAPPING=300;Ft.DEFAULT_ANISOTROPY=1;class gt{static{gt.prototype.isVector4=!0}constructor(e=0,t=0,n=0,i=1){this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=this.w,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*i+s[12]*r,this.y=s[1]*t+s[5]*n+s[9]*i+s[13]*r,this.z=s[2]*t+s[6]*n+s[10]*i+s[14]*r,this.w=s[3]*t+s[7]*n+s[11]*i+s[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);if(t<0.0001)this.x=1,this.y=0,this.z=0;else this.x=e.x/t,this.y=e.y/t,this.z=e.z/t;return this}setAxisAngleFromRotationMatrix(e){let t,n,i,r,s=0.01,o=0.1,a=e.elements,l=a[0],c=a[4],h=a[8],f=a[1],u=a[5],p=a[9],g=a[2],y=a[6],m=a[10];if(Math.abs(c-f)<0.01&&Math.abs(h-g)<0.01&&Math.abs(p-y)<0.01){if(Math.abs(c+f)<0.1&&Math.abs(h+g)<0.1&&Math.abs(p+y)<0.1&&Math.abs(l+u+m-3)<0.1)return this.set(1,0,0,0),this;t=Math.PI;let b=(l+1)/2,S=(u+1)/2,_=(m+1)/2,x=(c+f)/4,w=(h+g)/4,E=(p+y)/4;if(b>S&&b>_)if(b<0.01)n=0,i=0.707106781,r=0.707106781;else n=Math.sqrt(b),i=x/n,r=w/n;else if(S>_)if(S<0.01)n=0.707106781,i=0,r=0.707106781;else i=Math.sqrt(S),n=x/i,r=E/i;else if(_<0.01)n=0.707106781,i=0.707106781,r=0;else r=Math.sqrt(_),n=w/r,i=E/r;return this.set(n,i,r,t),this}let d=Math.sqrt((y-p)*(y-p)+(h-g)*(h-g)+(f-c)*(f-c));if(Math.abs(d)<0.001)d=1;return this.x=(y-p)/d,this.y=(h-g)/d,this.z=(f-c)/d,this.w=Math.acos((l+u+m-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this.w=He(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this.w=He(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Kc extends zn{constructor(e=1,t=1,n={}){super();n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:1006,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new gt(0,0,e,t),this.scissorTest=!1,this.viewport=new gt(0,0,e,t),this.textures=[];let i={width:e,height:t,depth:n.depth},r=new Ft(i),s=n.count;for(let o=0;o<s;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:1006,generateMipmaps:!1,flipY:!1,internalFormat:null};if(e.mapping!==void 0)t.mapping=e.mapping;if(e.wrapS!==void 0)t.wrapS=e.wrapS;if(e.wrapT!==void 0)t.wrapT=e.wrapT;if(e.wrapR!==void 0)t.wrapR=e.wrapR;if(e.magFilter!==void 0)t.magFilter=e.magFilter;if(e.minFilter!==void 0)t.minFilter=e.minFilter;if(e.format!==void 0)t.format=e.format;if(e.type!==void 0)t.type=e.type;if(e.anisotropy!==void 0)t.anisotropy=e.anisotropy;if(e.colorSpace!==void 0)t.colorSpace=e.colorSpace;if(e.flipY!==void 0)t.flipY=e.flipY;if(e.generateMipmaps!==void 0)t.generateMipmaps=e.generateMipmaps;if(e.internalFormat!==void 0)t.internalFormat=e.internalFormat;for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){if(this._depthTexture!==null&&this._depthTexture.renderTarget===this)this._depthTexture.renderTarget=null;if(e!==null&&e.renderTarget===null)e.renderTarget=this;this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,r=this.textures.length;i<r;i++)if(this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n,this.textures[i].isData3DTexture!==!0)this.textures[i].isArrayTexture=this.textures[i].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let i=Object.assign({},e.textures[t].image);this.textures[t].source=new Ps(i)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Pt extends Kc{constructor(e=1,t=1,n={}){super(e,t,n);this.isWebGLRenderTarget=!0}}class ua extends Ft{constructor(e=null,t=1,n=1,i=1){super(null);this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Qc extends Ft{constructor(e=null,t=1,n=1,i=1){super(null);this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}}class Ke{static{Ke.prototype.isMatrix4=!0}constructor(e,t,n,i,r,s,o,a,l,c,h,f,u,p,g,y){if(this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0)this.set(e,t,n,i,r,s,o,a,l,c,h,f,u,p,g,y)}set(e,t,n,i,r,s,o,a,l,c,h,f,u,p,g,y){let m=this.elements;return m[0]=e,m[4]=t,m[8]=n,m[12]=i,m[1]=r,m[5]=s,m[9]=o,m[13]=a,m[2]=l,m[6]=c,m[10]=h,m[14]=f,m[3]=u,m[7]=p,m[11]=g,m[15]=y,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Ke().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){if(this.determinantAffine()===0)return e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this;return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,i=1/cr.setFromMatrixColumn(e,0).length(),r=1/cr.setFromMatrixColumn(e,1).length(),s=1/cr.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*s,t[9]=n[9]*s,t[10]=n[10]*s,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,{x:n,y:i,z:r}=e,s=Math.cos(n),o=Math.sin(n),a=Math.cos(i),l=Math.sin(i),c=Math.cos(r),h=Math.sin(r);if(e.order==="XYZ"){let f=s*c,u=s*h,p=o*c,g=o*h;t[0]=a*c,t[4]=-a*h,t[8]=l,t[1]=u+p*l,t[5]=f-g*l,t[9]=-o*a,t[2]=g-f*l,t[6]=p+u*l,t[10]=s*a}else if(e.order==="YXZ"){let f=a*c,u=a*h,p=l*c,g=l*h;t[0]=f+g*o,t[4]=p*o-u,t[8]=s*l,t[1]=s*h,t[5]=s*c,t[9]=-o,t[2]=u*o-p,t[6]=g+f*o,t[10]=s*a}else if(e.order==="ZXY"){let f=a*c,u=a*h,p=l*c,g=l*h;t[0]=f-g*o,t[4]=-s*h,t[8]=p+u*o,t[1]=u+p*o,t[5]=s*c,t[9]=g-f*o,t[2]=-s*l,t[6]=o,t[10]=s*a}else if(e.order==="ZYX"){let f=s*c,u=s*h,p=o*c,g=o*h;t[0]=a*c,t[4]=p*l-u,t[8]=f*l+g,t[1]=a*h,t[5]=g*l+f,t[9]=u*l-p,t[2]=-l,t[6]=o*a,t[10]=s*a}else if(e.order==="YZX"){let f=s*a,u=s*l,p=o*a,g=o*l;t[0]=a*c,t[4]=g-f*h,t[8]=p*h+u,t[1]=h,t[5]=s*c,t[9]=-o*c,t[2]=-l*c,t[6]=u*h+p,t[10]=f-g*h}else if(e.order==="XZY"){let f=s*a,u=s*l,p=o*a,g=o*l;t[0]=a*c,t[4]=-h,t[8]=l*c,t[1]=f*h+g,t[5]=s*c,t[9]=u*h-p,t[2]=p*h-u,t[6]=o*c,t[10]=g*h+f}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Iv,e,Lv)}lookAt(e,t,n){let i=this.elements;if(un.subVectors(e,t),un.lengthSq()===0)un.z=1;if(un.normalize(),di.crossVectors(n,un),di.lengthSq()===0){if(Math.abs(n.z)===1)un.x+=0.0001;else un.z+=0.0001;un.normalize(),di.crossVectors(n,un)}return di.normalize(),To.crossVectors(un,di),i[0]=di.x,i[4]=To.x,i[8]=un.x,i[1]=di.y,i[5]=To.y,i[9]=un.y,i[2]=di.z,i[6]=To.z,i[10]=un.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,s=n[0],o=n[4],a=n[8],l=n[12],c=n[1],h=n[5],f=n[9],u=n[13],p=n[2],g=n[6],y=n[10],m=n[14],d=n[3],b=n[7],S=n[11],_=n[15],x=i[0],w=i[4],E=i[8],v=i[12],A=i[1],N=i[5],P=i[9],D=i[13],W=i[2],R=i[6],I=i[10],k=i[14],z=i[3],te=i[7],Y=i[11],Q=i[15];return r[0]=s*x+o*A+a*W+l*z,r[4]=s*w+o*N+a*R+l*te,r[8]=s*E+o*P+a*I+l*Y,r[12]=s*v+o*D+a*k+l*Q,r[1]=c*x+h*A+f*W+u*z,r[5]=c*w+h*N+f*R+u*te,r[9]=c*E+h*P+f*I+u*Y,r[13]=c*v+h*D+f*k+u*Q,r[2]=p*x+g*A+y*W+m*z,r[6]=p*w+g*N+y*R+m*te,r[10]=p*E+g*P+y*I+m*Y,r[14]=p*v+g*D+y*k+m*Q,r[3]=d*x+b*A+S*W+_*z,r[7]=d*w+b*N+S*R+_*te,r[11]=d*E+b*P+S*I+_*Y,r[15]=d*v+b*D+S*k+_*Q,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[12],s=e[1],o=e[5],a=e[9],l=e[13],c=e[2],h=e[6],f=e[10],u=e[14],p=e[3],g=e[7],y=e[11],m=e[15],d=a*u-l*f,b=o*u-l*h,S=o*f-a*h,_=s*u-l*c,x=s*f-a*c,w=s*h-o*c;return t*(g*d-y*b+m*S)-n*(p*d-y*_+m*x)+i*(p*b-g*_+m*w)-r*(p*S-g*x+y*w)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[1],s=e[5],o=e[9],a=e[2],l=e[6],c=e[10];return t*(s*c-o*l)-n*(r*c-o*a)+i*(r*l-s*a)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;if(e.isVector3)i[12]=e.x,i[13]=e.y,i[14]=e.z;else i[12]=e,i[13]=t,i[14]=n;return this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],s=e[4],o=e[5],a=e[6],l=e[7],c=e[8],h=e[9],f=e[10],u=e[11],p=e[12],g=e[13],y=e[14],m=e[15],d=t*o-n*s,b=t*a-i*s,S=t*l-r*s,_=n*a-i*o,x=n*l-r*o,w=i*l-r*a,E=c*g-h*p,v=c*y-f*p,A=c*m-u*p,N=h*y-f*g,P=h*m-u*g,D=f*m-u*y,W=d*D-b*P+S*N+_*A-x*v+w*E;if(W===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let R=1/W;return e[0]=(o*D-a*P+l*N)*R,e[1]=(i*P-n*D-r*N)*R,e[2]=(g*w-y*x+m*_)*R,e[3]=(f*x-h*w-u*_)*R,e[4]=(a*A-s*D-l*v)*R,e[5]=(t*D-i*A+r*v)*R,e[6]=(y*S-p*w-m*b)*R,e[7]=(c*w-f*S+u*b)*R,e[8]=(s*P-o*A+l*E)*R,e[9]=(n*A-t*P-r*E)*R,e[10]=(p*x-g*S+m*d)*R,e[11]=(h*S-c*x-u*d)*R,e[12]=(o*v-s*N-a*E)*R,e[13]=(t*N-n*v+i*E)*R,e[14]=(g*b-p*_-y*d)*R,e[15]=(c*_-h*b+f*d)*R,this}scale(e){let t=this.elements,{x:n,y:i,z:r}=e;return t[0]*=n,t[4]*=i,t[8]*=r,t[1]*=n,t[5]*=i,t[9]*=r,t[2]*=n,t[6]*=i,t[10]*=r,t[3]*=n,t[7]*=i,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){if(e.isVector3)this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1);else this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1);return this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),r=1-n,{x:s,y:o,z:a}=e,l=r*s,c=r*o;return this.set(l*s+n,l*o-i*a,l*a+i*o,0,l*o+i*a,c*o+n,c*a-i*s,0,l*a-i*o,c*a+i*s,r*a*a+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,r,s){return this.set(1,n,r,0,e,1,s,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,{_x:r,_y:s,_z:o,_w:a}=t,l=r+r,c=s+s,h=o+o,f=r*l,u=r*c,p=r*h,g=s*c,y=s*h,m=o*h,d=a*l,b=a*c,S=a*h,{x:_,y:x,z:w}=n;return i[0]=(1-(g+m))*_,i[1]=(u+S)*_,i[2]=(p-b)*_,i[3]=0,i[4]=(u-S)*x,i[5]=(1-(f+m))*x,i[6]=(y+d)*x,i[7]=0,i[8]=(p+b)*w,i[9]=(y-d)*w,i[10]=(1-(f+g))*w,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements;e.x=i[12],e.y=i[13],e.z=i[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),t.identity(),this;let s=cr.set(i[0],i[1],i[2]).length(),o=cr.set(i[4],i[5],i[6]).length(),a=cr.set(i[8],i[9],i[10]).length();if(r<0)s=-s;Tn.copy(this);let l=1/s,c=1/o,h=1/a;return Tn.elements[0]*=l,Tn.elements[1]*=l,Tn.elements[2]*=l,Tn.elements[4]*=c,Tn.elements[5]*=c,Tn.elements[6]*=c,Tn.elements[8]*=h,Tn.elements[9]*=h,Tn.elements[10]*=h,t.setFromRotationMatrix(Tn),n.x=s,n.y=o,n.z=a,this}makePerspective(e,t,n,i,r,s,o=2000,a=!1){let l=this.elements,c=2*r/(t-e),h=2*r/(n-i),f=(t+e)/(t-e),u=(n+i)/(n-i),p,g;if(a)p=r/(s-r),g=s*r/(s-r);else if(o===2000)p=-(s+r)/(s-r),g=-2*s*r/(s-r);else if(o===2001)p=-s/(s-r),g=-s*r/(s-r);else throw Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=f,l[12]=0,l[1]=0,l[5]=h,l[9]=u,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,i,r,s,o=2000,a=!1){let l=this.elements,c=2/(t-e),h=2/(n-i),f=-(t+e)/(t-e),u=-(n+i)/(n-i),p,g;if(a)p=1/(s-r),g=s/(s-r);else if(o===2000)p=-2/(s-r),g=-(s+r)/(s-r);else if(o===2001)p=-1/(s-r),g=-r/(s-r);else throw Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=0,l[12]=f,l[1]=0,l[5]=h,l[9]=0,l[13]=u,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}var cr=new L,Tn=new Ke,Iv=new L(0,0,0),Lv=new L(1,1,1),di=new L,To=new L,un=new L,Yd=new Ke,$d=new kt;class ni{constructor(e=0,t=0,n=0,i=ni.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let i=e.elements,r=i[0],s=i[4],o=i[8],a=i[1],l=i[5],c=i[9],h=i[2],f=i[6],u=i[10];switch(t){case"XYZ":if(this._y=Math.asin(He(o,-1,1)),Math.abs(o)<0.9999999)this._x=Math.atan2(-c,u),this._z=Math.atan2(-s,r);else this._x=Math.atan2(f,l),this._z=0;break;case"YXZ":if(this._x=Math.asin(-He(c,-1,1)),Math.abs(c)<0.9999999)this._y=Math.atan2(o,u),this._z=Math.atan2(a,l);else this._y=Math.atan2(-h,r),this._z=0;break;case"ZXY":if(this._x=Math.asin(He(f,-1,1)),Math.abs(f)<0.9999999)this._y=Math.atan2(-h,u),this._z=Math.atan2(-s,l);else this._y=0,this._z=Math.atan2(a,r);break;case"ZYX":if(this._y=Math.asin(-He(h,-1,1)),Math.abs(h)<0.9999999)this._x=Math.atan2(f,u),this._z=Math.atan2(a,r);else this._x=0,this._z=Math.atan2(-s,l);break;case"YZX":if(this._z=Math.asin(He(a,-1,1)),Math.abs(a)<0.9999999)this._x=Math.atan2(-c,l),this._y=Math.atan2(-h,r);else this._x=0,this._y=Math.atan2(o,u);break;case"XZY":if(this._z=Math.asin(-He(s,-1,1)),Math.abs(s)<0.9999999)this._x=Math.atan2(f,l),this._y=Math.atan2(o,r);else this._x=Math.atan2(-c,u),this._y=0;break;default:Ie("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}if(this._order=t,n===!0)this._onChangeCallback();return this}setFromQuaternion(e,t,n){return Yd.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Yd,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return $d.setFromEuler(this),this.setFromQuaternion($d,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){if(this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0)this._order=e[3];return this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}ni.DEFAULT_ORDER="XYZ";class Is{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}var Dv=0,Zd=new L,hr=new kt,Yn=new Ke,Eo=new L,is=new L,Nv=new L,Ov=new kt,Jd=new L(1,0,0),Kd=new L(0,1,0),Qd=new L(0,0,1),ep={type:"added"},Uv={type:"removed"},ur={type:"childadded",child:null},Ul={type:"childremoved",child:null};class Rt extends zn{constructor(){super();this.isObject3D=!0,Object.defineProperty(this,"id",{value:Dv++}),this.uuid=ei(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Rt.DEFAULT_UP.clone();let e=new L,t=new ni,n=new kt,i=new L(1,1,1);function r(){n.setFromEuler(t,!1)}function s(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(s),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Ke},normalMatrix:{value:new Be}}),this.matrix=new Ke,this.matrixWorld=new Ke,this.matrixAutoUpdate=Rt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Rt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Is,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){if(this.matrixAutoUpdate)this.updateMatrix();this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return hr.setFromAxisAngle(e,t),this.quaternion.multiply(hr),this}rotateOnWorldAxis(e,t){return hr.setFromAxisAngle(e,t),this.quaternion.premultiply(hr),this}rotateX(e){return this.rotateOnAxis(Jd,e)}rotateY(e){return this.rotateOnAxis(Kd,e)}rotateZ(e){return this.rotateOnAxis(Qd,e)}translateOnAxis(e,t){return Zd.copy(e).applyQuaternion(this.quaternion),this.position.add(Zd.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Jd,e)}translateY(e){return this.translateOnAxis(Kd,e)}translateZ(e){return this.translateOnAxis(Qd,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Yn.copy(this.matrixWorld).invert())}lookAt(e,t,n){if(e.isVector3)Eo.copy(e);else Eo.set(e,t,n);let i=this.parent;if(this.updateWorldMatrix(!0,!1),is.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight)Yn.lookAt(is,Eo,this.up);else Yn.lookAt(Eo,is,this.up);if(this.quaternion.setFromRotationMatrix(Yn),i)Yn.extractRotation(i.matrixWorld),hr.setFromRotationMatrix(Yn),this.quaternion.premultiply(hr.invert())}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}if(e===this)return De("Object3D.add: object can't be added as a child of itself.",e),this;if(e&&e.isObject3D)e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(ep),ur.child=e,this.dispatchEvent(ur),ur.child=null;else De("Object3D.add: object not an instance of THREE.Object3D.",e);return this}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);if(t!==-1)e.parent=null,this.children.splice(t,1),e.dispatchEvent(Uv),Ul.child=e,this.dispatchEvent(Ul),Ul.child=null;return this}removeFromParent(){let e=this.parent;if(e!==null)e.remove(this);return this}clear(){return this.remove(...this.children)}attach(e){if(this.updateWorldMatrix(!0,!1),Yn.copy(this.matrixWorld).invert(),e.parent!==null)e.parent.updateWorldMatrix(!0,!1),Yn.multiply(e.parent.matrixWorld);return e.applyMatrix4(Yn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(ep),ur.child=e,this.dispatchEvent(ur),ur.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let s=this.children[n].getObjectByProperty(e,t);if(s!==void 0)return s}return}getObjectsByProperty(e,t,n=[]){if(this[e]===t)n.push(this);let i=this.children;for(let r=0,s=i.length;r<s;r++)i[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(is,e,Nv),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(is,Ov,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;if(t!==null)e(t),t.traverseAncestors(e)}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let{x:t,y:n,z:i}=e,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*i,r[13]+=n-r[1]*t-r[5]*n-r[9]*i,r[14]+=i-r[2]*t-r[6]*n-r[10]*i}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldNeedsUpdate||e){if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);this.matrixWorldNeedsUpdate=!1,e=!0}let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let i=this.parent;if(e===!0&&i!==null)i.updateWorldMatrix(!0,!1);if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldNeedsUpdate||n){if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);this.matrixWorldNeedsUpdate=!1,n=!0}if(t===!0){let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e==="string",n={};if(t)e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"};let i={};if(i.uuid=this.uuid,i.type=this.type,i.name=this.name,i.castShadow=this.castShadow,i.receiveShadow=this.receiveShadow,i.visible=this.visible,i.frustumCulled=this.frustumCulled,i.renderOrder=this.renderOrder,i.static=this.static,i.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0)i.userData=this.userData;if(i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.pivot!==null)i.pivot=this.pivot.toArray();if(this.morphTargetDictionary!==void 0)i.morphTargetDictionary=Object.assign({},this.morphTargetDictionary);if(this.morphTargetInfluences!==void 0)i.morphTargetInfluences=this.morphTargetInfluences.slice();if(this.isInstancedMesh){if(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null)i.instanceColor=this.instanceColor.toJSON()}if(this.isBatchedMesh){if(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map((o)=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map((o)=>({...o})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(e),i.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null)i.colorsTexture=this._colorsTexture.toJSON(e);if(this.boundingSphere!==null)i.boundingSphere=this.boundingSphere.toJSON();if(this.boundingBox!==null)i.boundingBox=this.boundingBox.toJSON()}function r(o,a){if(o[a.uuid]===void 0)o[a.uuid]=a.toJSON(e);return a.uuid}if(this.isScene){if(this.background){if(this.background.isColor)i.background=this.background.toJSON();else if(this.background.isTexture)i.background=this.background.toJSON(e).uuid}if(this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0)i.environment=this.environment.toJSON(e).uuid}else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let a=o.shapes;if(Array.isArray(a))for(let l=0,c=a.length;l<c;l++){let h=a[l];r(e.shapes,h)}else r(e.shapes,a)}}if(this.isSkinnedMesh){if(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0)r(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid}if(this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let a=0,l=this.material.length;a<l;a++)o.push(r(e.materials,this.material[a]));i.material=o}else i.material=r(e.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){let a=this.animations[o];i.animations.push(r(e.animations,a))}}if(t){let o=s(e.geometries),a=s(e.materials),l=s(e.textures),c=s(e.images),h=s(e.shapes),f=s(e.skeletons),u=s(e.animations),p=s(e.nodes);if(o.length>0)n.geometries=o;if(a.length>0)n.materials=a;if(l.length>0)n.textures=l;if(c.length>0)n.images=c;if(h.length>0)n.shapes=h;if(f.length>0)n.skeletons=f;if(u.length>0)n.animations=u;if(p.length>0)n.nodes=p}return n.object=i,n;function s(o){let a=[];for(let l in o){let c=o[l];delete c.metadata,a.push(c)}return a}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}}Rt.DEFAULT_UP=new L(0,1,0);Rt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Rt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class Qn extends Rt{constructor(){super();this.isGroup=!0,this.type="Group"}}var Fv={type:"move"};class Ls{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){if(this._hand===null)this._hand=new Qn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1};return this._hand}getTargetRaySpace(){if(this._targetRay===null)this._targetRay=new Qn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new L,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new L;return this._targetRay}getGripSpace(){if(this._grip===null)this._grip=new Qn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new L,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new L,this._grip.eventsEnabled=!1;return this._grip}dispatchEvent(e){if(this._targetRay!==null)this._targetRay.dispatchEvent(e);if(this._grip!==null)this._grip.dispatchEvent(e);if(this._hand!==null)this._hand.dispatchEvent(e);return this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){if(this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null)this._targetRay.visible=!1;if(this._grip!==null)this._grip.visible=!1;if(this._hand!==null)this._hand.visible=!1;return this}update(e,t,n){let i=null,r=null,s=null,o=this._targetRay,a=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){s=!0;for(let g of e.hand.values()){let y=t.getJointPose(g,n),m=this._getHandJoint(l,g);if(y!==null)m.matrix.fromArray(y.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=y.radius;m.visible=y!==null}let c=l.joints["index-finger-tip"],h=l.joints["thumb-tip"],f=c.position.distanceTo(h.position),u=0.02,p=0.005;if(l.inputState.pinching&&f>u+p)l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this});else if(!l.inputState.pinching&&f<=u-p)l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this})}else if(a!==null&&e.gripSpace){if(r=t.getPose(e.gripSpace,n),r!==null){if(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity)a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity);else a.hasLinearVelocity=!1;if(r.angularVelocity)a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity);else a.hasAngularVelocity=!1;if(a.eventsEnabled)a.dispatchEvent({type:"gripUpdated",data:e,target:this})}}if(o!==null){if(i=t.getPose(e.targetRaySpace,n),i===null&&r!==null)i=r;if(i!==null){if(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity)o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity);else o.hasLinearVelocity=!1;if(i.angularVelocity)o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity);else o.hasAngularVelocity=!1;this.dispatchEvent(Fv)}}}if(o!==null)o.visible=i!==null;if(a!==null)a.visible=r!==null;if(l!==null)l.visible=s!==null;return this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Qn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}var bm={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},pi={h:0,s:0,l:0},Ao={h:0,s:0,l:0};function Fl(e,t,n){if(n<0)n+=1;if(n>1)n-=1;if(n<0.16666666666666666)return e+(t-e)*6*n;if(n<0.5)return t;if(n<0.6666666666666666)return e+(t-e)*6*(0.6666666666666666-n);return e}class Fe{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let i=e;if(i&&i.isColor)this.copy(i);else if(typeof i==="number")this.setHex(i);else if(typeof i==="string")this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t="srgb"){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,We.colorSpaceToWorking(this,t),this}setRGB(e,t,n,i=We.workingColorSpace){return this.r=e,this.g=t,this.b=n,We.colorSpaceToWorking(this,i),this}setHSL(e,t,n,i=We.workingColorSpace){if(e=Zc(e,1),t=He(t,0,1),n=He(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=0.5?n*(1+t):n+t-n*t,s=2*n-r;this.r=Fl(s,r,e+0.3333333333333333),this.g=Fl(s,r,e),this.b=Fl(s,r,e-0.3333333333333333)}return We.colorSpaceToWorking(this,i),this}setStyle(e,t="srgb"){function n(r){if(r===void 0)return;if(parseFloat(r)<1)Ie("Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,s=i[1],o=i[2];switch(s){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Ie("Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=i[1],s=r.length;if(s===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);else if(s===6)return this.setHex(parseInt(r,16),t);else Ie("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t="srgb"){let n=bm[e.toLowerCase()];if(n!==void 0)this.setHex(n,t);else Ie("Color: Unknown color "+e);return this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=ti(e.r),this.g=ti(e.g),this.b=ti(e.b),this}copyLinearToSRGB(e){return this.r=Er(e.r),this.g=Er(e.g),this.b=Er(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e="srgb"){return We.workingToColorSpace(Wt.copy(this),e),Math.round(He(Wt.r*255,0,255))*65536+Math.round(He(Wt.g*255,0,255))*256+Math.round(He(Wt.b*255,0,255))}getHexString(e="srgb"){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=We.workingColorSpace){We.workingToColorSpace(Wt.copy(this),t);let{r:n,g:i,b:r}=Wt,s=Math.max(n,i,r),o=Math.min(n,i,r),a,l,c=(o+s)/2;if(o===s)a=0,l=0;else{let h=s-o;switch(l=c<=0.5?h/(s+o):h/(2-s-o),s){case n:a=(i-r)/h+(i<r?6:0);break;case i:a=(r-n)/h+2;break;case r:a=(n-i)/h+4;break}a/=6}return e.h=a,e.s=l,e.l=c,e}getRGB(e,t=We.workingColorSpace){return We.workingToColorSpace(Wt.copy(this),t),e.r=Wt.r,e.g=Wt.g,e.b=Wt.b,e}getStyle(e="srgb"){We.workingToColorSpace(Wt.copy(this),e);let{r:t,g:n,b:i}=Wt;if(e!=="srgb")return`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`;return`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(pi),this.setHSL(pi.h+e,pi.s+t,pi.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(pi),e.getHSL(Ao);let n=fs(pi.h,Ao.h,t),i=fs(pi.s,Ao.s,t),r=fs(pi.l,Ao.l,t);return this.setHSL(n,i,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,i=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*i,this.g=r[1]*t+r[4]*n+r[7]*i,this.b=r[2]*t+r[5]*n+r[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}var Wt=new Fe;Fe.NAMES=bm;class fa extends Rt{constructor(){super();if(this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ni,this.environmentIntensity=1,this.environmentRotation=new ni,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){if(super.copy(e,t),e.background!==null)this.background=e.background.clone();if(e.environment!==null)this.environment=e.environment.clone();if(e.fog!==null)this.fog=e.fog.clone();if(this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null)this.overrideMaterial=e.overrideMaterial.clone();return this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);if(this.fog!==null)t.object.fog=this.fog.toJSON();return t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}}var En=new L,$n=new L,Bl=new L,Zn=new L,fr=new L,dr=new L,tp=new L,kl=new L,zl=new L,Gl=new L,Hl=new gt,Vl=new gt,Wl=new gt;class dn{constructor(e=new L,t=new L,n=new L){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),En.subVectors(e,t),i.cross(En);let r=i.lengthSq();if(r>0)return i.multiplyScalar(1/Math.sqrt(r));return i.set(0,0,0)}static getBarycoord(e,t,n,i,r){En.subVectors(i,t),$n.subVectors(n,t),Bl.subVectors(e,t);let s=En.dot(En),o=En.dot($n),a=En.dot(Bl),l=$n.dot($n),c=$n.dot(Bl),h=s*l-o*o;if(h===0)return r.set(0,0,0),null;let f=1/h,u=(l*a-o*c)*f,p=(s*c-o*a)*f;return r.set(1-u-p,p,u)}static containsPoint(e,t,n,i){if(this.getBarycoord(e,t,n,i,Zn)===null)return!1;return Zn.x>=0&&Zn.y>=0&&Zn.x+Zn.y<=1}static getInterpolation(e,t,n,i,r,s,o,a){if(this.getBarycoord(e,t,n,i,Zn)===null){if(a.x=0,a.y=0,"z"in a)a.z=0;if("w"in a)a.w=0;return null}return a.setScalar(0),a.addScaledVector(r,Zn.x),a.addScaledVector(s,Zn.y),a.addScaledVector(o,Zn.z),a}static getInterpolatedAttribute(e,t,n,i,r,s){return Hl.setScalar(0),Vl.setScalar(0),Wl.setScalar(0),Hl.fromBufferAttribute(e,t),Vl.fromBufferAttribute(e,n),Wl.fromBufferAttribute(e,i),s.setScalar(0),s.addScaledVector(Hl,r.x),s.addScaledVector(Vl,r.y),s.addScaledVector(Wl,r.z),s}static isFrontFacing(e,t,n,i){return En.subVectors(n,t),$n.subVectors(e,t),En.cross($n).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return En.subVectors(this.c,this.b),$n.subVectors(this.a,this.b),En.cross($n).length()*0.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(0.3333333333333333)}getNormal(e){return dn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return dn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,i,r){return dn.getInterpolation(e,this.a,this.b,this.c,t,n,i,r)}containsPoint(e){return dn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return dn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,i=this.b,r=this.c,s,o;fr.subVectors(i,n),dr.subVectors(r,n),kl.subVectors(e,n);let a=fr.dot(kl),l=dr.dot(kl);if(a<=0&&l<=0)return t.copy(n);zl.subVectors(e,i);let c=fr.dot(zl),h=dr.dot(zl);if(c>=0&&h<=c)return t.copy(i);let f=a*h-c*l;if(f<=0&&a>=0&&c<=0)return s=a/(a-c),t.copy(n).addScaledVector(fr,s);Gl.subVectors(e,r);let u=fr.dot(Gl),p=dr.dot(Gl);if(p>=0&&u<=p)return t.copy(r);let g=u*l-a*p;if(g<=0&&l>=0&&p<=0)return o=l/(l-p),t.copy(n).addScaledVector(dr,o);let y=c*p-u*h;if(y<=0&&h-c>=0&&u-p>=0)return tp.subVectors(r,i),o=(h-c)/(h-c+(u-p)),t.copy(i).addScaledVector(tp,o);let m=1/(y+g+f);return s=g*m,o=f*m,t.copy(n).addScaledVector(fr,s).addScaledVector(dr,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class In{constructor(e=new L(1/0,1/0,1/0),t=new L(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(An.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(An.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=An.copy(t).multiplyScalar(0.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(0.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let s=0,o=r.count;s<o;s++){if(e.isMesh===!0)e.getVertexPosition(s,An);else An.fromBufferAttribute(r,s);An.applyMatrix4(e.matrixWorld),this.expandByPoint(An)}else{if(e.boundingBox!==void 0){if(e.boundingBox===null)e.computeBoundingBox();Co.copy(e.boundingBox)}else{if(n.boundingBox===null)n.computeBoundingBox();Co.copy(n.boundingBox)}Co.applyMatrix4(e.matrixWorld),this.union(Co)}}let i=e.children;for(let r=0,s=i.length;r<s;r++)this.expandByObject(i[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,An),An.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;if(e.normal.x>0)t=e.normal.x*this.min.x,n=e.normal.x*this.max.x;else t=e.normal.x*this.max.x,n=e.normal.x*this.min.x;if(e.normal.y>0)t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y;else t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y;if(e.normal.z>0)t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z;else t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z;return t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(rs),Ro.subVectors(this.max,rs),pr.subVectors(e.a,rs),mr.subVectors(e.b,rs),gr.subVectors(e.c,rs),mi.subVectors(mr,pr),gi.subVectors(gr,mr),Ni.subVectors(pr,gr);let t=[0,-mi.z,mi.y,0,-gi.z,gi.y,0,-Ni.z,Ni.y,mi.z,0,-mi.x,gi.z,0,-gi.x,Ni.z,0,-Ni.x,-mi.y,mi.x,0,-gi.y,gi.x,0,-Ni.y,Ni.x,0];if(!Xl(t,pr,mr,gr,Ro))return!1;if(t=[1,0,0,0,1,0,0,0,1],!Xl(t,pr,mr,gr,Ro))return!1;return Po.crossVectors(mi,gi),t=[Po.x,Po.y,Po.z],Xl(t,pr,mr,gr,Ro)}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,An).distanceTo(e)}getBoundingSphere(e){if(this.isEmpty())e.makeEmpty();else this.getCenter(e.center),e.radius=this.getSize(An).length()*0.5;return e}intersect(e){if(this.min.max(e.min),this.max.min(e.max),this.isEmpty())this.makeEmpty();return this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){if(this.isEmpty())return this;return Jn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Jn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Jn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Jn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Jn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Jn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Jn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Jn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Jn),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}var Jn=[new L,new L,new L,new L,new L,new L,new L,new L],An=new L,Co=new In,pr=new L,mr=new L,gr=new L,mi=new L,gi=new L,Ni=new L,rs=new L,Ro=new L,Po=new L,Oi=new L;function Xl(e,t,n,i,r){for(let s=0,o=e.length-3;s<=o;s+=3){Oi.fromArray(e,s);let a=r.x*Math.abs(Oi.x)+r.y*Math.abs(Oi.y)+r.z*Math.abs(Oi.z),l=t.dot(Oi),c=n.dot(Oi),h=i.dot(Oi);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var wt=new L,Io=new re,Bv=0;class on extends zn{constructor(e,t,n=!1){super();if(Array.isArray(e))throw TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Bv++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=35044,this.updateRanges=[],this.gpuType=1015,this.version=0}onUploadCallback(){}set needsUpdate(e){if(e===!0)this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Io.fromBufferAttribute(this,t),Io.applyMatrix3(e),this.setXY(t,Io.x,Io.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.applyMatrix3(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.applyMatrix4(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.applyNormalMatrix(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.transformDirection(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];if(this.normalized)n=Cn(n,this.array);return n}setComponent(e,t,n){if(this.normalized)n=st(n,this.array);return this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];if(this.normalized)t=Cn(t,this.array);return t}setX(e,t){if(this.normalized)t=st(t,this.array);return this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];if(this.normalized)t=Cn(t,this.array);return t}setY(e,t){if(this.normalized)t=st(t,this.array);return this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];if(this.normalized)t=Cn(t,this.array);return t}setZ(e,t){if(this.normalized)t=st(t,this.array);return this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];if(this.normalized)t=Cn(t,this.array);return t}setW(e,t){if(this.normalized)t=st(t,this.array);return this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){if(e*=this.itemSize,this.normalized)t=st(t,this.array),n=st(n,this.array);return this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){if(e*=this.itemSize,this.normalized)t=st(t,this.array),n=st(n,this.array),i=st(i,this.array);return this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,r){if(e*=this.itemSize,this.normalized)t=st(t,this.array),n=st(n,this.array),i=st(i,this.array),r=st(r,this.array);return this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}}class da extends on{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class pa extends on{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class mt extends on{constructor(e,t,n){super(new Float32Array(e),t,n)}}var kv=new In,ss=new L,ql=new L;class Fr{constructor(e=new L,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;if(t!==void 0)n.copy(t);else kv.setFromPoints(e).getCenter(n);let i=0;for(let r=0,s=e.length;r<s;r++)i=Math.max(i,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);if(t.copy(e),n>this.radius*this.radius)t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center);return t}getBoundingBox(e){if(this.isEmpty())return e.makeEmpty(),e;return e.set(this.center,this.center),e.expandByScalar(this.radius),e}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;ss.subVectors(e,this.center);let t=ss.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*0.5;this.center.addScaledVector(ss,i/n),this.radius+=i}return this}union(e){if(e.isEmpty())return this;if(this.isEmpty())return this.copy(e),this;if(this.center.equals(e.center)===!0)this.radius=Math.max(this.radius,e.radius);else ql.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(ss.copy(e.center).add(ql)),this.expandByPoint(ss.copy(e.center).sub(ql));return this}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}var zv=0,yn=new Ke,jl=new Rt,_r=new L,fn=new In,os=new In,Ut=new L;class It extends zn{constructor(){super();this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:zv++}),this.uuid=ei(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){if(Array.isArray(e))this.index=new((hv(e))?pa:da)(e,1);else this.index=e;return this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;if(t!==void 0)t.applyMatrix4(e),t.needsUpdate=!0;let n=this.attributes.normal;if(n!==void 0){let r=new Be().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}let i=this.attributes.tangent;if(i!==void 0)i.transformDirection(e),i.needsUpdate=!0;if(this.boundingBox!==null)this.computeBoundingBox();if(this.boundingSphere!==null)this.computeBoundingSphere();return this._transformed=!0,this}applyQuaternion(e){return yn.makeRotationFromQuaternion(e),this.applyMatrix4(yn),this}rotateX(e){return yn.makeRotationX(e),this.applyMatrix4(yn),this}rotateY(e){return yn.makeRotationY(e),this.applyMatrix4(yn),this}rotateZ(e){return yn.makeRotationZ(e),this.applyMatrix4(yn),this}translate(e,t,n){return yn.makeTranslation(e,t,n),this.applyMatrix4(yn),this}scale(e,t,n){return yn.makeScale(e,t,n),this.applyMatrix4(yn),this}lookAt(e){return jl.lookAt(e),jl.updateMatrix(),this.applyMatrix4(jl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(_r).negate(),this.translate(_r.x,_r.y,_r.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let i=0,r=e.length;i<r;i++){let s=e[i];n.push(s.x,s.y,s.z||0)}this.setAttribute("position",new mt(n,3))}else{let n=Math.min(e.length,t.count);for(let i=0;i<n;i++){let r=e[i];t.setXYZ(i,r.x,r.y,r.z||0)}if(e.length>t.count)Ie("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.");t.needsUpdate=!0}return this}computeBoundingBox(){if(this.boundingBox===null)this.boundingBox=new In;let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){De("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new L(-1/0,-1/0,-1/0),new L(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let r=t[n];if(fn.setFromBufferAttribute(r),this.morphTargetsRelative)Ut.addVectors(this.boundingBox.min,fn.min),this.boundingBox.expandByPoint(Ut),Ut.addVectors(this.boundingBox.max,fn.max),this.boundingBox.expandByPoint(Ut);else this.boundingBox.expandByPoint(fn.min),this.boundingBox.expandByPoint(fn.max)}}else this.boundingBox.makeEmpty();if(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))De('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){if(this.boundingSphere===null)this.boundingSphere=new Fr;let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){De("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new L,1/0);return}if(e){let n=this.boundingSphere.center;if(fn.setFromBufferAttribute(e),t)for(let r=0,s=t.length;r<s;r++){let o=t[r];if(os.setFromBufferAttribute(o),this.morphTargetsRelative)Ut.addVectors(fn.min,os.min),fn.expandByPoint(Ut),Ut.addVectors(fn.max,os.max),fn.expandByPoint(Ut);else fn.expandByPoint(os.min),fn.expandByPoint(os.max)}fn.getCenter(n);let i=0;for(let r=0,s=e.count;r<s;r++)Ut.fromBufferAttribute(e,r),i=Math.max(i,n.distanceToSquared(Ut));if(t)for(let r=0,s=t.length;r<s;r++){let o=t[r],a=this.morphTargetsRelative;for(let l=0,c=o.count;l<c;l++){if(Ut.fromBufferAttribute(o,l),a)_r.fromBufferAttribute(e,l),Ut.add(_r);i=Math.max(i,n.distanceToSquared(Ut))}}if(this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius))De('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){De("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let{position:n,normal:i,uv:r}=t,s=this.getAttribute("tangent");if(s===void 0||s.count!==n.count)s=new on(new Float32Array(4*n.count),4),this.setAttribute("tangent",s);let o=[],a=[];for(let E=0;E<n.count;E++)o[E]=new L,a[E]=new L;let l=new L,c=new L,h=new L,f=new re,u=new re,p=new re,g=new L,y=new L;function m(E,v,A){l.fromBufferAttribute(n,E),c.fromBufferAttribute(n,v),h.fromBufferAttribute(n,A),f.fromBufferAttribute(r,E),u.fromBufferAttribute(r,v),p.fromBufferAttribute(r,A),c.sub(l),h.sub(l),u.sub(f),p.sub(f);let N=1/(u.x*p.y-p.x*u.y);if(!isFinite(N))return;g.copy(c).multiplyScalar(p.y).addScaledVector(h,-u.y).multiplyScalar(N),y.copy(h).multiplyScalar(u.x).addScaledVector(c,-p.x).multiplyScalar(N),o[E].add(g),o[v].add(g),o[A].add(g),a[E].add(y),a[v].add(y),a[A].add(y)}let d=this.groups;if(d.length===0)d=[{start:0,count:e.count}];for(let E=0,v=d.length;E<v;++E){let A=d[E],{start:N,count:P}=A;for(let D=N,W=N+P;D<W;D+=3)m(e.getX(D+0),e.getX(D+1),e.getX(D+2))}let b=new L,S=new L,_=new L,x=new L;function w(E){_.fromBufferAttribute(i,E),x.copy(_);let v=o[E];b.copy(v),b.sub(_.multiplyScalar(_.dot(v))).normalize(),S.crossVectors(x,v);let N=S.dot(a[E])<0?-1:1;s.setXYZW(E,b.x,b.y,b.z,N)}for(let E=0,v=d.length;E<v;++E){let A=d[E],{start:N,count:P}=A;for(let D=N,W=N+P;D<W;D+=3)w(e.getX(D+0)),w(e.getX(D+1)),w(e.getX(D+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new on(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let f=0,u=n.count;f<u;f++)n.setXYZ(f,0,0,0);let i=new L,r=new L,s=new L,o=new L,a=new L,l=new L,c=new L,h=new L;if(e)for(let f=0,u=e.count;f<u;f+=3){let p=e.getX(f+0),g=e.getX(f+1),y=e.getX(f+2);i.fromBufferAttribute(t,p),r.fromBufferAttribute(t,g),s.fromBufferAttribute(t,y),c.subVectors(s,r),h.subVectors(i,r),c.cross(h),o.fromBufferAttribute(n,p),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,y),o.add(c),a.add(c),l.add(c),n.setXYZ(p,o.x,o.y,o.z),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(y,l.x,l.y,l.z)}else for(let f=0,u=t.count;f<u;f+=3)i.fromBufferAttribute(t,f+0),r.fromBufferAttribute(t,f+1),s.fromBufferAttribute(t,f+2),c.subVectors(s,r),h.subVectors(i,r),c.cross(h),n.setXYZ(f+0,c.x,c.y,c.z),n.setXYZ(f+1,c.x,c.y,c.z),n.setXYZ(f+2,c.x,c.y,c.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Ut.fromBufferAttribute(e,t),Ut.normalize(),e.setXYZ(t,Ut.x,Ut.y,Ut.z)}toNonIndexed(){function e(o,a){let{array:l,itemSize:c,normalized:h}=o,f=new l.constructor(a.length*c),u=0,p=0;for(let g=0,y=a.length;g<y;g++){if(o.isInterleavedBufferAttribute)u=a[g]*o.data.stride+o.offset;else u=a[g]*c;for(let m=0;m<c;m++)f[p++]=l[u++]}return new on(f,c,h)}if(this.index===null)return Ie("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new It,n=this.index.array,i=this.attributes;for(let o in i){let a=i[o],l=e(a,n);t.setAttribute(o,l)}let r=this.morphAttributes;for(let o in r){let a=[],l=r[o];for(let c=0,h=l.length;c<h;c++){let f=l[c],u=e(f,n);a.push(u)}t.morphAttributes[o]=a}t.morphTargetsRelative=this.morphTargetsRelative;let s=this.groups;for(let o=0,a=s.length;o<a;o++){let l=s[o];t.addGroup(l.start,l.count,l.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0)e.userData=this.userData;if(this.parameters!==void 0&&this._transformed!==!0){let a=this.parameters;for(let l in a)if(a[l]!==void 0)e[l]=a[l];return e}e.data={attributes:{}};let t=this.index;if(t!==null)e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)};let n=this.attributes;for(let a in n){let l=n[a];e.data.attributes[a]=l.toJSON(e.data)}let i={},r=!1;for(let a in this.morphAttributes){let l=this.morphAttributes[a],c=[];for(let h=0,f=l.length;h<f;h++){let u=l[h];c.push(u.toJSON(e.data))}if(c.length>0)i[a]=c,r=!0}if(r)e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative;let s=this.groups;if(s.length>0)e.data.groups=JSON.parse(JSON.stringify(s));let o=this.boundingSphere;if(o!==null)e.data.boundingSphere=o.toJSON();return e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;if(n!==null)this.setIndex(n.clone());let i=e.attributes;for(let l in i){let c=i[l];this.setAttribute(l,c.clone(t))}let r=e.morphAttributes;for(let l in r){let c=[],h=r[l];for(let f=0,u=h.length;f<u;f++)c.push(h[f].clone(t));this.morphAttributes[l]=c}this.morphTargetsRelative=e.morphTargetsRelative;let s=e.groups;for(let l=0,c=s.length;l<c;l++){let h=s[l];this.addGroup(h.start,h.count,h.materialIndex)}let o=e.boundingBox;if(o!==null)this.boundingBox=o.clone();let a=e.boundingSphere;if(a!==null)this.boundingSphere=a.clone();return this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}class eh{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=35044,this.updateRanges=[],this.version=0,this.uuid=ei()}onUploadCallback(){}set needsUpdate(e){if(e===!0)this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,r=this.stride;i<r;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){if(e.arrayBuffers===void 0)e.arrayBuffers={};if(this.array.buffer._uuid===void 0)this.array.buffer._uuid=ei();if(e.arrayBuffers[this.array.buffer._uuid]===void 0)e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer;let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){if(e.arrayBuffers===void 0)e.arrayBuffers={};if(this.array.buffer._uuid===void 0)this.array.buffer._uuid=ei();if(e.arrayBuffers[this.array.buffer._uuid]===void 0)e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer));let t={uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride};return t.usage=this.usage,t}}var Jt=new L;class gs{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Jt.fromBufferAttribute(this,t),Jt.applyMatrix4(e),this.setXYZ(t,Jt.x,Jt.y,Jt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Jt.fromBufferAttribute(this,t),Jt.applyNormalMatrix(e),this.setXYZ(t,Jt.x,Jt.y,Jt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Jt.fromBufferAttribute(this,t),Jt.transformDirection(e),this.setXYZ(t,Jt.x,Jt.y,Jt.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];if(this.normalized)n=Cn(n,this.array);return n}setComponent(e,t,n){if(this.normalized)n=st(n,this.array);return this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){if(this.normalized)t=st(t,this.array);return this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){if(this.normalized)t=st(t,this.array);return this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){if(this.normalized)t=st(t,this.array);return this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){if(this.normalized)t=st(t,this.array);return this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];if(this.normalized)t=Cn(t,this.array);return t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];if(this.normalized)t=Cn(t,this.array);return t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];if(this.normalized)t=Cn(t,this.array);return t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];if(this.normalized)t=Cn(t,this.array);return t}setXY(e,t,n){if(e=e*this.data.stride+this.offset,this.normalized)t=st(t,this.array),n=st(n,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){if(e=e*this.data.stride+this.offset,this.normalized)t=st(t,this.array),n=st(n,this.array),i=st(i,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,r){if(e=e*this.data.stride+this.offset,this.normalized)t=st(t,this.array),n=st(n,this.array),i=st(i,this.array),r=st(r,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=r,this}clone(e){if(e===void 0){ms("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return new on(new this.array.constructor(t),this.itemSize,this.normalized)}else{if(e.interleavedBuffers===void 0)e.interleavedBuffers={};if(e.interleavedBuffers[this.data.uuid]===void 0)e.interleavedBuffers[this.data.uuid]=this.data.clone(e);return new gs(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}}toJSON(e){if(e===void 0){ms("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else{if(e.interleavedBuffers===void 0)e.interleavedBuffers={};if(e.interleavedBuffers[this.data.uuid]===void 0)e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e);return{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}}var Yl=new L,Gv=new L,Hv=new Be;class sn{constructor(e=new L(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=Yl.subVectors(n,t).cross(Gv.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let i=e.delta(Yl),r=this.normal.dot(i);if(r===0){if(this.distanceToPoint(e.start)===0)return t.copy(e.start);return null}let s=-(e.start.dot(this.normal)+this.constant)/r;if(n===!0&&(s<0||s>1))return null;return t.copy(e.start).addScaledVector(i,s)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Hv.getNormalMatrix(e),i=this.coplanarPoint(Yl).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}}var Vv=0;class ri extends zn{constructor(){super();this.isMaterial=!0,Object.defineProperty(this,"id",{value:Vv++}),this.uuid=ei(),this.name="",this.type="Material",this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Fe(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=7680,this.stencilZFail=7680,this.stencilZPass=7680,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){if(this._alphaTest>0!==e>0)this.version++;this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e===void 0)return;for(let t in e){let n=e[t];if(n===void 0){Ie(`Material: parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){Ie(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}if(i&&i.isColor)i.set(n);else if(i&&i.isVector2&&(n&&n.isVector2)||i&&i.isEuler&&(n&&n.isEuler)||i&&i.isVector3&&(n&&n.isVector3))i.copy(n);else this[t]=n}}toJSON(e){let t=e===void 0||typeof e==="string";if(t)e={textures:{},images:{}};let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};if(n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor)n.color=this.color.getHex();if(this.roughness!==void 0)n.roughness=this.roughness;if(this.metalness!==void 0)n.metalness=this.metalness;if(this.sheen!==void 0)n.sheen=this.sheen;if(this.sheenColor&&this.sheenColor.isColor)n.sheenColor=this.sheenColor.getHex();if(this.sheenRoughness!==void 0)n.sheenRoughness=this.sheenRoughness;if(this.emissive&&this.emissive.isColor)n.emissive=this.emissive.getHex();if(this.emissiveIntensity!==void 0)n.emissiveIntensity=this.emissiveIntensity;if(this.specular&&this.specular.isColor)n.specular=this.specular.getHex();if(this.specularIntensity!==void 0)n.specularIntensity=this.specularIntensity;if(this.specularColor&&this.specularColor.isColor)n.specularColor=this.specularColor.getHex();if(this.shininess!==void 0)n.shininess=this.shininess;if(this.clearcoat!==void 0)n.clearcoat=this.clearcoat;if(this.clearcoatRoughness!==void 0)n.clearcoatRoughness=this.clearcoatRoughness;if(this.clearcoatMap&&this.clearcoatMap.isTexture)n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid;if(this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture)n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid;if(this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture)n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray();if(this.sheenColorMap&&this.sheenColorMap.isTexture)n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid;if(this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture)n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid;if(this.dispersion!==void 0)n.dispersion=this.dispersion;if(this.retroreflectivity!==void 0)n.retroreflectivity=this.retroreflectivity;if(this.iridescence!==void 0)n.iridescence=this.iridescence;if(this.iridescenceIOR!==void 0)n.iridescenceIOR=this.iridescenceIOR;if(this.iridescenceThicknessRange!==void 0)n.iridescenceThicknessRange=this.iridescenceThicknessRange;if(this.iridescenceMap&&this.iridescenceMap.isTexture)n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid;if(this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture)n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid;if(this.anisotropy!==void 0)n.anisotropy=this.anisotropy;if(this.anisotropyRotation!==void 0)n.anisotropyRotation=this.anisotropyRotation;if(this.anisotropyMap&&this.anisotropyMap.isTexture)n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid;if(this.map&&this.map.isTexture)n.map=this.map.toJSON(e).uuid;if(this.matcap&&this.matcap.isTexture)n.matcap=this.matcap.toJSON(e).uuid;if(this.alphaMap&&this.alphaMap.isTexture)n.alphaMap=this.alphaMap.toJSON(e).uuid;if(this.lightMap&&this.lightMap.isTexture)n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity;if(this.aoMap&&this.aoMap.isTexture)n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity;if(this.bumpMap&&this.bumpMap.isTexture)n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale;if(this.normalMap&&this.normalMap.isTexture)n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray();if(this.displacementMap&&this.displacementMap.isTexture)n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias;if(this.roughnessMap&&this.roughnessMap.isTexture)n.roughnessMap=this.roughnessMap.toJSON(e).uuid;if(this.metalnessMap&&this.metalnessMap.isTexture)n.metalnessMap=this.metalnessMap.toJSON(e).uuid;if(this.emissiveMap&&this.emissiveMap.isTexture)n.emissiveMap=this.emissiveMap.toJSON(e).uuid;if(this.specularMap&&this.specularMap.isTexture)n.specularMap=this.specularMap.toJSON(e).uuid;if(this.specularIntensityMap&&this.specularIntensityMap.isTexture)n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid;if(this.specularColorMap&&this.specularColorMap.isTexture)n.specularColorMap=this.specularColorMap.toJSON(e).uuid;if(this.envMap&&this.envMap.isTexture){if(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0)n.combine=this.combine}if(this.envMapRotation!==void 0)n.envMapRotation=this.envMapRotation.toArray();if(this.envMapIntensity!==void 0)n.envMapIntensity=this.envMapIntensity;if(this.reflectivity!==void 0)n.reflectivity=this.reflectivity;if(this.refractionRatio!==void 0)n.refractionRatio=this.refractionRatio;if(this.gradientMap&&this.gradientMap.isTexture)n.gradientMap=this.gradientMap.toJSON(e).uuid;if(this.transmission!==void 0)n.transmission=this.transmission;if(this.transmissionMap&&this.transmissionMap.isTexture)n.transmissionMap=this.transmissionMap.toJSON(e).uuid;if(this.thickness!==void 0)n.thickness=this.thickness;if(this.thicknessMap&&this.thicknessMap.isTexture)n.thicknessMap=this.thicknessMap.toJSON(e).uuid;if(this.attenuationDistance!==void 0)n.attenuationDistance=this.attenuationDistance;if(this.attenuationColor!==void 0)n.attenuationColor=this.attenuationColor.getHex();if(this.size!==void 0)n.size=this.size;if(this.sizeAttenuation!==void 0)n.sizeAttenuation=this.sizeAttenuation;if(Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0)n.clippingPlanes=this.clippingPlanes.map((r)=>r.toJSON());if(this.rotation!==void 0)n.rotation=this.rotation;if(this.depthPacking!==void 0)n.depthPacking=this.depthPacking;if(this.linewidth!==void 0)n.linewidth=this.linewidth;if(this.linecap!==void 0)n.linecap=this.linecap;if(this.linejoin!==void 0)n.linejoin=this.linejoin;if(this.dashSize!==void 0)n.dashSize=this.dashSize;if(this.gapSize!==void 0)n.gapSize=this.gapSize;if(this.scale!==void 0)n.scale=this.scale;if(this.wireframe!==void 0)n.wireframe=this.wireframe;if(this.wireframeLinewidth!==void 0)n.wireframeLinewidth=this.wireframeLinewidth;if(this.wireframeLinecap!==void 0)n.wireframeLinecap=this.wireframeLinecap;if(this.wireframeLinejoin!==void 0)n.wireframeLinejoin=this.wireframeLinejoin;if(this.flatShading!==void 0)n.flatShading=this.flatShading;if(this.fog!==void 0)n.fog=this.fog;if(Object.keys(this.userData).length>0)n.userData=this.userData;function i(r){let s=[];for(let o in r){let a=r[o];delete a.metadata,s.push(a)}return s}if(t){let r=i(e.textures),s=i(e.images);if(r.length>0)n.textures=r;if(s.length>0)n.images=s}return n}fromJSON(e,t){if(e.uuid!==void 0)this.uuid=e.uuid;if(e.name!==void 0)this.name=e.name;if(e.color!==void 0&&this.color!==void 0)this.color.setHex(e.color);if(e.roughness!==void 0)this.roughness=e.roughness;if(e.metalness!==void 0)this.metalness=e.metalness;if(e.sheen!==void 0)this.sheen=e.sheen;if(e.sheenColor!==void 0)this.sheenColor=new Fe().setHex(e.sheenColor);if(e.sheenRoughness!==void 0)this.sheenRoughness=e.sheenRoughness;if(e.emissive!==void 0&&this.emissive!==void 0)this.emissive.setHex(e.emissive);if(e.specular!==void 0&&this.specular!==void 0)this.specular.setHex(e.specular);if(e.specularIntensity!==void 0)this.specularIntensity=e.specularIntensity;if(e.specularColor!==void 0&&this.specularColor!==void 0)this.specularColor.setHex(e.specularColor);if(e.shininess!==void 0)this.shininess=e.shininess;if(e.clearcoat!==void 0)this.clearcoat=e.clearcoat;if(e.clearcoatRoughness!==void 0)this.clearcoatRoughness=e.clearcoatRoughness;if(e.dispersion!==void 0)this.dispersion=e.dispersion;if(e.retroreflectivity!==void 0)this.retroreflectivity=e.retroreflectivity;if(e.iridescence!==void 0)this.iridescence=e.iridescence;if(e.iridescenceIOR!==void 0)this.iridescenceIOR=e.iridescenceIOR;if(e.iridescenceThicknessRange!==void 0)this.iridescenceThicknessRange=e.iridescenceThicknessRange;if(e.transmission!==void 0)this.transmission=e.transmission;if(e.thickness!==void 0)this.thickness=e.thickness;if(e.attenuationDistance!==void 0)this.attenuationDistance=e.attenuationDistance;if(e.attenuationColor!==void 0&&this.attenuationColor!==void 0)this.attenuationColor.setHex(e.attenuationColor);if(e.anisotropy!==void 0)this.anisotropy=e.anisotropy;if(e.anisotropyRotation!==void 0)this.anisotropyRotation=e.anisotropyRotation;if(e.fog!==void 0)this.fog=e.fog;if(e.flatShading!==void 0)this.flatShading=e.flatShading;if(e.blending!==void 0)this.blending=e.blending;if(e.combine!==void 0)this.combine=e.combine;if(e.side!==void 0)this.side=e.side;if(e.shadowSide!==void 0)this.shadowSide=e.shadowSide;if(e.opacity!==void 0)this.opacity=e.opacity;if(e.transparent!==void 0)this.transparent=e.transparent;if(e.alphaTest!==void 0)this.alphaTest=e.alphaTest;if(e.alphaHash!==void 0)this.alphaHash=e.alphaHash;if(e.depthFunc!==void 0)this.depthFunc=e.depthFunc;if(e.depthTest!==void 0)this.depthTest=e.depthTest;if(e.depthWrite!==void 0)this.depthWrite=e.depthWrite;if(e.colorWrite!==void 0)this.colorWrite=e.colorWrite;if(e.clippingPlanes!==void 0)this.clippingPlanes=e.clippingPlanes.map((n)=>new sn().fromJSON(n));if(e.clipIntersection!==void 0)this.clipIntersection=e.clipIntersection;if(e.clipShadows!==void 0)this.clipShadows=e.clipShadows;if(e.depthPacking!==void 0)this.depthPacking=e.depthPacking;if(e.blendSrc!==void 0)this.blendSrc=e.blendSrc;if(e.blendDst!==void 0)this.blendDst=e.blendDst;if(e.blendEquation!==void 0)this.blendEquation=e.blendEquation;if(e.blendSrcAlpha!==void 0)this.blendSrcAlpha=e.blendSrcAlpha;if(e.blendDstAlpha!==void 0)this.blendDstAlpha=e.blendDstAlpha;if(e.blendEquationAlpha!==void 0)this.blendEquationAlpha=e.blendEquationAlpha;if(e.blendColor!==void 0&&this.blendColor!==void 0)this.blendColor.setHex(e.blendColor);if(e.blendAlpha!==void 0)this.blendAlpha=e.blendAlpha;if(e.stencilWriteMask!==void 0)this.stencilWriteMask=e.stencilWriteMask;if(e.stencilFunc!==void 0)this.stencilFunc=e.stencilFunc;if(e.stencilRef!==void 0)this.stencilRef=e.stencilRef;if(e.stencilFuncMask!==void 0)this.stencilFuncMask=e.stencilFuncMask;if(e.stencilFail!==void 0)this.stencilFail=e.stencilFail;if(e.stencilZFail!==void 0)this.stencilZFail=e.stencilZFail;if(e.stencilZPass!==void 0)this.stencilZPass=e.stencilZPass;if(e.stencilWrite!==void 0)this.stencilWrite=e.stencilWrite;if(e.wireframe!==void 0)this.wireframe=e.wireframe;if(e.wireframeLinewidth!==void 0)this.wireframeLinewidth=e.wireframeLinewidth;if(e.wireframeLinecap!==void 0)this.wireframeLinecap=e.wireframeLinecap;if(e.wireframeLinejoin!==void 0)this.wireframeLinejoin=e.wireframeLinejoin;if(e.rotation!==void 0)this.rotation=e.rotation;if(e.linewidth!==void 0)this.linewidth=e.linewidth;if(e.linecap!==void 0)this.linecap=e.linecap;if(e.linejoin!==void 0)this.linejoin=e.linejoin;if(e.dashSize!==void 0)this.dashSize=e.dashSize;if(e.gapSize!==void 0)this.gapSize=e.gapSize;if(e.scale!==void 0)this.scale=e.scale;if(e.polygonOffset!==void 0)this.polygonOffset=e.polygonOffset;if(e.polygonOffsetFactor!==void 0)this.polygonOffsetFactor=e.polygonOffsetFactor;if(e.polygonOffsetUnits!==void 0)this.polygonOffsetUnits=e.polygonOffsetUnits;if(e.dithering!==void 0)this.dithering=e.dithering;if(e.alphaToCoverage!==void 0)this.alphaToCoverage=e.alphaToCoverage;if(e.premultipliedAlpha!==void 0)this.premultipliedAlpha=e.premultipliedAlpha;if(e.forceSinglePass!==void 0)this.forceSinglePass=e.forceSinglePass;if(e.allowOverride!==void 0)this.allowOverride=e.allowOverride;if(e.visible!==void 0)this.visible=e.visible;if(e.toneMapped!==void 0)this.toneMapped=e.toneMapped;if(e.userData!==void 0)this.userData=e.userData;if(e.vertexColors!==void 0)if(typeof e.vertexColors==="number")this.vertexColors=e.vertexColors>0;else this.vertexColors=e.vertexColors;if(e.size!==void 0)this.size=e.size;if(e.sizeAttenuation!==void 0)this.sizeAttenuation=e.sizeAttenuation;if(e.map!==void 0)this.map=t[e.map]||null;if(e.matcap!==void 0)this.matcap=t[e.matcap]||null;if(e.alphaMap!==void 0)this.alphaMap=t[e.alphaMap]||null;if(e.bumpMap!==void 0)this.bumpMap=t[e.bumpMap]||null;if(e.bumpScale!==void 0)this.bumpScale=e.bumpScale;if(e.normalMap!==void 0)this.normalMap=t[e.normalMap]||null;if(e.normalMapType!==void 0)this.normalMapType=e.normalMapType;if(e.normalScale!==void 0){let n=e.normalScale;if(Array.isArray(n)===!1)n=[n,n];this.normalScale=new re().fromArray(n)}if(e.displacementMap!==void 0)this.displacementMap=t[e.displacementMap]||null;if(e.displacementScale!==void 0)this.displacementScale=e.displacementScale;if(e.displacementBias!==void 0)this.displacementBias=e.displacementBias;if(e.roughnessMap!==void 0)this.roughnessMap=t[e.roughnessMap]||null;if(e.metalnessMap!==void 0)this.metalnessMap=t[e.metalnessMap]||null;if(e.emissiveMap!==void 0)this.emissiveMap=t[e.emissiveMap]||null;if(e.emissiveIntensity!==void 0)this.emissiveIntensity=e.emissiveIntensity;if(e.specularMap!==void 0)this.specularMap=t[e.specularMap]||null;if(e.specularIntensityMap!==void 0)this.specularIntensityMap=t[e.specularIntensityMap]||null;if(e.specularColorMap!==void 0)this.specularColorMap=t[e.specularColorMap]||null;if(e.envMap!==void 0)this.envMap=t[e.envMap]||null;if(e.envMapRotation!==void 0)this.envMapRotation.fromArray(e.envMapRotation);if(e.envMapIntensity!==void 0)this.envMapIntensity=e.envMapIntensity;if(e.reflectivity!==void 0)this.reflectivity=e.reflectivity;if(e.refractionRatio!==void 0)this.refractionRatio=e.refractionRatio;if(e.lightMap!==void 0)this.lightMap=t[e.lightMap]||null;if(e.lightMapIntensity!==void 0)this.lightMapIntensity=e.lightMapIntensity;if(e.aoMap!==void 0)this.aoMap=t[e.aoMap]||null;if(e.aoMapIntensity!==void 0)this.aoMapIntensity=e.aoMapIntensity;if(e.gradientMap!==void 0)this.gradientMap=t[e.gradientMap]||null;if(e.clearcoatMap!==void 0)this.clearcoatMap=t[e.clearcoatMap]||null;if(e.clearcoatRoughnessMap!==void 0)this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null;if(e.clearcoatNormalMap!==void 0)this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null;if(e.clearcoatNormalScale!==void 0)this.clearcoatNormalScale=new re().fromArray(e.clearcoatNormalScale);if(e.iridescenceMap!==void 0)this.iridescenceMap=t[e.iridescenceMap]||null;if(e.iridescenceThicknessMap!==void 0)this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null;if(e.transmissionMap!==void 0)this.transmissionMap=t[e.transmissionMap]||null;if(e.thicknessMap!==void 0)this.thicknessMap=t[e.thicknessMap]||null;if(e.anisotropyMap!==void 0)this.anisotropyMap=t[e.anisotropyMap]||null;if(e.sheenColorMap!==void 0)this.sheenColorMap=t[e.sheenColorMap]||null;if(e.sheenRoughnessMap!==void 0)this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null;return this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let i=t.length;n=Array(i);for(let r=0;r!==i;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){if(e===!0)this.version++}}class Ds extends ri{constructor(e){super();this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Fe(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}var vr,as=new L,yr=new L,xr=new L,br=new re,ls=new re,Sm=new Ke,Lo=new L,cs=new L,Do=new L,np=new re,$l=new re,ip=new re;class ma extends Rt{constructor(e=new Ds){super();if(this.isSprite=!0,this.type="Sprite",vr===void 0){vr=new It;let t=new Float32Array([-0.5,-0.5,0,0,0,0.5,-0.5,0,1,0,0.5,0.5,0,1,1,-0.5,0.5,0,0,1]),n=new eh(t,5);vr.setIndex([0,1,2,0,2,3]),vr.setAttribute("position",new gs(n,3,0,!1)),vr.setAttribute("uv",new gs(n,2,3,!1))}this.geometry=vr,this.material=e,this.center=new re(0.5,0.5),this.count=1}intersectsFrustum(e){return e.intersectsSprite(this)}raycast(e,t){if(e.camera===null)De('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.');if(yr.setFromMatrixScale(this.matrixWorld),Sm.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),xr.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1)yr.multiplyScalar(-xr.z);let n=this.material.rotation,i,r;if(n!==0)r=Math.cos(n),i=Math.sin(n);let s=this.center;No(Lo.set(-0.5,-0.5,0),xr,s,yr,i,r),No(cs.set(0.5,-0.5,0),xr,s,yr,i,r),No(Do.set(0.5,0.5,0),xr,s,yr,i,r),np.set(0,0),$l.set(1,0),ip.set(1,1);let o=e.ray.intersectTriangle(Lo,cs,Do,!1,as);if(o===null){if(No(cs.set(-0.5,0.5,0),xr,s,yr,i,r),$l.set(0,1),o=e.ray.intersectTriangle(Lo,Do,cs,!1,as),o===null)return}let a=e.ray.origin.distanceTo(as);if(a<e.near||a>e.far)return;t.push({distance:a,point:as.clone(),uv:dn.getInterpolation(as,Lo,cs,Do,np,$l,ip,new re),face:null,object:this})}copy(e,t){if(super.copy(e,t),e.center!==void 0)this.center.copy(e.center);return this.material=e.material,this}}function No(e,t,n,i,r,s){if(br.subVectors(e,n).addScalar(0.5).multiply(i),r!==void 0)ls.x=s*br.x-r*br.y,ls.y=r*br.x+s*br.y;else ls.copy(br);e.copy(t),e.x+=ls.x,e.y+=ls.y,e.applyMatrix4(Sm)}var Kn=new L,Zl=new L,Oo=new L,Uo=new L;class Xi{constructor(e=new L,t=new L(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Kn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);if(n<0)return t.copy(this.origin);return t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Kn.subVectors(e,this.origin).dot(this.direction);if(t<0)return this.origin.distanceToSquared(e);return Kn.copy(this.origin).addScaledVector(this.direction,t),Kn.distanceToSquared(e)}distanceSqToSegment(e,t,n,i){Zl.copy(e).add(t).multiplyScalar(0.5),Oo.copy(t).sub(e).normalize(),Uo.copy(this.origin).sub(Zl);let r=e.distanceTo(t)*0.5,s=-this.direction.dot(Oo),o=Uo.dot(this.direction),a=-Uo.dot(Oo),l=Uo.lengthSq(),c=Math.abs(1-s*s),h,f,u,p;if(c>0)if(h=s*a-o,f=s*o-a,p=r*c,h>=0)if(f>=-p)if(f<=p){let g=1/c;h*=g,f*=g,u=h*(h+s*f+2*o)+f*(s*h+f+2*a)+l}else f=r,h=Math.max(0,-(s*f+o)),u=-h*h+f*(f+2*a)+l;else f=-r,h=Math.max(0,-(s*f+o)),u=-h*h+f*(f+2*a)+l;else if(f<=-p)h=Math.max(0,-(-s*r+o)),f=h>0?-r:Math.min(Math.max(-r,-a),r),u=-h*h+f*(f+2*a)+l;else if(f<=p)h=0,f=Math.min(Math.max(-r,-a),r),u=f*(f+2*a)+l;else h=Math.max(0,-(s*r+o)),f=h>0?r:Math.min(Math.max(-r,-a),r),u=-h*h+f*(f+2*a)+l;else f=s>0?-r:r,h=Math.max(0,-(s*f+o)),u=-h*h+f*(f+2*a)+l;if(n)n.copy(this.origin).addScaledVector(this.direction,h);if(i)i.copy(Zl).addScaledVector(Oo,f);return u}intersectSphere(e,t){if(e.radius<0)return null;Kn.subVectors(e.center,this.origin);let n=Kn.dot(this.direction),i=Kn.dot(Kn)-n*n,r=e.radius*e.radius;if(i>r)return null;let s=Math.sqrt(r-i),o=n-s,a=n+s;if(a<0)return null;if(o<0)return this.at(a,t);return this.at(o,t)}intersectsSphere(e){if(e.radius<0)return!1;return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0){if(e.distanceToPoint(this.origin)===0)return 0;return null}let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);if(n===null)return null;return this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);if(t===0)return!0;if(e.normal.dot(this.direction)*t<0)return!0;return!1}intersectBox(e,t){let n,i,r,s,o,a,l=1/this.direction.x,c=1/this.direction.y,h=1/this.direction.z,f=this.origin;if(l>=0)n=(e.min.x-f.x)*l,i=(e.max.x-f.x)*l;else n=(e.max.x-f.x)*l,i=(e.min.x-f.x)*l;if(c>=0)r=(e.min.y-f.y)*c,s=(e.max.y-f.y)*c;else r=(e.max.y-f.y)*c,s=(e.min.y-f.y)*c;if(n>s||r>i)return null;if(r>n||isNaN(n))n=r;if(s<i||isNaN(i))i=s;if(h>=0)o=(e.min.z-f.z)*h,a=(e.max.z-f.z)*h;else o=(e.max.z-f.z)*h,a=(e.min.z-f.z)*h;if(n>a||o>i)return null;if(o>n||n!==n)n=o;if(a<i||i!==i)i=a;if(i<0)return null;return this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,Kn)!==null}intersectTriangle(e,t,n,i,r){let s=this.origin,o=this.direction,{x:a,y:l,z:c}=o,h=e.x-s.x,f=e.y-s.y,u=e.z-s.z,p=t.x-s.x,g=t.y-s.y,y=t.z-s.z,m=n.x-s.x,d=n.y-s.y,b=n.z-s.z,S=Math.abs(a),_=Math.abs(l),x=Math.abs(c),w,E,v,A,N,P,D,W,R,I,k,z;if(S>=_&&S>=x)if(v=a,P=h,R=p,z=m,a>=0)w=l,E=c,A=f,N=u,D=g,W=y,I=d,k=b;else w=c,E=l,A=u,N=f,D=y,W=g,I=b,k=d;else if(_>=x)if(v=l,P=f,R=g,z=d,l>=0)w=c,E=a,A=u,N=h,D=y,W=p,I=b,k=m;else w=a,E=c,A=h,N=u,D=p,W=y,I=m,k=b;else if(v=c,P=u,R=y,z=b,c>=0)w=a,E=l,A=h,N=f,D=p,W=g,I=m,k=d;else w=l,E=a,A=f,N=h,D=g,W=p,I=d,k=m;if(v===0)return null;let te=w/v,Y=E/v,Q=1/v,G=A-te*P,ee=N-Y*P,oe=D-te*R,Ue=W-Y*R,Re=I-te*z,X=k-Y*z,se=Re*Ue-X*oe,le=G*X-ee*Re,Pe=oe*ee-Ue*G;if(i){if(se<0||le<0||Pe<0)return null}else if((se<0||le<0||Pe<0)&&(se>0||le>0||Pe>0))return null;let Oe=se+le+Pe;if(Oe===0)return null;let Ae=Q*(se*P+le*R+Pe*z);if(Oe>0?Ae<0:Ae>0)return null;return this.at(Ae/Oe,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class xi extends ri{constructor(e){super();this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Fe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ni,this.combine=0,this.reflectivity=1,this.refractionRatio=0.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}var rp=new Ke,Ui=new Xi,Fo=new Fr,sp=new L,Bo=new L,ko=new L,zo=new L,Jl=new L,Go=new L,op=new L,Ho=new L;class zt extends Rt{constructor(e=new It,t=new xi){super();this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){if(super.copy(e,t),e.morphTargetInfluences!==void 0)this.morphTargetInfluences=e.morphTargetInfluences.slice();if(e.morphTargetDictionary!==void 0)this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary);return this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){let o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){let n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,s=n.morphTargetsRelative;t.fromBufferAttribute(i,e);let o=this.morphTargetInfluences;if(r&&o){Go.set(0,0,0);for(let a=0,l=r.length;a<l;a++){let c=o[a],h=r[a];if(c===0)continue;if(Jl.fromBufferAttribute(h,e),s)Go.addScaledVector(Jl,c);else Go.addScaledVector(Jl.sub(t),c)}t.add(Go)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.material,r=this.matrixWorld;if(i===void 0)return;if(n.boundingSphere===null)n.computeBoundingSphere();if(Fo.copy(n.boundingSphere),Fo.applyMatrix4(r),Ui.copy(e.ray).recast(e.near),Fo.containsPoint(Ui.origin)===!1){if(Ui.intersectSphere(Fo,sp)===null)return;if(Ui.origin.distanceToSquared(sp)>(e.far-e.near)**2)return}if(rp.copy(r).invert(),Ui.copy(e.ray).applyMatrix4(rp),n.boundingBox!==null){if(Ui.intersectsBox(n.boundingBox)===!1)return}this._computeIntersections(e,t,Ui)}_computeIntersections(e,t,n){let i,r=this.geometry,s=this.material,o=r.index,a=r.attributes.position,l=r.attributes.uv,c=r.attributes.uv1,h=r.attributes.normal,{groups:f,drawRange:u}=r;if(o!==null)if(Array.isArray(s))for(let p=0,g=f.length;p<g;p++){let y=f[p],m=s[y.materialIndex],d=Math.max(y.start,u.start),b=Math.min(o.count,Math.min(y.start+y.count,u.start+u.count));for(let S=d,_=b;S<_;S+=3){let x=o.getX(S),w=o.getX(S+1),E=o.getX(S+2);if(i=Vo(this,m,e,n,l,c,h,x,w,E),i)i.faceIndex=Math.floor(S/3),i.face.materialIndex=y.materialIndex,t.push(i)}}else{let p=Math.max(0,u.start),g=Math.min(o.count,u.start+u.count);for(let y=p,m=g;y<m;y+=3){let d=o.getX(y),b=o.getX(y+1),S=o.getX(y+2);if(i=Vo(this,s,e,n,l,c,h,d,b,S),i)i.faceIndex=Math.floor(y/3),t.push(i)}}else if(a!==void 0)if(Array.isArray(s))for(let p=0,g=f.length;p<g;p++){let y=f[p],m=s[y.materialIndex],d=Math.max(y.start,u.start),b=Math.min(a.count,Math.min(y.start+y.count,u.start+u.count));for(let S=d,_=b;S<_;S+=3){let x=S,w=S+1,E=S+2;if(i=Vo(this,m,e,n,l,c,h,x,w,E),i)i.faceIndex=Math.floor(S/3),i.face.materialIndex=y.materialIndex,t.push(i)}}else{let p=Math.max(0,u.start),g=Math.min(a.count,u.start+u.count);for(let y=p,m=g;y<m;y+=3){let d=y,b=y+1,S=y+2;if(i=Vo(this,s,e,n,l,c,h,d,b,S),i)i.faceIndex=Math.floor(y/3),t.push(i)}}}}function Wv(e,t,n,i,r,s,o,a){let l;if(t.side===1)l=i.intersectTriangle(o,s,r,!0,a);else l=i.intersectTriangle(r,s,o,t.side===0,a);if(l===null)return null;Ho.copy(a),Ho.applyMatrix4(e.matrixWorld);let c=n.ray.origin.distanceTo(Ho);if(c<n.near||c>n.far)return null;return{distance:c,point:Ho.clone(),object:e}}function Vo(e,t,n,i,r,s,o,a,l,c){e.getVertexPosition(a,Bo),e.getVertexPosition(l,ko),e.getVertexPosition(c,zo);let h=Wv(e,t,n,i,Bo,ko,zo,op);if(h){let f=new L;if(dn.getBarycoord(op,Bo,ko,zo,f),r)h.uv=dn.getInterpolatedAttribute(r,a,l,c,f,new re);if(s)h.uv1=dn.getInterpolatedAttribute(s,a,l,c,f,new re);if(o){if(h.normal=dn.getInterpolatedAttribute(o,a,l,c,f,new L),h.normal.dot(i.direction)>0)h.normal.multiplyScalar(-1)}let u={a,b:l,c,normal:new L,materialIndex:0};dn.getNormal(Bo,ko,zo,u.normal),h.face=u,h.barycoord=f}return h}class th extends Ft{constructor(e=null,t=1,n=1,i,r,s,o,a,l=1003,c=1003,h,f){super(null,s,o,a,l,c,i,r,h,f);this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}var Fi=new Fr,Xv=new re(0.5,0.5),Wo=new L;class Ns{constructor(e=new sn,t=new sn,n=new sn,i=new sn,r=new sn,s=new sn){this.planes=[e,t,n,i,r,s]}set(e,t,n,i,r,s){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(i),o[4].copy(r),o[5].copy(s),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=2000,n=!1){let i=this.planes,r=e.elements,s=r[0],o=r[1],a=r[2],l=r[3],c=r[4],h=r[5],f=r[6],u=r[7],p=r[8],g=r[9],y=r[10],m=r[11],d=r[12],b=r[13],S=r[14],_=r[15];if(i[0].setComponents(l-s,u-c,m-p,_-d).normalize(),i[1].setComponents(l+s,u+c,m+p,_+d).normalize(),i[2].setComponents(l+o,u+h,m+g,_+b).normalize(),i[3].setComponents(l-o,u-h,m-g,_-b).normalize(),n)i[4].setComponents(a,f,y,S).normalize(),i[5].setComponents(l-a,u-f,m-y,_-S).normalize();else if(i[4].setComponents(l-a,u-f,m-y,_-S).normalize(),t===2000)i[5].setComponents(l+a,u+f,m+y,_+S).normalize();else if(t===2001)i[5].setComponents(a,f,y,S).normalize();else throw Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0){if(e.boundingSphere===null)e.computeBoundingSphere();Fi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld)}else{let t=e.geometry;if(t.boundingSphere===null)t.computeBoundingSphere();Fi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Fi)}intersectsSprite(e){Fi.center.set(0,0,0);let t=Xv.distanceTo(e.center);return Fi.radius=0.7071067811865476+t,Fi.applyMatrix4(e.matrixWorld),this.intersectsSphere(Fi)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(Wo.x=i.normal.x>0?e.max.x:e.min.x,Wo.y=i.normal.y>0?e.max.y:e.min.y,Wo.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(Wo)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Os extends ri{constructor(e){super();this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Fe(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}var Zo=new L,Jo=new L,ap=new Ke,hs=new Xi,Xo=new Fr,Kl=new L,lp=new L;class ga extends Rt{constructor(e=new It,t=new Os){super();this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,r=t.count;i<r;i++)Zo.fromBufferAttribute(t,i-1),Jo.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=Zo.distanceTo(Jo);e.setAttribute("lineDistance",new mt(n,1))}else Ie("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Line.threshold,s=n.drawRange;if(n.boundingSphere===null)n.computeBoundingSphere();if(Xo.copy(n.boundingSphere),Xo.applyMatrix4(i),Xo.radius+=r,e.ray.intersectsSphere(Xo)===!1)return;ap.copy(i).invert(),hs.copy(e.ray).applyMatrix4(ap);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),a=o*o,l=this.isLineSegments?2:1,c=n.index,f=n.attributes.position;if(c!==null){let u=Math.max(0,s.start),p=Math.min(c.count,s.start+s.count);for(let g=u,y=p-1;g<y;g+=l){let m=c.getX(g),d=c.getX(g+1),b=qo(this,e,hs,a,m,d,g);if(b)t.push(b)}if(this.isLineLoop){let g=c.getX(p-1),y=c.getX(u),m=qo(this,e,hs,a,g,y,p-1);if(m)t.push(m)}}else{let u=Math.max(0,s.start),p=Math.min(f.count,s.start+s.count);for(let g=u,y=p-1;g<y;g+=l){let m=qo(this,e,hs,a,g,g+1,g);if(m)t.push(m)}if(this.isLineLoop){let g=qo(this,e,hs,a,p-1,u,p-1);if(g)t.push(g)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){let o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function qo(e,t,n,i,r,s,o){let a=e.geometry.attributes.position;if(Zo.fromBufferAttribute(a,r),Jo.fromBufferAttribute(a,s),n.distanceSqToSegment(Zo,Jo,Kl,lp)>i)return;Kl.applyMatrix4(e.matrixWorld);let c=t.ray.origin.distanceTo(Kl);if(c<t.near||c>t.far)return;return{distance:c,point:lp.clone().applyMatrix4(e.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:e}}class _a extends Ft{constructor(e=[],t=301,n,i,r,s,o,a,l,c){super(e,t,n,i,r,s,o,a,l,c);this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class va extends Ft{constructor(e,t,n,i,r,s,o,a,l){super(e,t,n,i,r,s,o,a,l);this.isCanvasTexture=!0,this.needsUpdate=!0}}class qi extends Ft{constructor(e,t,n=1014,i,r,s,o=1003,a=1003,l,c=1026,h=1){if(c!==1026&&c!==1027)throw Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let f={width:e,height:t,depth:h};super(f,i,r,s,o,a,c,n,l);this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Ps(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}}class nh extends qi{constructor(e,t=1014,n=301,i,r,s=1003,o=1003,a,l=1026){let c={width:e,height:e,depth:1},h=[c,c,c,c,c,c];super(e,e,t,n,i,r,s,o,a,l);this.image=h,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class ya extends Ft{constructor(e=null){super();this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Br extends It{constructor(e=1,t=1,n=1,i=1,r=1,s=1){super();this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:r,depthSegments:s};let o=this;i=Math.floor(i),r=Math.floor(r),s=Math.floor(s);let a=[],l=[],c=[],h=[],f=0,u=0;p("z","y","x",-1,-1,n,t,e,s,r,0),p("z","y","x",1,-1,n,t,-e,s,r,1),p("x","z","y",1,1,e,n,t,i,s,2),p("x","z","y",1,-1,e,n,-t,i,s,3),p("x","y","z",1,-1,e,t,n,i,r,4),p("x","y","z",-1,-1,e,t,-n,i,r,5),this.setIndex(a),this.setAttribute("position",new mt(l,3)),this.setAttribute("normal",new mt(c,3)),this.setAttribute("uv",new mt(h,2));function p(g,y,m,d,b,S,_,x,w,E,v){let A=S/w,N=_/E,P=S/2,D=_/2,W=x/2,R=w+1,I=E+1,k=0,z=0,te=new L;for(let Y=0;Y<I;Y++){let Q=Y*N-D;for(let G=0;G<R;G++){let ee=G*A-P;te[g]=ee*d,te[y]=Q*b,te[m]=W,l.push(te.x,te.y,te.z),te[g]=0,te[y]=0,te[m]=x>0?1:-1,c.push(te.x,te.y,te.z),h.push(G/w),h.push(1-Y/E),k+=1}}for(let Y=0;Y<E;Y++)for(let Q=0;Q<w;Q++){let G=f+Q+R*Y,ee=f+Q+R*(Y+1),oe=f+(Q+1)+R*(Y+1),Ue=f+(Q+1)+R*Y;a.push(G,ee,Ue),a.push(ee,oe,Ue),z+=6}o.addGroup(u,z,v),u+=z,f+=k}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Br(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class kr extends It{constructor(e=1,t=1,n=1,i=32,r=1,s=!1,o=0,a=Math.PI*2){super();this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:r,openEnded:s,thetaStart:o,thetaLength:a};let l=this;i=Math.floor(i),r=Math.floor(r);let c=[],h=[],f=[],u=[],p=0,g=[],y=n/2,m=0;if(d(),s===!1){if(e>0)b(!0);if(t>0)b(!1)}this.setIndex(c),this.setAttribute("position",new mt(h,3)),this.setAttribute("normal",new mt(f,3)),this.setAttribute("uv",new mt(u,2));function d(){let S=new L,_=new L,x=0,w=(t-e)/n;for(let E=0;E<=r;E++){let v=[],A=E/r,N=A*(t-e)+e;for(let P=0;P<=i;P++){let D=P/i,W=D*a+o,R=Math.sin(W),I=Math.cos(W);_.x=N*R,_.y=-A*n+y,_.z=N*I,h.push(_.x,_.y,_.z),S.set(R,w,I).normalize(),f.push(S.x,S.y,S.z),u.push(D,1-A),v.push(p++)}g.push(v)}for(let E=0;E<i;E++)for(let v=0;v<r;v++){let A=g[v][E],N=g[v+1][E],P=g[v+1][E+1],D=g[v][E+1];if(e>0||v!==0)c.push(A,N,D),x+=3;if(t>0||v!==r-1)c.push(N,P,D),x+=3}l.addGroup(m,x,0),m+=x}function b(S){let _=p,x=new re,w=new L,E=0,v=S===!0?e:t,A=S===!0?1:-1;for(let P=1;P<=i;P++)h.push(0,y*A,0),f.push(0,A,0),u.push(0.5,0.5),p++;let N=p;for(let P=0;P<=i;P++){let W=P/i*a+o,R=Math.cos(W),I=Math.sin(W);w.x=v*I,w.y=y*A,w.z=v*R,h.push(w.x,w.y,w.z),f.push(0,A,0),x.x=R*0.5+0.5,x.y=I*0.5*A+0.5,u.push(x.x,x.y),p++}for(let P=0;P<i;P++){let D=_+P,W=N+P;if(S===!0)c.push(W,W+1,D);else c.push(W+1,W,D);E+=3}l.addGroup(m,E,S===!0?1:2),m+=E}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new kr(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Us extends kr{constructor(e=1,t=1,n=32,i=1,r=!1,s=0,o=Math.PI*2){super(0,e,t,n,i,r,s,o);this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:s,thetaLength:o}}static fromJSON(e){return new Us(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Ln{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Ie("Curve: .getPoint() not implemented.")}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,i=this.getPoint(0),r=0;t.push(0);for(let s=1;s<=e;s++)n=this.getPoint(s/e),r+=n.distanceTo(i),t.push(r),i=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),i=0,r=n.length,s;if(t)s=t;else s=e*n[r-1];let o=0,a=r-1,l;while(o<=a)if(i=Math.floor(o+(a-o)/2),l=n[i]-s,l<0)o=i+1;else if(l>0)a=i-1;else{a=i;break}if(i=a,n[i]===s)return i/(r-1);let c=n[i],f=n[i+1]-c,u=(s-c)/f;return(i+u)/(r-1)}getTangent(e,t){let i=e-0.0001,r=e+0.0001;if(i<0)i=0;if(r>1)r=1;let s=this.getPoint(i),o=this.getPoint(r),a=t||(s.isVector2?new re:new L);return a.copy(o).sub(s).normalize(),a}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new L,i=[],r=[],s=[],o=new L,a=new Ke;for(let u=0;u<=e;u++){let p=u/e;i[u]=this.getTangentAt(p,new L)}r[0]=new L,s[0]=new L;let l=Number.MAX_VALUE,c=Math.abs(i[0].x),h=Math.abs(i[0].y),f=Math.abs(i[0].z);if(c<=l)l=c,n.set(1,0,0);if(h<=l)l=h,n.set(0,1,0);if(f<=l)n.set(0,0,1);o.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],o),s[0].crossVectors(i[0],r[0]);for(let u=1;u<=e;u++){if(r[u]=r[u-1].clone(),s[u]=s[u-1].clone(),o.crossVectors(i[u-1],i[u]),o.length()>Number.EPSILON){o.normalize();let p=Math.acos(He(i[u-1].dot(i[u]),-1,1));r[u].applyMatrix4(a.makeRotationAxis(o,p))}s[u].crossVectors(i[u],r[u])}if(t===!0){let u=Math.acos(He(r[0].dot(r[e]),-1,1));if(u/=e,i[0].dot(o.crossVectors(r[0],r[e]))>0)u=-u;for(let p=1;p<=e;p++)r[p].applyMatrix4(a.makeRotationAxis(i[p],u*p)),s[p].crossVectors(i[p],r[p])}return{tangents:i,normals:r,binormals:s}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}}class xa extends Ln{constructor(e=0,t=0,n=1,i=1,r=0,s=Math.PI*2,o=!1,a=0){super();this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=s,this.aClockwise=o,this.aRotation=a}getPoint(e,t=new re){let n=t,i=Math.PI*2,r=this.aEndAngle-this.aStartAngle,s=Math.abs(r)<Number.EPSILON;while(r<0)r+=i;while(r>i)r-=i;if(r<Number.EPSILON)if(s)r=0;else r=i;if(this.aClockwise===!0&&!s)if(r===i)r=-i;else r=r-i;let o=this.aStartAngle+e*r,a=this.aX+this.xRadius*Math.cos(o),l=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let c=Math.cos(this.aRotation),h=Math.sin(this.aRotation),f=a-this.aX,u=l-this.aY;a=f*c-u*h+this.aX,l=f*h+u*c+this.aY}return n.set(a,l)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}}class ih extends xa{constructor(e,t,n,i,r,s){super(e,t,n,n,i,r,s);this.isArcCurve=!0,this.type="ArcCurve"}}function rh(){let e=0,t=0,n=0,i=0;function r(s,o,a,l){e=s,t=a,n=-3*s+3*o-2*a-l,i=2*s-2*o+a+l}return{initCatmullRom:function(s,o,a,l,c){r(o,a,c*(a-s),c*(l-o))},initNonuniformCatmullRom:function(s,o,a,l,c,h,f){let u=(o-s)/c-(a-s)/(c+h)+(a-o)/h,p=(a-o)/h-(l-o)/(h+f)+(l-a)/f;u*=h,p*=h,r(o,a,u,p)},calc:function(s){let o=s*s,a=o*s;return e+t*s+n*o+i*a}}}var cp=new L,hp=new L,Ql=new rh,ec=new rh,tc=new rh;class sh extends Ln{constructor(e=[],t=!1,n="centripetal",i=0.5){super();this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=i}getPoint(e,t=new L){let n=t,i=this.points,r=i.length,s=(r-(this.closed?0:1))*e,o=Math.floor(s),a=s-o;if(this.closed)o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r;else if(a===0&&o===r-1)o=r-2,a=1;let l,c;if(this.closed||o>0)l=i[(o-1)%r];else hp.subVectors(i[0],i[1]).add(i[0]),l=hp;let h=i[o%r],f=i[(o+1)%r];if(this.closed||o+2<r)c=i[(o+2)%r];else cp.subVectors(i[r-1],i[r-2]).add(i[r-1]),c=cp;if(this.curveType==="centripetal"||this.curveType==="chordal"){let u=this.curveType==="chordal"?0.5:0.25,p=Math.pow(l.distanceToSquared(h),u),g=Math.pow(h.distanceToSquared(f),u),y=Math.pow(f.distanceToSquared(c),u);if(g<0.0001)g=1;if(p<0.0001)p=g;if(y<0.0001)y=g;Ql.initNonuniformCatmullRom(l.x,h.x,f.x,c.x,p,g,y),ec.initNonuniformCatmullRom(l.y,h.y,f.y,c.y,p,g,y),tc.initNonuniformCatmullRom(l.z,h.z,f.z,c.z,p,g,y)}else if(this.curveType==="catmullrom")Ql.initCatmullRom(l.x,h.x,f.x,c.x,this.tension),ec.initCatmullRom(l.y,h.y,f.y,c.y,this.tension),tc.initCatmullRom(l.z,h.z,f.z,c.z,this.tension);return n.set(Ql.calc(a),ec.calc(a),tc.calc(a)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new L().fromArray(i))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}}function up(e,t,n,i,r){let s=(i-t)*0.5,o=(r-n)*0.5,a=e*e,l=e*a;return(2*n-2*i+s+o)*l+(-3*n+3*i-2*s-o)*a+s*e+n}function qv(e,t){let n=1-e;return n*n*t}function jv(e,t){return 2*(1-e)*e*t}function Yv(e,t){return e*e*t}function ds(e,t,n,i){return qv(e,t)+jv(e,n)+Yv(e,i)}function $v(e,t){let n=1-e;return n*n*n*t}function Zv(e,t){let n=1-e;return 3*n*n*e*t}function Jv(e,t){return 3*(1-e)*e*e*t}function Kv(e,t){return e*e*e*t}function ps(e,t,n,i,r){return $v(e,t)+Zv(e,n)+Jv(e,i)+Kv(e,r)}class oh extends Ln{constructor(e=new re,t=new re,n=new re,i=new re){super();this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new re){let n=t,i=this.v0,r=this.v1,s=this.v2,o=this.v3;return n.set(ps(e,i.x,r.x,s.x,o.x),ps(e,i.y,r.y,s.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class Fs extends Ln{constructor(e=new L,t=new L,n=new L,i=new L){super();this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new L){let n=t,i=this.v0,r=this.v1,s=this.v2,o=this.v3;return n.set(ps(e,i.x,r.x,s.x,o.x),ps(e,i.y,r.y,s.y,o.y),ps(e,i.z,r.z,s.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class ah extends Ln{constructor(e=new re,t=new re){super();this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new re){let n=t;if(e===1)n.copy(this.v2);else n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1);return n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new re){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class lh extends Ln{constructor(e=new L,t=new L){super();this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new L){let n=t;if(e===1)n.copy(this.v2);else n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1);return n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new L){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class ch extends Ln{constructor(e=new re,t=new re,n=new re){super();this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new re){let n=t,i=this.v0,r=this.v1,s=this.v2;return n.set(ds(e,i.x,r.x,s.x),ds(e,i.y,r.y,s.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class zr extends Ln{constructor(e=new L,t=new L,n=new L){super();this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new L){let n=t,i=this.v0,r=this.v1,s=this.v2;return n.set(ds(e,i.x,r.x,s.x),ds(e,i.y,r.y,s.y),ds(e,i.z,r.z,s.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class hh extends Ln{constructor(e=[]){super();this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new re){let n=t,i=this.points,r=(i.length-1)*e,s=Math.floor(r),o=r-s,a=i[s===0?s:s-1],l=i[s],c=i[s>i.length-2?i.length-1:s+1],h=i[s>i.length-3?i.length-1:s+2];return n.set(up(o,a.x,l.x,c.x,h.x),up(o,a.y,l.y,c.y,h.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new re().fromArray(i))}return this}}var Qv=Object.freeze({__proto__:null,ArcCurve:ih,CatmullRomCurve3:sh,CubicBezierCurve:oh,CubicBezierCurve3:Fs,EllipseCurve:xa,LineCurve:ah,LineCurve3:lh,QuadraticBezierCurve:ch,QuadraticBezierCurve3:zr,SplineCurve:hh});class Bs extends It{constructor(e=1,t=1,n=1,i=1){super();this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let r=e/2,s=t/2,o=Math.floor(n),a=Math.floor(i),l=o+1,c=a+1,h=e/o,f=t/a,u=[],p=[],g=[],y=[];for(let m=0;m<c;m++){let d=m*f-s;for(let b=0;b<l;b++){let S=b*h-r;p.push(S,-d,0),g.push(0,0,1),y.push(b/o),y.push(1-m/a)}}for(let m=0;m<a;m++)for(let d=0;d<o;d++){let b=d+l*m,S=d+l*(m+1),_=d+1+l*(m+1),x=d+1+l*m;u.push(b,S,x),u.push(S,_,x)}this.setIndex(u),this.setAttribute("position",new mt(p,3)),this.setAttribute("normal",new mt(g,3)),this.setAttribute("uv",new mt(y,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Bs(e.width,e.height,e.widthSegments,e.heightSegments)}}class ji extends It{constructor(e=1,t=32,n=16,i=0,r=Math.PI*2,s=0,o=Math.PI){super();this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:i,phiLength:r,thetaStart:s,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let a=Math.min(s+o,Math.PI),l=0,c=[],h=new L,f=new L,u=[],p=[],g=[],y=[];for(let m=0;m<=n;m++){let d=[],b=m/n,S=s+b*o,_=e*Math.cos(S),x=Math.sqrt(e*e-_*_),w=0;if(m===0&&s===0)w=0.5/t;else if(m===n&&a===Math.PI)w=-0.5/t;for(let E=0;E<=t;E++){let v=E/t,A=i+v*r;h.x=-x*Math.cos(A),h.y=_,h.z=x*Math.sin(A),p.push(h.x,h.y,h.z),f.copy(h).normalize(),g.push(f.x,f.y,f.z),y.push(v+w,1-b),d.push(l++)}c.push(d)}for(let m=0;m<n;m++)for(let d=0;d<t;d++){let b=c[m][d+1],S=c[m][d],_=c[m+1][d],x=c[m+1][d+1];if(m!==0||s>0)u.push(b,S,x);if(m!==n-1||a<Math.PI)u.push(S,_,x)}this.setIndex(u),this.setAttribute("position",new mt(p,3)),this.setAttribute("normal",new mt(g,3)),this.setAttribute("uv",new mt(y,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ji(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class ks extends It{constructor(e=new zr(new L(-1,-1,0),new L(-1,1,0),new L(1,1,0)),t=64,n=1,i=8,r=!1){super();this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:i,closed:r};let s=e.computeFrenetFrames(t,r);this.tangents=s.tangents,this.normals=s.normals,this.binormals=s.binormals;let o=new L,a=new L,l=new re,c=new L,h=[],f=[],u=[],p=[];g(),this.setIndex(p),this.setAttribute("position",new mt(h,3)),this.setAttribute("normal",new mt(f,3)),this.setAttribute("uv",new mt(u,2));function g(){for(let b=0;b<t;b++)y(b);y(r===!1?t:0),d(),m()}function y(b){c=e.getPointAt(b/t,c);let S=s.normals[b],_=s.binormals[b];for(let x=0;x<=i;x++){let w=x/i*Math.PI*2,E=Math.sin(w),v=-Math.cos(w);a.x=v*S.x+E*_.x,a.y=v*S.y+E*_.y,a.z=v*S.z+E*_.z,a.normalize(),f.push(a.x,a.y,a.z),o.x=c.x+n*a.x,o.y=c.y+n*a.y,o.z=c.z+n*a.z,h.push(o.x,o.y,o.z)}}function m(){for(let b=1;b<=t;b++)for(let S=1;S<=i;S++){let _=(i+1)*(b-1)+(S-1),x=(i+1)*b+(S-1),w=(i+1)*b+S,E=(i+1)*(b-1)+S;p.push(_,x,E),p.push(x,w,E)}}function d(){for(let b=0;b<=t;b++)for(let S=0;S<=i;S++)l.x=b/t,l.y=S/i,u.push(l.x,l.y)}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new ks(new Qv[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}}function Yi(e){let t={};for(let n in e){t[n]={};for(let i in e[n]){let r=e[n][i];if(fp(r))if(r.isRenderTargetTexture)Ie("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[n][i]=null;else t[n][i]=r.clone();else if(Array.isArray(r))if(fp(r[0])){let s=[];for(let o=0,a=r.length;o<a;o++)s[o]=r[o].clone();t[n][i]=s}else t[n][i]=r.slice();else t[n][i]=r}}return t}function jt(e){let t={};for(let n=0;n<e.length;n++){let i=Yi(e[n]);for(let r in i)t[r]=i[r]}return t}function fp(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function ey(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function uh(e){let t=e.getRenderTarget();if(t===null)return e.outputColorSpace;if(t.isXRRenderTarget===!0)return t.texture.colorSpace;return We.workingColorSpace}var si={clone:Yi,merge:jt},ty=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,ny=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Tt extends ri{constructor(e){super();if(this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=ty,this.fragmentShader=ny,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0)this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Yi(e.uniforms),this.uniformsGroups=ey(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let s=this.uniforms[i].value;if(s&&s.isTexture)t.uniforms[i]={type:"t",value:s.toJSON(e).uuid};else if(s&&s.isColor)t.uniforms[i]={type:"c",value:s.getHex()};else if(s&&s.isVector2)t.uniforms[i]={type:"v2",value:s.toArray()};else if(s&&s.isVector3)t.uniforms[i]={type:"v3",value:s.toArray()};else if(s&&s.isVector4)t.uniforms[i]={type:"v4",value:s.toArray()};else if(s&&s.isMatrix3)t.uniforms[i]={type:"m3",value:s.toArray()};else if(s&&s.isMatrix4)t.uniforms[i]={type:"m4",value:s.toArray()};else t.uniforms[i]={value:s}}if(Object.keys(this.defines).length>0)t.defines=this.defines;t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let i in this.extensions)if(this.extensions[i]===!0)n[i]=!0;if(Object.keys(n).length>0)t.extensions=n;return t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let i=e.uniforms[n];switch(this.uniforms[n]={},i.type){case"t":this.uniforms[n].value=t[i.value]||null;break;case"c":this.uniforms[n].value=new Fe().setHex(i.value);break;case"v2":this.uniforms[n].value=new re().fromArray(i.value);break;case"v3":this.uniforms[n].value=new L().fromArray(i.value);break;case"v4":this.uniforms[n].value=new gt().fromArray(i.value);break;case"m3":this.uniforms[n].value=new Be().fromArray(i.value);break;case"m4":this.uniforms[n].value=new Ke().fromArray(i.value);break;default:this.uniforms[n].value=i.value}}if(e.defines!==void 0)this.defines=e.defines;if(e.vertexShader!==void 0)this.vertexShader=e.vertexShader;if(e.fragmentShader!==void 0)this.fragmentShader=e.fragmentShader;if(e.glslVersion!==void 0)this.glslVersion=e.glslVersion;if(e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];if(e.lights!==void 0)this.lights=e.lights;if(e.clipping!==void 0)this.clipping=e.clipping;return this}}class zs extends Tt{constructor(e){super(e);this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class ba extends ri{constructor(e){super();this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Fe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Fe(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new re(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ni,this.combine=0,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=0.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class fh extends ri{constructor(e){super();this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=3200,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class dh extends ri{constructor(e){super();this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}function Sr(e,t){if(!e||e.constructor===t)return e;if(typeof t.BYTES_PER_ELEMENT==="number")return new t(e);return Array.prototype.slice.call(e)}function nc(e){return e!==void 0&&e.inTangents!==void 0&&e.outTangents!==void 0}class $i{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],r=t[n-1];e:{t:{let s;n:{i:if(!(e<i)){for(let o=n+2;;){if(i===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=i,i=t[++n],e<i)break t}s=t.length;break n}if(!(e>=r)){let o=t[1];if(e<o)n=2,r=o;for(let a=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(i=r,r=t[--n-1],e>=r)break t}s=n,n=0;break n}break e}while(n<s){let o=n+s>>>1;if(e<t[o])s=o;else n=o+1}if(i=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,i)}return this.interpolate_(n,r,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i;for(let s=0;s!==i;++s)t[s]=n[r+s];return t}interpolate_(){throw Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}}class ph extends $i{constructor(e,t,n,i){super(e,t,n,i);this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:2400,endingEnd:2400}}intervalChanged_(e,t,n){let i=this.parameterPositions,r=e-2,s=e+1,o=i[r],a=i[s];if(o===void 0)switch(this.getSettings_().endingStart){case 2401:r=e,o=2*t-n;break;case 2402:r=i.length-2,o=t+i[r]-i[r+1];break;default:r=e,o=n}if(a===void 0)switch(this.getSettings_().endingEnd){case 2401:s=e,a=2*n-t;break;case 2402:s=1,a=n+i[1]-i[0];break;default:s=e-1,a=t}let l=(n-t)*0.5,c=this.valueSize;this._weightPrev=l/(t-o),this._weightNext=l/(a-n),this._offsetPrev=r*c,this._offsetNext=s*c}interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,c=this._offsetPrev,h=this._offsetNext,f=this._weightPrev,u=this._weightNext,p=(n-t)/(i-t),g=p*p,y=g*p,m=-f*y+2*f*g-f*p,d=(1+f)*y+(-1.5-2*f)*g+(-0.5+f)*p+1,b=(-1-u)*y+(1.5+u)*g+0.5*p,S=u*y-u*g;for(let _=0;_!==o;++_)r[_]=m*s[c+_]+d*s[l+_]+b*s[a+_]+S*s[h+_];return r}}class mh extends $i{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,c=(n-t)/(i-t),h=1-c;for(let f=0;f!==o;++f)r[f]=s[l+f]*h+s[a+f]*c;return r}}class gh extends $i{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}}class _h extends $i{interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,c=this.inTangents,h=this.outTangents;if(!c||!h){let p=(n-t)/(i-t),g=1-p;for(let y=0;y!==o;++y)r[y]=s[l+y]*g+s[a+y]*p;return r}let f=o*2,u=e-1;for(let p=0;p!==o;++p){let g=s[l+p],y=s[a+p],m=u*f+p*2,d=h[m],b=h[m+1],S=e*f+p*2,_=c[S],x=c[S+1],w=ry(n,t,d,_,i);r[p]=Mm(w,g,b,x,y)}return r}}function Mm(e,t,n,i,r){let s=1-e;return s*s*s*t+3*s*s*e*n+3*s*e*e*i+e*e*e*r}function iy(e,t,n,i,r){let s=1-e;return 3*s*s*(n-t)+6*s*e*(i-n)+3*e*e*(r-i)}function ry(e,t,n,i,r){let s=(e-t)/(r-t);for(let o=0;o<8;o++){let a=Mm(s,t,n,i,r)-e;if(Math.abs(a)<0.0000000001)break;let l=iy(s,t,n,i,r);if(Math.abs(l)<0.0000000001)break;s=Math.max(0,Math.min(1,s-a/l))}return s}class Sn{constructor(e,t,n,i){if(e===void 0)throw Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Sr(t,this.TimeBufferType),this.values=Sr(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Sr(e.times,Array),values:Sr(e.values,Array)};let i=e.getInterpolation();if(i!==e.DefaultInterpolation)n.interpolation=i;if(nc(e.settings))n.settings={inTangents:Sr(e.settings.inTangents,Array),outTangents:Sr(e.settings.outTangents,Array)}}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new gh(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new mh(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new ph(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new _h(this.times,this.values,this.getValueSize(),e);if(this.settings)t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents;return t}setInterpolation(e){let t;switch(e){case 2300:t=this.InterpolantFactoryMethodDiscrete;break;case 2301:t=this.InterpolantFactoryMethodLinear;break;case 2302:t=this.InterpolantFactoryMethodSmooth;break;case 2303:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(n);return Ie("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return 2300;case this.InterpolantFactoryMethodLinear:return 2301;case this.InterpolantFactoryMethodSmooth:return 2302;case this.InterpolantFactoryMethodBezier:return 2303}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e;if(nc(this.settings))dp(this.settings.inTangents,e),dp(this.settings.outTangents,e)}return this}trim(e,t){let n=this.times,i=n.length,r=0,s=i-1;while(r!==i&&n[r]<e)++r;while(s!==-1&&n[s]>t)--s;if(++s,r!==0||s!==i){if(r>=s)s=Math.max(s,1),r=s-1;let o=this.getValueSize();this.times=n.slice(r,s),this.values=this.values.slice(r*o,s*o)}return this}validate(){let e=!0,t=this.getValueSize();if(t-Math.floor(t)!==0)De("KeyframeTrack: Invalid value size in track.",this),e=!1;let n=this.times,i=this.values,r=n.length;if(r===0)De("KeyframeTrack: Track is empty.",this),e=!1;let s=null;for(let o=0;o!==r;o++){let a=n[o];if(typeof a==="number"&&isNaN(a)){De("KeyframeTrack: Time is not a valid number.",this,o,a),e=!1;break}if(s!==null&&s>a){De("KeyframeTrack: Out of order keys.",this,o,a,s),e=!1;break}s=a}if(i!==void 0){if(uv(i))for(let o=0,a=i.length;o!==a;++o){let l=i[o];if(isNaN(l)){De("KeyframeTrack: Value is not a valid number.",this,o,l),e=!1;break}}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===2302,r=e.length-1,s=1;for(let o=1;o<r;++o){let a=!1,l=e[o],c=e[o+1];if(l!==c&&(o!==1||l!==e[0]))if(!i){let h=o*n,f=h-n,u=h+n;for(let p=0;p!==n;++p){let g=t[h+p];if(g!==t[f+p]||g!==t[u+p]){a=!0;break}}}else a=!0;if(a){if(o!==s){e[s]=e[o];let h=o*n,f=s*n;for(let u=0;u!==n;++u)t[f+u]=t[h+u]}++s}}if(r>0){e[s]=e[r];for(let o=r*n,a=s*n,l=0;l!==n;++l)t[a+l]=t[o+l];++s}if(s!==e.length)this.times=e.slice(0,s),this.values=t.slice(0,s*n);else this.times=e,this.values=t;return this}clone(){let e=this.times.slice(),t=this.values.slice(),i=new this.constructor(this.name,e,t);if(i.createInterpolant=this.createInterpolant,nc(this.settings))i.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()};return i}}function dp(e,t){for(let n=0,i=e.length;n!==i;n+=2)e[n]*=t}Sn.prototype.ValueTypeName="";Sn.prototype.TimeBufferType=Float32Array;Sn.prototype.ValueBufferType=Float32Array;Sn.prototype.DefaultInterpolation=2301;class Zi extends Sn{constructor(e,t,n){super(e,t,n)}}Zi.prototype.ValueTypeName="bool";Zi.prototype.ValueBufferType=Array;Zi.prototype.DefaultInterpolation=2300;Zi.prototype.InterpolantFactoryMethodLinear=void 0;Zi.prototype.InterpolantFactoryMethodSmooth=void 0;class vh extends Sn{constructor(e,t,n,i){super(e,t,n,i)}}vh.prototype.ValueTypeName="color";class yh extends Sn{constructor(e,t,n,i){super(e,t,n,i)}}yh.prototype.ValueTypeName="number";class xh extends $i{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=(n-t)/(i-t),l=e*o;for(let c=l+o;l!==c;l+=4)kt.slerpFlat(r,0,s,l-o,s,l,a);return r}}class Sa extends Sn{constructor(e,t,n,i){super(e,t,n,i)}InterpolantFactoryMethodLinear(e){return new xh(this.times,this.values,this.getValueSize(),e)}}Sa.prototype.ValueTypeName="quaternion";Sa.prototype.InterpolantFactoryMethodSmooth=void 0;class Ji extends Sn{constructor(e,t,n){super(e,t,n)}}Ji.prototype.ValueTypeName="string";Ji.prototype.ValueBufferType=Array;Ji.prototype.DefaultInterpolation=2300;Ji.prototype.InterpolantFactoryMethodLinear=void 0;Ji.prototype.InterpolantFactoryMethodSmooth=void 0;class bh extends Sn{constructor(e,t,n,i){super(e,t,n,i)}}bh.prototype.ValueTypeName="vector";var $o={enabled:!1,files:{},add:function(e,t){if(this.enabled===!1)return;if(pp(e))return;this.files[e]=t},get:function(e){if(this.enabled===!1)return;if(pp(e))return;return this.files[e]},remove:function(e){delete this.files[e]},clear:function(){this.files={}}};function pp(e){try{let t=e.slice(e.indexOf(":")+1);return new URL(t).protocol==="blob:"}catch(t){return!1}}class Sh{constructor(e,t,n){let i=this,r=!1,s=0,o=0,a=void 0,l=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(c){if(o++,r===!1){if(i.onStart!==void 0)i.onStart(c,s,o)}r=!0},this.itemEnd=function(c){if(s++,i.onProgress!==void 0)i.onProgress(c,s,o);if(s===o){if(r=!1,i.onLoad!==void 0)i.onLoad()}},this.itemError=function(c){if(i.onError!==void 0)i.onError(c)},this.resolveURL=function(c){if(c=c.normalize("NFC"),a)return a(c);return c},this.setURLModifier=function(c){return a=c,this},this.addHandler=function(c,h){return l.push(c,h),this},this.removeHandler=function(c){let h=l.indexOf(c);if(h!==-1)l.splice(h,2);return this},this.getHandler=function(c){for(let h=0,f=l.length;h<f;h+=2){let u=l[h],p=l[h+1];if(u.global)u.lastIndex=0;if(u.test(c))return p}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){if(!this._abortController)this._abortController=new AbortController;return this._abortController}}var wm=new Sh;class Gs{constructor(e){if(this.manager=e!==void 0?e:wm,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,r){n.load(e,i,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}}Gs.DEFAULT_MATERIAL_NAME="__DEFAULT";var Mr=new WeakMap;class Mh extends Gs{constructor(e){super(e)}load(e,t,n,i){if(this.path!==void 0)e=this.path+e;e=this.manager.resolveURL(e);let r=this,s=$o.get(`image:${e}`);if(s!==void 0){if(s.complete===!0)r.manager.itemStart(e),setTimeout(function(){if(t)t(s);r.manager.itemEnd(e)},0);else{let h=Mr.get(s);if(h===void 0)h=[],Mr.set(s,h);h.push({onLoad:t,onError:i})}return s}let o=Ar("img");function a(){if(c(),t)t(this);let h=Mr.get(this)||[];for(let f=0;f<h.length;f++){let u=h[f];if(u.onLoad)u.onLoad(this)}Mr.delete(this),r.manager.itemEnd(e)}function l(h){if(c(),i)i(h);$o.remove(`image:${e}`);let f=Mr.get(this)||[];for(let u=0;u<f.length;u++){let p=f[u];if(p.onError)p.onError(h)}Mr.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function c(){o.removeEventListener("load",a,!1),o.removeEventListener("error",l,!1)}if(o.addEventListener("load",a,!1),o.addEventListener("error",l,!1),e.slice(0,5)!=="data:"){if(this.crossOrigin!==void 0)o.crossOrigin=this.crossOrigin}return $o.add(`image:${e}`,o),r.manager.itemStart(e),o.src=e,o}}class Ma extends Gs{constructor(e){super(e)}load(e,t,n,i){let r=new Ft,s=new Mh(this.manager);return s.setCrossOrigin(this.crossOrigin),s.setPath(this.path),s.load(e,function(o){if(r.image=o,r.needsUpdate=!0,t!==void 0)t(r)},n,i),r}}class wa extends Rt{constructor(e,t=1){super();this.isLight=!0,this.type="Light",this.color=new Fe(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}}var ic=new Ke,mp=new L,gp=new L;class wh{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new re(512,512),this.mapType=1009,this.map=null,this.mapPass=null,this.matrix=new Ke,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ns,this._frameExtents=new re(1,1),this._viewportCount=1,this._viewports=[new gt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;mp.setFromMatrixPosition(e.matrixWorld),t.position.copy(mp),gp.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(gp),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,i){ic.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(ic,e.coordinateSystem,e.reversedDepth);let r=this._frameExtents,s=i?i.z/r.x:1,o=i?i.w/r.y:1,a=i?i.x/r.x:0,l=i?i.y/r.y:0;if(e.coordinateSystem===2001||e.reversedDepth)t.set(0.5*s,0,0,0.5*s+a,0,0.5*o,0,0.5*o+l,0,0,1,0,0,0,0,1);else t.set(0.5*s,0,0,0.5*s+a,0,0.5*o,0,0.5*o+l,0,0,0.5,0.5,0,0,0,1);t.multiply(ic)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){if(this.map)this.map.dispose();if(this.mapPass)this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}var jo=new L,Yo=new kt,Fn=new L;class Ta extends Rt{constructor(){super();this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ke,this.projectionMatrix=new Ke,this.projectionMatrixInverse=new Ke,this.coordinateSystem=2000,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){if(super.updateMatrixWorld(e),this.matrixWorld.decompose(jo,Yo,Fn),Fn.x===1&&Fn.y===1&&Fn.z===1)this.matrixWorldInverse.copy(this.matrixWorld).invert();else this.matrixWorldInverse.compose(jo,Yo,Fn.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){if(super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(jo,Yo,Fn),Fn.x===1&&Fn.y===1&&Fn.z===1)this.matrixWorldInverse.copy(this.matrixWorld).invert();else this.matrixWorldInverse.compose(jo,Yo,Fn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}var _i=new L,_p=new re,vp=new re;class Kt extends Ta{constructor(e=50,t=1,n=0.1,i=2000){super();this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=0.5*this.getFilmHeight()/e;this.fov=Rr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(us*0.5*this.fov);return 0.5*this.getFilmHeight()/e}getEffectiveFOV(){return Rr*2*Math.atan(Math.tan(us*0.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){_i.set(-1,-1,0.5).applyMatrix4(this.projectionMatrixInverse),t.set(_i.x,_i.y).multiplyScalar(-e/_i.z),_i.set(1,1,0.5).applyMatrix4(this.projectionMatrixInverse),n.set(_i.x,_i.y).multiplyScalar(-e/_i.z)}getViewSize(e,t){return this.getViewBounds(e,_p,vp),t.subVectors(vp,_p)}setViewOffset(e,t,n,i,r,s){if(this.aspect=e/t,this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(us*0.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,r=-0.5*i,s=this.view;if(this.view!==null&&this.view.enabled){let{fullWidth:a,fullHeight:l}=s;r+=s.offsetX*i/a,t-=s.offsetY*n/l,i*=s.width/a,n*=s.height/l}let o=this.filmOffset;if(o!==0)r+=e*o/this.getFilmWidth();this.projectionMatrix.makePerspective(r,r+i,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);if(t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null)t.object.view=Object.assign({},this.view);return t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class Ki extends Ta{constructor(e=-1,t=1,n=1,i=-1,r=0.1,s=2000){super();this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=r,this.far=s,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,r,s){if(this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,r=n-e,s=n+e,o=i+t,a=i-t;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,c=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,s=r+l*this.view.width,o-=c*this.view.offsetY,a=o-c*this.view.height}this.projectionMatrix.makeOrthographic(r,s,o,a,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);if(t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null)t.object.view=Object.assign({},this.view);return t}}class Tm extends wh{constructor(){super(new Ki(-5,5,5,-5,0.5,500));this.isDirectionalLightShadow=!0}}class Ea extends wa{constructor(e,t){super(e,t);this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Rt.DEFAULT_UP),this.updateMatrix(),this.target=new Rt,this.shadow=new Tm}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}}class Aa extends wa{constructor(e,t){super(e,t);this.isAmbientLight=!0,this.type="AmbientLight"}}var wr=-90,Tr=1;class Th extends Rt{constructor(e,t,n){super();this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let i=new Kt(wr,Tr,e,t);i.layers=this.layers,this.add(i);let r=new Kt(wr,Tr,e,t);r.layers=this.layers,this.add(r);let s=new Kt(wr,Tr,e,t);s.layers=this.layers,this.add(s);let o=new Kt(wr,Tr,e,t);o.layers=this.layers,this.add(o);let a=new Kt(wr,Tr,e,t);a.layers=this.layers,this.add(a);let l=new Kt(wr,Tr,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,i,r,s,o,a]=t;for(let l of t)this.remove(l);if(e===2000)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),s.up.set(0,0,1),s.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),a.up.set(0,1,0),a.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),s.up.set(0,0,-1),s.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),a.up.set(0,-1,0),a.lookAt(0,0,-1);else throw Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let l of t)this.add(l),l.updateMatrixWorld()}update(e,t){if(this.parent===null)this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:i}=this;if(this.coordinateSystem!==e.coordinateSystem)this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem();let[r,s,o,a,l,c]=this.children,h=e.getRenderTarget(),f=e.getActiveCubeFace(),u=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let g=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let y=!1;if(e.isWebGLRenderer===!0)y=e.state.buffers.depth.getReversed();else y=e.reversedDepthBuffer;if(e.setRenderTarget(n,0,i),y&&e.autoClear===!1)e.clearDepth();if(e.render(t,r),e.setRenderTarget(n,1,i),y&&e.autoClear===!1)e.clearDepth();if(e.render(t,s),e.setRenderTarget(n,2,i),y&&e.autoClear===!1)e.clearDepth();if(e.render(t,o),e.setRenderTarget(n,3,i),y&&e.autoClear===!1)e.clearDepth();if(e.render(t,a),e.setRenderTarget(n,4,i),y&&e.autoClear===!1)e.clearDepth();if(e.render(t,l),n.texture.generateMipmaps=g,e.setRenderTarget(n,5,i),y&&e.autoClear===!1)e.clearDepth();e.render(t,c),e.setRenderTarget(h,f,u),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}}class Eh extends Kt{constructor(e=[]){super();this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class Gr{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){if(this._document=e,e.hidden!==void 0)this._pageVisibilityHandler=sy.bind(this),e.addEventListener("visibilitychange",this._pageVisibilityHandler,!1)}disconnect(){if(this._pageVisibilityHandler!==null)this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null;this._document=null}getDelta(){return this._delta/1000}getElapsed(){return this._elapsed/1000}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){if(this._pageVisibilityHandler!==null&&this._document.hidden===!0)this._delta=0;else this._previousTime=this._currentTime,this._currentTime=(e!==void 0?e:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta;return this}}function sy(){if(this._document.hidden===!1)this.reset()}var Ah="\\[\\]\\.:\\/",oy=new RegExp("["+Ah+"]","g"),Ch="[^"+Ah+"]",ay="[^"+Ah.replace("\\.","")+"]",ly=/((?:WC+[\/:])*)/.source.replace("WC",Ch),cy=/(WCOD+)?/.source.replace("WCOD",ay),hy=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Ch),uy=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Ch),fy=new RegExp("^"+ly+cy+hy+uy+"$"),dy=["material","materials","bones","map"];class Em{constructor(e,t,n){let i=n||ot.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];if(i!==void 0)i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=n.length;i!==r;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}}class ot{constructor(e,t,n){this.path=t,this.parsedPath=n||ot.parseTrackName(t),this.node=ot.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){if(!(e&&e.isAnimationObjectGroup))return new ot(e,t,n);else return new ot.Composite(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(oy,"")}static parseTrackName(e){let t=fy.exec(e);if(t===null)throw Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let r=n.nodeName.substring(i+1);if(dy.indexOf(r)!==-1)n.nodeName=n.nodeName.substring(0,i),n.objectName=r}if(n.propertyName===null||n.propertyName.length===0)throw Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(r){for(let s=0;s<r.length;s++){let o=r[s];if(o.name===t||o.uuid===t)return o;let a=n(o.children);if(a)return a}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,{objectName:n,propertyName:i,propertyIndex:r}=t;if(!e)e=ot.findNode(this.rootNode,t.nodeName),this.node=e;if(this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Ie("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let l=t.objectIndex;switch(n){case"materials":if(!e.material){De("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){De("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){De("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let c=0;c<e.length;c++)if(e[c].name===l){l=c;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){De("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){De("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){De("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(l!==void 0){if(e[l]===void 0){De("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[l]}}let s=e[i];if(s===void 0){let l=t.nodeName;De("PropertyBinding: Trying to update property for track: "+l+"."+i+" but it wasn't found.",e);return}let o=this.Versioning.None;if(this.targetObject=e,e.isMaterial===!0)o=this.Versioning.NeedsUpdate;else if(e.isObject3D===!0)o=this.Versioning.MatrixWorldNeedsUpdate;let a=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){De("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){De("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}if(e.morphTargetDictionary[r]!==void 0)r=e.morphTargetDictionary[r]}a=this.BindingType.ArrayElement,this.resolvedProperty=s,this.propertyIndex=r}else if(s.fromArray!==void 0&&s.toArray!==void 0)a=this.BindingType.HasFromToArray,this.resolvedProperty=s;else if(Array.isArray(s))a=this.BindingType.EntireArray,this.resolvedProperty=s;else this.propertyName=i;this.getValue=this.GetterByBindingType[a],this.setValue=this.SetterByBindingTypeAndVersioning[a][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}ot.Composite=Em;ot.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};ot.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};ot.prototype.GetterByBindingType=[ot.prototype._getValue_direct,ot.prototype._getValue_array,ot.prototype._getValue_arrayElement,ot.prototype._getValue_toArray];ot.prototype.SetterByBindingTypeAndVersioning=[[ot.prototype._setValue_direct,ot.prototype._setValue_direct_setNeedsUpdate,ot.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[ot.prototype._setValue_array,ot.prototype._setValue_array_setNeedsUpdate,ot.prototype._setValue_array_setMatrixWorldNeedsUpdate],[ot.prototype._setValue_arrayElement,ot.prototype._setValue_arrayElement_setNeedsUpdate,ot.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[ot.prototype._setValue_fromArray,ot.prototype._setValue_fromArray_setNeedsUpdate,ot.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var GC=new Float32Array(1);var yp=new Ke;class Hr{constructor(e,t,n=0,i=1/0){this.ray=new Xi(e,t),this.near=n,this.far=i,this.camera=null,this.layers=new Is,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){if(t.isPerspectiveCamera)this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,0.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t;else if(t.isOrthographicCamera)this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t;else De("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return yp.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(yp),this}intersectObject(e,t=!0,n=[]){return rc(e,this,n,t),n.sort(xp),n}intersectObjects(e,t=!0,n=[]){for(let i=0,r=e.length;i<r;i++)rc(e[i],this,n,t);return n.sort(xp),n}}function xp(e,t){return e.distance-t.distance}function rc(e,t,n,i){let r=!0;if(e.layers.test(t.layers)){if(e.raycast(t,n)===!1)r=!1}if(r===!0&&i===!0){let s=e.children;for(let o=0,a=s.length;o<a;o++)rc(s[o],t,n,!0)}}class Hs{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=He(this.phi,0.000001,Math.PI-0.000001),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){if(this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0)this.theta=0,this.phi=0;else this.theta=Math.atan2(e,n),this.phi=Math.acos(He(t/this.radius,-1,1));return this}clone(){return new this.constructor().copy(this)}}class Rh{static{Rh.prototype.isMatrix2=!0}constructor(e,t,n,i){if(this.elements=[1,0,0,1],e!==void 0)this.set(e,t,n,i)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,i){let r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=i,this}}class Gn extends zn{constructor(e,t=null){super();this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(this.domElement!==null)this.disconnect();this.domElement=e}disconnect(){}dispose(){}update(){}}function Ph(e,t,n,i){let r=py(i);switch(n){case 1021:return e*t;case 1028:return e*t/r.components*r.byteLength;case 1029:return e*t/r.components*r.byteLength;case 1030:return e*t*2/r.components*r.byteLength;case 1031:return e*t*2/r.components*r.byteLength;case 1022:return e*t*3/r.components*r.byteLength;case 1023:return e*t*4/r.components*r.byteLength;case 1033:return e*t*4/r.components*r.byteLength;case 33776:case 33777:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case 33778:case 33779:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 35841:case 35843:return Math.max(e,16)*Math.max(t,8)/4;case 35840:case 35842:return Math.max(e,8)*Math.max(t,8)/2;case 36196:case 37492:case 37488:case 37489:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case 37496:case 37490:case 37491:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 37808:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 37809:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case 37810:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case 37811:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case 37812:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case 37813:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case 37814:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case 37815:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case 37816:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case 37817:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case 37818:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case 37819:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case 37820:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case 37821:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case 36492:case 36494:case 36495:return Math.ceil(e/4)*Math.ceil(t/4)*16;case 36283:case 36284:return Math.ceil(e/4)*Math.ceil(t/4)*8;case 36285:case 36286:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function py(e){switch(e){case 1009:case 1010:return{byteLength:1,components:1};case 1012:case 1011:case 1016:return{byteLength:2,components:1};case 1017:case 1018:return{byteLength:2,components:4};case 1014:case 1013:case 1015:return{byteLength:4,components:1};case 35902:case 35899:return{byteLength:4,components:3}}throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}if(typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));if(typeof window<"u")if(window.__THREE__)Ie("WARNING: Multiple instances of Three.js being imported.");else window.__THREE__="186";function Ym(){let e=null,t=!1,n=null,i=null;function r(s,o){i=e.requestAnimationFrame(r),n(s,o)}return{start:function(){if(t===!0)return;if(n===null)return;if(e===null)return;i=e.requestAnimationFrame(r),t=!0},stop:function(){if(e!==null)e.cancelAnimationFrame(i);t=!1},setAnimationLoop:function(s){n=s},setContext:function(s){e=s}}}function my(e){let t=new WeakMap;function n(a,l){let{array:c,usage:h}=a,f=c.byteLength,u=e.createBuffer();e.bindBuffer(l,u),e.bufferData(l,c,h),a.onUploadCallback();let p;if(c instanceof Float32Array)p=e.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)p=e.HALF_FLOAT;else if(c instanceof Uint16Array)if(a.isFloat16BufferAttribute)p=e.HALF_FLOAT;else p=e.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=e.SHORT;else if(c instanceof Uint32Array)p=e.UNSIGNED_INT;else if(c instanceof Int32Array)p=e.INT;else if(c instanceof Int8Array)p=e.BYTE;else if(c instanceof Uint8Array)p=e.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=e.UNSIGNED_BYTE;else throw Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function i(a,l,c){let{array:h,updateRanges:f}=l;if(e.bindBuffer(c,a),f.length===0)e.bufferSubData(c,0,h);else{f.sort((p,g)=>p.start-g.start);let u=0;for(let p=1;p<f.length;p++){let g=f[u],y=f[p];if(y.start<=g.start+g.count+1)g.count=Math.max(g.count,y.start+y.count-g.start);else++u,f[u]=y}f.length=u+1;for(let p=0,g=f.length;p<g;p++){let y=f[p];e.bufferSubData(c,y.start*h.BYTES_PER_ELEMENT,h,y.start,y.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(a){if(a.isInterleavedBufferAttribute)a=a.data;return t.get(a)}function s(a){if(a.isInterleavedBufferAttribute)a=a.data;let l=t.get(a);if(l)e.deleteBuffer(l.buffer),t.delete(a)}function o(a,l){if(a.isInterleavedBufferAttribute)a=a.data;if(a.isGLBufferAttribute){let h=t.get(a);if(!h||h.version<a.version)t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=t.get(a);if(c===void 0)t.set(a,n(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:r,remove:s,update:o}}var gy=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,_y=`#ifdef USE_ALPHAHASH
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
#endif`,vy=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,yy=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,xy=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,by=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Sy=`#ifdef USE_AOMAP
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
#endif`,My=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,wy=`#ifdef USE_BATCHING
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
#endif`,Ty=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Ey=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Ay=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Cy=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Ry=`#ifdef USE_IRIDESCENCE
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
#endif`,Py=`#ifdef USE_BUMPMAP
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
#endif`,Iy=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Ly=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Dy=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Ny=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Oy=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Uy=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Fy=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,By=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,ky=`#define PI 3.141592653589793
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
} // validated`,zy=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Gy=`vec3 transformedNormal = objectNormal;
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
#endif`,Hy=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Vy=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Wy=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Xy=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,qy="gl_FragColor = linearToOutputTexel( gl_FragColor );",jy=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Yy=`#ifdef USE_ENVMAP
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
#endif`,$y=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Zy=`#ifdef USE_ENVMAP
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
#endif`,Jy=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Ky=`#ifdef USE_ENVMAP
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
#endif`,Qy=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,ex=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,tx=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,nx=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,ix=`#ifdef USE_GRADIENTMAP
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
}`,rx=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,sx=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,ox=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,ax=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,lx=`#ifdef USE_ENVMAP
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
#endif`,cx=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,hx=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,ux=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,fx=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,dx=`PhysicalMaterial material;
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
#endif`,px=`uniform sampler2D dfgLUT;
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
}`,mx=`
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
#endif`,gx=`#if defined( RE_IndirectDiffuse )
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
#endif`,_x=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,vx=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,yx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,xx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,bx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Sx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Mx=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,wx=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Tx=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Ex=`#if defined( USE_POINTS_UV )
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
#endif`,Ax=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Cx=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Rx=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Px=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Ix=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Lx=`#ifdef USE_MORPHTARGETS
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
#endif`,Dx=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Nx=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Ox=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Ux=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Fx=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Bx=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,kx=`#ifdef USE_NORMALMAP
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
#endif`,zx=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Gx=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Hx=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Vx=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Wx=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Xx=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,qx=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,jx=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Yx=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,$x=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Zx=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Jx=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Kx=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Qx=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,eb=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,tb=`float getShadowMask() {
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
}`,nb=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,ib=`#ifdef USE_SKINNING
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
#endif`,rb=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,sb=`#ifdef USE_SKINNING
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
#endif`,ob=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,ab=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,lb=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,cb=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,hb=`#ifdef USE_TRANSMISSION
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
#endif`,ub=`#ifdef USE_TRANSMISSION
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
#endif`,fb=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,db=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,pb=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`;var mb=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,gb=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,_b=`uniform sampler2D t2D;
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
}`,vb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,yb=`#ifdef ENVMAP_TYPE_CUBE
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
}`,xb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,bb=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Sb=`#include <common>
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
}`,Mb=`#if DEPTH_PACKING == 3200
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
}`,wb=`#define DISTANCE
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
}`,Tb=`#define DISTANCE
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
}`,Eb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Ab=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Cb=`uniform float scale;
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
}`,Rb=`uniform vec3 diffuse;
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
}`,Pb=`#include <common>
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
}`,Ib=`uniform vec3 diffuse;
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
}`,Lb=`#define LAMBERT
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
}`,Db=`#define LAMBERT
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
}`,Nb=`#define MATCAP
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
}`,Ob=`#define MATCAP
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
}`,Ub=`#define NORMAL
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
}`,Fb=`#define NORMAL
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
}`,Bb=`#define PHONG
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
}`,kb=`#define PHONG
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
}`,zb=`#define STANDARD
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
}`,Gb=`#define STANDARD
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
}`,Hb=`#define TOON
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
}`,Vb=`#define TOON
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
}`,Wb=`uniform float size;
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
}`,Xb=`uniform vec3 diffuse;
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
}`,qb=`#include <common>
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
}`,jb=`uniform vec3 color;
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
}`,Yb=`uniform float rotation;
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
}`,$b=`uniform vec3 diffuse;
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
}`,Ve={alphahash_fragment:gy,alphahash_pars_fragment:_y,alphamap_fragment:vy,alphamap_pars_fragment:yy,alphatest_fragment:xy,alphatest_pars_fragment:by,aomap_fragment:Sy,aomap_pars_fragment:My,batching_pars_vertex:wy,batching_vertex:Ty,begin_vertex:Ey,beginnormal_vertex:Ay,bsdfs:Cy,iridescence_fragment:Ry,bumpmap_pars_fragment:Py,clipping_planes_fragment:Iy,clipping_planes_pars_fragment:Ly,clipping_planes_pars_vertex:Dy,clipping_planes_vertex:Ny,color_fragment:Oy,color_pars_fragment:Uy,color_pars_vertex:Fy,color_vertex:By,common:ky,cube_uv_reflection_fragment:zy,defaultnormal_vertex:Gy,displacementmap_pars_vertex:Hy,displacementmap_vertex:Vy,emissivemap_fragment:Wy,emissivemap_pars_fragment:Xy,colorspace_fragment:qy,colorspace_pars_fragment:jy,envmap_fragment:Yy,envmap_common_pars_fragment:$y,envmap_pars_fragment:Zy,envmap_pars_vertex:Jy,envmap_physical_pars_fragment:lx,envmap_vertex:Ky,fog_vertex:Qy,fog_pars_vertex:ex,fog_fragment:tx,fog_pars_fragment:nx,gradientmap_pars_fragment:ix,lightmap_pars_fragment:rx,lights_lambert_fragment:sx,lights_lambert_pars_fragment:ox,lights_pars_begin:ax,lights_toon_fragment:cx,lights_toon_pars_fragment:hx,lights_phong_fragment:ux,lights_phong_pars_fragment:fx,lights_physical_fragment:dx,lights_physical_pars_fragment:px,lights_fragment_begin:mx,lights_fragment_maps:gx,lights_fragment_end:_x,lightprobes_pars_fragment:vx,logdepthbuf_fragment:yx,logdepthbuf_pars_fragment:xx,logdepthbuf_pars_vertex:bx,logdepthbuf_vertex:Sx,map_fragment:Mx,map_pars_fragment:wx,map_particle_fragment:Tx,map_particle_pars_fragment:Ex,metalnessmap_fragment:Ax,metalnessmap_pars_fragment:Cx,morphinstance_vertex:Rx,morphcolor_vertex:Px,morphnormal_vertex:Ix,morphtarget_pars_vertex:Lx,morphtarget_vertex:Dx,normal_fragment_begin:Nx,normal_fragment_maps:Ox,normal_pars_fragment:Ux,normal_pars_vertex:Fx,normal_vertex:Bx,normalmap_pars_fragment:kx,clearcoat_normal_fragment_begin:zx,clearcoat_normal_fragment_maps:Gx,clearcoat_pars_fragment:Hx,iridescence_pars_fragment:Vx,opaque_fragment:Wx,packing:Xx,premultiplied_alpha_fragment:qx,project_vertex:jx,dithering_fragment:Yx,dithering_pars_fragment:$x,roughnessmap_fragment:Zx,roughnessmap_pars_fragment:Jx,shadowmap_pars_fragment:Kx,shadowmap_pars_vertex:Qx,shadowmap_vertex:eb,shadowmask_pars_fragment:tb,skinbase_vertex:nb,skinning_pars_vertex:ib,skinning_vertex:rb,skinnormal_vertex:sb,specularmap_fragment:ob,specularmap_pars_fragment:ab,tonemapping_fragment:lb,tonemapping_pars_fragment:cb,transmission_fragment:hb,transmission_pars_fragment:ub,uv_pars_fragment:fb,uv_pars_vertex:db,uv_vertex:pb,worldpos_vertex:mb,background_vert:gb,background_frag:_b,backgroundCube_vert:vb,backgroundCube_frag:yb,cube_vert:xb,cube_frag:bb,depth_vert:Sb,depth_frag:Mb,distance_vert:wb,distance_frag:Tb,equirect_vert:Eb,equirect_frag:Ab,linedashed_vert:Cb,linedashed_frag:Rb,meshbasic_vert:Pb,meshbasic_frag:Ib,meshlambert_vert:Lb,meshlambert_frag:Db,meshmatcap_vert:Nb,meshmatcap_frag:Ob,meshnormal_vert:Ub,meshnormal_frag:Fb,meshphong_vert:Bb,meshphong_frag:kb,meshphysical_vert:zb,meshphysical_frag:Gb,meshtoon_vert:Hb,meshtoon_frag:Vb,points_vert:Wb,points_frag:Xb,shadow_vert:qb,shadow_frag:jb,sprite_vert:Yb,sprite_frag:$b},pe={common:{diffuse:{value:new Fe(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Be},alphaMap:{value:null},alphaMapTransform:{value:new Be},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Be}},envmap:{envMap:{value:null},envMapRotation:{value:new Be},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:0.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Be}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Be}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Be},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Be},normalScale:{value:new re(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Be},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Be}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Be}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Be}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:0.00025},fogNear:{value:1},fogFar:{value:2000},fogColor:{value:new Fe(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new L},probesMax:{value:new L},probesResolution:{value:new L}},points:{diffuse:{value:new Fe(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Be},alphaTest:{value:0},uvTransform:{value:new Be}},sprite:{diffuse:{value:new Fe(16777215)},opacity:{value:1},center:{value:new re(0.5,0.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Be},alphaMap:{value:null},alphaMapTransform:{value:new Be},alphaTest:{value:0}}},Vn={basic:{uniforms:jt([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.fog]),vertexShader:Ve.meshbasic_vert,fragmentShader:Ve.meshbasic_frag},lambert:{uniforms:jt([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,pe.lights,{emissive:{value:new Fe(0)},envMapIntensity:{value:1}}]),vertexShader:Ve.meshlambert_vert,fragmentShader:Ve.meshlambert_frag},phong:{uniforms:jt([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,pe.lights,{emissive:{value:new Fe(0)},specular:{value:new Fe(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Ve.meshphong_vert,fragmentShader:Ve.meshphong_frag},standard:{uniforms:jt([pe.common,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.roughnessmap,pe.metalnessmap,pe.fog,pe.lights,{emissive:{value:new Fe(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ve.meshphysical_vert,fragmentShader:Ve.meshphysical_frag},toon:{uniforms:jt([pe.common,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.gradientmap,pe.fog,pe.lights,{emissive:{value:new Fe(0)}}]),vertexShader:Ve.meshtoon_vert,fragmentShader:Ve.meshtoon_frag},matcap:{uniforms:jt([pe.common,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,{matcap:{value:null}}]),vertexShader:Ve.meshmatcap_vert,fragmentShader:Ve.meshmatcap_frag},points:{uniforms:jt([pe.points,pe.fog]),vertexShader:Ve.points_vert,fragmentShader:Ve.points_frag},dashed:{uniforms:jt([pe.common,pe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ve.linedashed_vert,fragmentShader:Ve.linedashed_frag},depth:{uniforms:jt([pe.common,pe.displacementmap]),vertexShader:Ve.depth_vert,fragmentShader:Ve.depth_frag},normal:{uniforms:jt([pe.common,pe.bumpmap,pe.normalmap,pe.displacementmap,{opacity:{value:1}}]),vertexShader:Ve.meshnormal_vert,fragmentShader:Ve.meshnormal_frag},sprite:{uniforms:jt([pe.sprite,pe.fog]),vertexShader:Ve.sprite_vert,fragmentShader:Ve.sprite_frag},background:{uniforms:{uvTransform:{value:new Be},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ve.background_vert,fragmentShader:Ve.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Be}},vertexShader:Ve.backgroundCube_vert,fragmentShader:Ve.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ve.cube_vert,fragmentShader:Ve.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ve.equirect_vert,fragmentShader:Ve.equirect_frag},distance:{uniforms:jt([pe.common,pe.displacementmap,{referencePosition:{value:new L},nearDistance:{value:1},farDistance:{value:1000}}]),vertexShader:Ve.distance_vert,fragmentShader:Ve.distance_frag},shadow:{uniforms:jt([pe.lights,pe.fog,{color:{value:new Fe(0)},opacity:{value:1}}]),vertexShader:Ve.shadow_vert,fragmentShader:Ve.shadow_frag}};Vn.physical={uniforms:jt([Vn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Be},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Be},clearcoatNormalScale:{value:new re(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Be},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Be},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Be},sheen:{value:0},sheenColor:{value:new Fe(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Be},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Be},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Be},transmissionSamplerSize:{value:new re},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Be},attenuationDistance:{value:0},attenuationColor:{value:new Fe(0)},specularColor:{value:new Fe(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Be},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Be},anisotropyVector:{value:new re},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Be}}]),vertexShader:Ve.meshphysical_vert,fragmentShader:Ve.meshphysical_frag};var Ca={r:0,b:0,g:0},Zb=new Ke,$m=new Be;$m.set(-1,0,0,0,1,0,0,0,1);function Jb(e,t,n,i,r,s){let o=new Fe(0),a=r===!0?0:1,l,c,h=null,f=0,u=null;function p(b){let S=b.isScene===!0?b.background:null;if(S&&S.isTexture){let _=b.backgroundBlurriness>0;S=t.get(S,_)}return S}function g(b){let S=!1,_=p(b);if(_===null)m(o,a);else if(_&&_.isColor)m(_,1),S=!0;let x=e.xr.getEnvironmentBlendMode();if(x==="additive")n.buffers.color.setClear(0,0,0,1,s);else if(x==="alpha-blend")n.buffers.color.setClear(0,0,0,0,s);if(e.autoClear||S)n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil)}function y(b,S){let _=p(S);if(_&&(_.isCubeTexture||_.mapping===As)){if(c===void 0)c=new zt(new Br(1,1,1),new Tt({name:"BackgroundCubeMaterial",uniforms:Yi(Vn.backgroundCube.uniforms),vertexShader:Vn.backgroundCube.vertexShader,fragmentShader:Vn.backgroundCube.fragmentShader,side:Xt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(x,w,E){this.matrixWorld.copyPosition(E.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c);if(c.material.uniforms.envMap.value=_,c.material.uniforms.backgroundBlurriness.value=S.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Zb.makeRotationFromEuler(S.backgroundRotation)).transpose(),_.isCubeTexture&&_.isRenderTargetTexture===!1)c.material.uniforms.backgroundRotation.value.premultiply($m);if(c.material.toneMapped=We.getTransfer(_.colorSpace)!==at,h!==_||f!==_.version||u!==e.toneMapping)c.material.needsUpdate=!0,h=_,f=_.version,u=e.toneMapping;c.layers.enableAll(),b.unshift(c,c.geometry,c.material,0,0,null)}else if(_&&_.isTexture){if(l===void 0)l=new zt(new Bs(2,2),new Tt({name:"BackgroundMaterial",uniforms:Yi(Vn.background.uniforms),vertexShader:Vn.background.vertexShader,fragmentShader:Vn.background.fragmentShader,side:Ir,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l);if(l.material.uniforms.t2D.value=_,l.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,l.material.toneMapped=We.getTransfer(_.colorSpace)!==at,_.matrixAutoUpdate===!0)_.updateMatrix();if(l.material.uniforms.uvTransform.value.copy(_.matrix),h!==_||f!==_.version||u!==e.toneMapping)l.material.needsUpdate=!0,h=_,f=_.version,u=e.toneMapping;l.layers.enableAll(),b.unshift(l,l.geometry,l.material,0,0,null)}}function m(b,S){b.getRGB(Ca,uh(e)),n.buffers.color.setClear(Ca.r,Ca.g,Ca.b,S,s)}function d(){if(c!==void 0)c.geometry.dispose(),c.material.dispose(),c=void 0;if(l!==void 0)l.geometry.dispose(),l.material.dispose(),l=void 0}return{getClearColor:function(){return o},setClearColor:function(b,S=1){o.set(b),a=S,m(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(b){a=b,m(o,a)},render:g,addToRenderList:y,dispose:d}}function Kb(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},r=u(null),s=r,o=!1;function a(P,D,W,R,I){let k=!1,z=f(P,R,W,D);if(s!==z)s=z,c(s.object);if(k=p(P,R,W,I),k)g(P,R,W,I);if(I!==null)t.update(I,e.ELEMENT_ARRAY_BUFFER);if(k||o){if(o=!1,_(P,D,W,R),I!==null)e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(I).buffer)}}function l(){return e.createVertexArray()}function c(P){return e.bindVertexArray(P)}function h(P){return e.deleteVertexArray(P)}function f(P,D,W,R){let I=R.wireframe===!0,k=i[D.id];if(k===void 0)k={},i[D.id]=k;let z=P.isInstancedMesh===!0?P.id:0,te=k[z];if(te===void 0)te={},k[z]=te;let Y=te[W.id];if(Y===void 0)Y={},te[W.id]=Y;let Q=Y[I];if(Q===void 0)Q=u(l()),Y[I]=Q;return Q}function u(P){let D=[],W=[],R=[];for(let I=0;I<n;I++)D[I]=0,W[I]=0,R[I]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:D,enabledAttributes:W,attributeDivisors:R,object:P,attributes:{},index:null}}function p(P,D,W,R){let I=s.attributes,k=D.attributes,z=0,te=W.getAttributes();for(let Y in te)if(te[Y].location>=0){let G=I[Y],ee=k[Y];if(ee===void 0){if(Y==="instanceMatrix"&&P.instanceMatrix)ee=P.instanceMatrix;if(Y==="instanceColor"&&P.instanceColor)ee=P.instanceColor}if(G===void 0)return!0;if(G.attribute!==ee)return!0;if(ee&&G.data!==ee.data)return!0;z++}if(s.attributesNum!==z)return!0;if(s.index!==R)return!0;return!1}function g(P,D,W,R){let I={},k=D.attributes,z=0,te=W.getAttributes();for(let Y in te)if(te[Y].location>=0){let G=k[Y];if(G===void 0){if(Y==="instanceMatrix"&&P.instanceMatrix)G=P.instanceMatrix;if(Y==="instanceColor"&&P.instanceColor)G=P.instanceColor}let ee={};if(ee.attribute=G,G&&G.data)ee.data=G.data;I[Y]=ee,z++}s.attributes=I,s.attributesNum=z,s.index=R}function y(){let P=s.newAttributes;for(let D=0,W=P.length;D<W;D++)P[D]=0}function m(P){d(P,0)}function d(P,D){let W=s.newAttributes,R=s.enabledAttributes,I=s.attributeDivisors;if(W[P]=1,R[P]===0)e.enableVertexAttribArray(P),R[P]=1;if(I[P]!==D)e.vertexAttribDivisor(P,D),I[P]=D}function b(){let P=s.newAttributes,D=s.enabledAttributes;for(let W=0,R=D.length;W<R;W++)if(D[W]!==P[W])e.disableVertexAttribArray(W),D[W]=0}function S(P,D,W,R,I,k,z){if(z===!0)e.vertexAttribIPointer(P,D,W,I,k);else e.vertexAttribPointer(P,D,W,R,I,k)}function _(P,D,W,R){y();let I=R.attributes,k=W.getAttributes(),z=D.defaultAttributeValues;for(let te in k){let Y=k[te];if(Y.location>=0){let Q=I[te];if(Q===void 0){if(te==="instanceMatrix"&&P.instanceMatrix)Q=P.instanceMatrix;if(te==="instanceColor"&&P.instanceColor)Q=P.instanceColor}if(Q!==void 0){let G=Q.normalized,ee=Q.itemSize,oe=t.get(Q);if(oe===void 0)continue;let{buffer:Ue,type:Re,bytesPerElement:X}=oe,se=Re===e.INT||Re===e.UNSIGNED_INT||Q.gpuType===cc;if(Q.isInterleavedBufferAttribute){let le=Q.data,Pe=le.stride,Oe=Q.offset;if(le.isInstancedInterleavedBuffer){for(let Ae=0;Ae<Y.locationSize;Ae++)d(Y.location+Ae,le.meshPerAttribute);if(P.isInstancedMesh!==!0&&R._maxInstanceCount===void 0)R._maxInstanceCount=le.meshPerAttribute*le.count}else for(let Ae=0;Ae<Y.locationSize;Ae++)m(Y.location+Ae);e.bindBuffer(e.ARRAY_BUFFER,Ue);for(let Ae=0;Ae<Y.locationSize;Ae++)S(Y.location+Ae,ee/Y.locationSize,Re,G,Pe*X,(Oe+ee/Y.locationSize*Ae)*X,se)}else{if(Q.isInstancedBufferAttribute){for(let le=0;le<Y.locationSize;le++)d(Y.location+le,Q.meshPerAttribute);if(P.isInstancedMesh!==!0&&R._maxInstanceCount===void 0)R._maxInstanceCount=Q.meshPerAttribute*Q.count}else for(let le=0;le<Y.locationSize;le++)m(Y.location+le);e.bindBuffer(e.ARRAY_BUFFER,Ue);for(let le=0;le<Y.locationSize;le++)S(Y.location+le,ee/Y.locationSize,Re,G,ee*X,ee/Y.locationSize*le*X,se)}}else if(z!==void 0){let G=z[te];if(G!==void 0)switch(G.length){case 2:e.vertexAttrib2fv(Y.location,G);break;case 3:e.vertexAttrib3fv(Y.location,G);break;case 4:e.vertexAttrib4fv(Y.location,G);break;default:e.vertexAttrib1fv(Y.location,G)}}}}b()}function x(){A();for(let P in i){let D=i[P];for(let W in D){let R=D[W];for(let I in R){let k=R[I];for(let z in k)h(k[z].object),delete k[z];delete R[I]}}delete i[P]}}function w(P){if(i[P.id]===void 0)return;let D=i[P.id];for(let W in D){let R=D[W];for(let I in R){let k=R[I];for(let z in k)h(k[z].object),delete k[z];delete R[I]}}delete i[P.id]}function E(P){for(let D in i){let W=i[D];for(let R in W){let I=W[R];if(I[P.id]===void 0)continue;let k=I[P.id];for(let z in k)h(k[z].object),delete k[z];delete I[P.id]}}}function v(P){for(let D in i){let W=i[D],R=P.isInstancedMesh===!0?P.id:0,I=W[R];if(I===void 0)continue;for(let k in I){let z=I[k];for(let te in z)h(z[te].object),delete z[te];delete I[k]}if(delete W[R],Object.keys(W).length===0)delete i[D]}}function A(){if(N(),o=!0,s===r)return;s=r,c(s.object)}function N(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:A,resetDefaultState:N,dispose:x,releaseStatesOfGeometry:w,releaseStatesOfObject:v,releaseStatesOfProgram:E,initAttributes:y,enableAttribute:m,disableUnusedAttributes:b}}function Qb(e,t,n){let i;function r(l){i=l}function s(l,c){e.drawArrays(i,l,c),n.update(c,i,1)}function o(l,c,h){if(h===0)return;e.drawArraysInstanced(i,l,c,h),n.update(c,i,h)}function a(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,h);let u=0;for(let p=0;p<h;p++)u+=c[p];n.update(u,i,1)}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a}function eS(e,t,n,i){let r;function s(){if(r!==void 0)return r;if(t.has("EXT_texture_filter_anisotropic")===!0){let E=t.get("EXT_texture_filter_anisotropic");r=e.getParameter(E.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(E){if(E!==kn&&i.convert(E)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))return!1;return!0}function a(E){let v=E===qt&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));if(E!==Pn&&E!==ii&&!v&&i.convert(E)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))return!1;return!0}function l(E){if(E==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";E="mediump"}if(E==="mediump"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0)return"mediump"}return"lowp"}let c=n.precision!==void 0?n.precision:"highp",h=l(c);if(h!==c)Ie("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h;let f=n.logarithmicDepthBuffer===!0,u=n.reversedDepthBuffer===!0&&t.has("EXT_clip_control");if(n.reversedDepthBuffer===!0&&u===!1)Ie("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),g=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),y=e.getParameter(e.MAX_TEXTURE_SIZE),m=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),d=e.getParameter(e.MAX_VERTEX_ATTRIBS),b=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),S=e.getParameter(e.MAX_VARYING_VECTORS),_=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),w=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:u,maxTextures:p,maxVertexTextures:g,maxTextureSize:y,maxCubemapSize:m,maxAttributes:d,maxVertexUniforms:b,maxVaryings:S,maxFragmentUniforms:_,maxSamples:x,samples:w}}function tS(e){let t=this,n=null,i=0,r=!1,s=!1,o=new sn,a=new Be,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,u){let p=f.length!==0||u||i!==0||r;return r=u,i=f.length,p},this.beginShadows=function(){s=!0,h(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(f,u){n=h(f,u,0)},this.setState=function(f,u,p){let{clippingPlanes:g,clipIntersection:y,clipShadows:m}=f,d=e.get(f);if(!r||g===null||g.length===0||s&&!m)if(s)h(null);else c();else{let b=s?0:i,S=b*4,_=d.clippingState||null;l.value=_,_=h(g,u,S,p);for(let x=0;x!==S;++x)_[x]=n[x];d.clippingState=_,this.numIntersection=y?this.numPlanes:0,this.numPlanes+=b}};function c(){if(l.value!==n)l.value=n,l.needsUpdate=i>0;t.numPlanes=i,t.numIntersection=0}function h(f,u,p,g){let y=f!==null?f.length:0,m=null;if(y!==0){if(m=l.value,g!==!0||m===null){let d=p+y*4,b=u.matrixWorldInverse;if(a.getNormalMatrix(b),m===null||m.length<d)m=new Float32Array(d);for(let S=0,_=p;S!==y;++S,_+=4)o.copy(f[S]).applyMatrix4(b,a),o.normal.toArray(m,_),m[_+3]=o.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=y,t.numIntersection=0,m}}var Wr=4,nS=6,iS=20,rS=256,Vs=new Ki,Am=new Fe,Ih=null,Lh=0,Dh=0,Nh=!1,sS=new L,Qi=new L;class Fh{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=0.1,i=100,r={}){let{size:s=256,position:o=sS}=r;Ih=this._renderer.getRenderTarget(),Lh=this._renderer.getActiveCubeFace(),Dh=this._renderer.getActiveMipmapLevel(),Nh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(s);let a=this._allocateTargets();if(a.depthBuffer=!0,this._sceneToCubeUV(e,n,i,a,o),t>0)this._blur(a,0,0,t);return this._applyPMREM(a),this._cleanup(a),a}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){if(this._cubemapMaterial===null)this._cubemapMaterial=Pm(),this._compileMaterial(this._cubemapMaterial)}compileEquirectangularShader(){if(this._equirectMaterial===null)this._equirectMaterial=Rm(),this._compileMaterial(this._equirectMaterial)}dispose(){if(this._dispose(),this._cubemapMaterial!==null)this._cubemapMaterial.dispose();if(this._equirectMaterial!==null)this._equirectMaterial.dispose();if(this._backgroundBox!==null)this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){if(this._blurMaterial!==null)this._blurMaterial.dispose();if(this._ggxMaterial!==null)this._ggxMaterial.dispose();if(this._pingPongRenderTarget!==null)this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Ih,Lh,Dh),this._renderer.xr.enabled=Nh,e.scissorTest=!1,Vr(e,0,0,e.width,e.height)}_fromTexture(e,t){if(e.mapping===Dr||e.mapping===ki)this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width);else this._setSize(e.image.width/4);Ih=this._renderer.getRenderTarget(),Lh=this._renderer.getActiveCubeFace(),Dh=this._renderer.getActiveMipmapLevel(),Nh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:an,minFilter:an,generateMipmaps:!1,type:qt,format:kn,colorSpace:qc,depthBuffer:!1},i=Cm(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){if(this._pingPongRenderTarget!==null)this._dispose();this._pingPongRenderTarget=Cm(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=oS(r)),this._blurMaterial=lS(r,e,t),this._ggxMaterial=aS(r,e,t)}return i}_compileMaterial(e){let t=new zt(new It,e);this._renderer.compile(t,Vs)}_sceneToCubeUV(e,t,n,i,r){let a=new Kt(90,1,t,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,{autoClear:f,toneMapping:u}=h;if(h.getClearColor(Am),h.toneMapping=Rn,h.autoClear=!1,h.state.buffers.depth.getReversed())h.setRenderTarget(i),h.clearDepth(),h.setRenderTarget(null);if(this._backgroundBox===null)this._backgroundBox=new zt(new Br,new xi({name:"PMREM.Background",side:Xt,depthWrite:!1,depthTest:!1}));let g=this._backgroundBox,y=g.material,m=!1,d=e.background;if(d){if(d.isColor)y.color.copy(d),e.background=null,m=!0}else y.color.copy(Am),m=!0;for(let b=0;b<6;b++){let S=b%3;if(S===0)a.up.set(0,l[b],0),a.position.set(r.x,r.y,r.z),a.lookAt(r.x+c[b],r.y,r.z);else if(S===1)a.up.set(0,0,l[b]),a.position.set(r.x,r.y,r.z),a.lookAt(r.x,r.y+c[b],r.z);else a.up.set(0,l[b],0),a.position.set(r.x,r.y,r.z),a.lookAt(r.x,r.y,r.z+c[b]);let _=this._cubeSize;if(Vr(i,S*_,b>2?_:0,_,_),h.setRenderTarget(i),m)h.render(g,a);h.render(e,a)}h.toneMapping=u,h.autoClear=f,e.background=d}_textureToCubeUV(e,t){let n=this._renderer,i=e.mapping===Dr||e.mapping===ki;if(i){if(this._cubemapMaterial===null)this._cubemapMaterial=Pm();this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1}else if(this._equirectMaterial===null)this._equirectMaterial=Rm();let r=i?this._cubemapMaterial:this._equirectMaterial,s=this._lodMeshes[0];s.material=r;let o=r.uniforms;o.envMap.value=e;let a=this._cubeSize;Vr(t,0,0,3*a,2*a),n.setRenderTarget(t),n.render(s,Vs)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let i=this._lodMeshes.length;for(let r=1;r<i;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){let i=this._renderer,r=this._pingPongRenderTarget,s=this._ggxMaterial,o=this._lodMeshes[n];o.material=s;let a=s.uniforms,l=n/(this._lodMeshes.length-1),c=t/(this._lodMeshes.length-1),h=Math.sqrt(l*l-c*c),f=l*1.25,u=h*f,{_lodMax:p}=this,g=this._sizeLods[n],y=3*g*(n>p-Wr?n-p+Wr:0),m=4*(this._cubeSize-g);a.envMap.value=e.texture,a.roughness.value=u,a.mipInt.value=p-t,Vr(r,y,m,3*g,2*g),i.setRenderTarget(r),i.render(o,Vs),a.envMap.value=r.texture,a.roughness.value=0,a.mipInt.value=p-n,Vr(e,y,m,3*g,2*g),i.setRenderTarget(e),i.render(o,Vs)}_blur(e,t,n,i){let r=this._pingPongRenderTarget,s=Math.min(i,Math.PI)/Math.SQRT2;this._blurPass(e,r,t,n,s),this._blurPass(r,e,n,n,s)}_blurPass(e,t,n,i,r){let s=this._renderer,o=this._blurMaterial,a=this._lodMeshes[i];a.material=o;let l=o.uniforms;l.envMap.value=e.texture,l.sigma.value=r,l.mipInt.value=this._lodMax-n;let c=this._sizeLods[i],h=3*c*(i>this._lodMax-Wr?i-this._lodMax+Wr:0),f=4*(this._cubeSize-c);Vr(t,h,f,3*c,2*c),s.setRenderTarget(t),s.render(a,Vs)}}function oS(e){let t=[],n=[],i=e,r=e-Wr+1+nS;for(let s=0;s<r;s++){let o=Math.pow(2,i);t.push(o);let a=1/(o-2),l=-a,c=1+a,h=[l,l,c,l,c,c,l,l,c,c,l,c],f=6,u=6,p=3,g=new Float32Array(p*u*f),y=new Float32Array(p*u*f);for(let d=0;d<f;d++){let b=d%3*2/3-1,S=d>2?0:-1,_=[b,S,0,b+0.6666666666666666,S,0,b+0.6666666666666666,S+1,0,b,S,0,b+0.6666666666666666,S+1,0,b,S+1,0];g.set(_,p*u*d);for(let x=0;x<u;x++){let w=h[x*2]*2-1,E=h[x*2+1]*2-1;if(d===0)Qi.set(1,E,w);else if(d===1)Qi.set(-w,1,-E);else if(d===2)Qi.set(-w,E,1);else if(d===3)Qi.set(-1,E,-w);else if(d===4)Qi.set(-w,-1,E);else Qi.set(w,E,-1);Qi.toArray(y,(d*u+x)*p)}}let m=new It;if(m.setAttribute("position",new on(g,p)),m.setAttribute("outputDirection",new on(y,p)),n.push(new zt(m,null)),i>Wr)i--}return{lodMeshes:n,sizeLods:t}}function Cm(e,t,n){let i=new Pt(e,t,n);return i.texture.mapping=As,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Vr(e,t,n,i,r){e.viewport.set(t,n,i,r),e.scissor.set(t,n,i,r)}function aS(e,t,n){return new Tt({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:rS,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Pa(),fragmentShader:`

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
		`,blending:bn,depthTest:!1,depthWrite:!1})}function lS(e,t,n){return new Tt({name:"SphericalGaussianBlur",defines:{SAMPLES:iS,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Pa(),fragmentShader:`

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
		`,blending:bn,depthTest:!1,depthWrite:!1})}function Rm(){return new Tt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Pa(),fragmentShader:`

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
		`,blending:bn,depthTest:!1,depthWrite:!1})}function Pm(){return new Tt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Pa(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:bn,depthTest:!1,depthWrite:!1})}function Pa(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}class zh extends Pt{constructor(e=1,t={}){super(e,e,t);this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];this.texture=new _a(i),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},i=new Br(5,5,5),r=new Tt({name:"CubemapFromEquirect",uniforms:Yi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Xt,blending:bn});r.uniforms.tEquirect.value=t;let s=new zt(i,r),o=t.minFilter;if(t.minFilter===zi)t.minFilter=an;return new Th(1,10,this).update(e,s),t.minFilter=o,s.geometry.dispose(),s.material.dispose(),this}clear(e,t=!0,n=!0,i=!0){let r=e.getRenderTarget();for(let s=0;s<6;s++)e.setRenderTarget(this,s),e.clear(t,n,i);e.setRenderTarget(r)}}function cS(e){let t=new WeakMap,n=new WeakMap,i=null;function r(u,p=!1){if(u===null||u===void 0)return null;if(p)return o(u);return s(u)}function s(u){if(u&&u.isTexture){let p=u.mapping;if(p===Qo||p===ea)if(t.has(u)){let g=t.get(u).texture;return a(g,u.mapping)}else{let g=u.image;if(g&&g.height>0){let y=new zh(g.height);return y.fromEquirectangularTexture(e,u),t.set(u,y),u.addEventListener("dispose",c),a(y.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture){let p=u.mapping,g=p===Qo||p===ea,y=p===Dr||p===ki;if(g||y){let m=n.get(u),d=m!==void 0?m.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==d){if(i===null)i=new Fh(e);return m=g?i.fromEquirectangular(u,m):i.fromCubemap(u,m),m.texture.pmremVersion=u.pmremVersion,n.set(u,m),m.texture}else if(m!==void 0)return m.texture;else{let b=u.image;if(g&&b&&b.height>0||y&&b&&l(b)){if(i===null)i=new Fh(e);return m=g?i.fromEquirectangular(u):i.fromCubemap(u),m.texture.pmremVersion=u.pmremVersion,n.set(u,m),u.addEventListener("dispose",h),m.texture}else return null}}}return u}function a(u,p){if(p===Qo)u.mapping=Dr;else if(p===ea)u.mapping=ki;return u}function l(u){let p=0,g=6;for(let y=0;y<g;y++)if(u[y]!==void 0)p++;return p===g}function c(u){let p=u.target;p.removeEventListener("dispose",c);let g=t.get(p);if(g!==void 0)t.delete(p),g.dispose()}function h(u){let p=u.target;p.removeEventListener("dispose",h);let g=n.get(p);if(g!==void 0)n.delete(p),g.dispose()}function f(){if(t=new WeakMap,n=new WeakMap,i!==null)i.dispose(),i=null}return{get:r,dispose:f}}function hS(e){let t={};function n(i){if(t[i]!==void 0)return t[i];let r=e.getExtension(i);return t[i]=r,r}return{has:function(i){return n(i)!==null},init:function(){n("EXT_color_buffer_float"),n("WEBGL_clip_cull_distance"),n("OES_texture_float_linear"),n("EXT_color_buffer_half_float"),n("WEBGL_multisampled_render_to_texture"),n("WEBGL_render_shared_exponent")},get:function(i){let r=n(i);if(r===null)Bi("WebGLRenderer: "+i+" extension not supported.");return r}}}function uS(e,t,n,i){let r={},s=new WeakMap;function o(f){let u=f.target;if(u.index!==null)t.remove(u.index);for(let g in u.attributes)t.remove(u.attributes[g]);u.removeEventListener("dispose",o),delete r[u.id];let p=s.get(u);if(p)t.remove(p),s.delete(u);if(i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0)delete u._maxInstanceCount;n.memory.geometries--}function a(f,u){if(r[u.id]===!0)return u;return u.addEventListener("dispose",o),r[u.id]=!0,n.memory.geometries++,u}function l(f){let u=f.attributes;for(let p in u)t.update(u[p],e.ARRAY_BUFFER)}function c(f){let u=[],p=f.index,g=f.attributes.position,y=0;if(g===void 0)return;if(p!==null){let b=p.array;y=p.version;for(let S=0,_=b.length;S<_;S+=3){let x=b[S+0],w=b[S+1],E=b[S+2];u.push(x,w,w,E,E,x)}}else{let b=g.array;y=g.version;for(let S=0,_=b.length/3-1;S<_;S+=3){let x=S+0,w=S+1,E=S+2;u.push(x,w,w,E,E,x)}}let m=new(g.count>=65535?pa:da)(u,1);m.version=y;let d=s.get(f);if(d)t.remove(d);s.set(f,m)}function h(f){let u=s.get(f);if(u){let p=f.index;if(p!==null){if(u.version<p.version)c(f)}}else c(f);return s.get(f)}return{get:a,update:l,getWireframeAttribute:h}}function fS(e,t,n){let i;function r(f){i=f}let s,o;function a(f){s=f.type,o=f.bytesPerElement}function l(f,u){e.drawElements(i,u,s,f*o),n.update(u,i,1)}function c(f,u,p){if(p===0)return;e.drawElementsInstanced(i,u,s,f*o,p),n.update(u,i,p)}function h(f,u,p){if(p===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,s,f,0,p);let y=0;for(let m=0;m<p;m++)y+=u[m];n.update(y,i,1)}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function dS(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(n.calls++,o){case e.TRIANGLES:n.triangles+=a*(s/3);break;case e.LINES:n.lines+=a*(s/2);break;case e.LINE_STRIP:n.lines+=a*(s-1);break;case e.LINE_LOOP:n.lines+=a*s;break;case e.POINTS:n.points+=a*s;break;default:De("WebGLInfo: Unknown draw mode:",o);break}}function r(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:r,update:i}}function pS(e,t,n){let i=new WeakMap,r=new gt;function s(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=h!==void 0?h.length:0,u=i.get(a);if(u===void 0||u.count!==f){let A=function(){E.dispose(),i.delete(a),a.removeEventListener("dispose",A)};if(u!==void 0)u.texture.dispose();let p=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,y=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],d=a.morphAttributes.normal||[],b=a.morphAttributes.color||[],S=0;if(p===!0)S=1;if(g===!0)S=2;if(y===!0)S=3;let _=a.attributes.position.count*S,x=1;if(_>t.maxTextureSize)x=Math.ceil(_/t.maxTextureSize),_=t.maxTextureSize;let w=new Float32Array(_*x*4*f),E=new ua(w,_,x,f);E.type=ii,E.needsUpdate=!0;let v=S*4;for(let N=0;N<f;N++){let P=m[N],D=d[N],W=b[N],R=_*x*4*N;for(let I=0;I<P.count;I++){let k=I*v;if(p===!0)r.fromBufferAttribute(P,I),w[R+k+0]=r.x,w[R+k+1]=r.y,w[R+k+2]=r.z,w[R+k+3]=0;if(g===!0)r.fromBufferAttribute(D,I),w[R+k+4]=r.x,w[R+k+5]=r.y,w[R+k+6]=r.z,w[R+k+7]=0;if(y===!0)r.fromBufferAttribute(W,I),w[R+k+8]=r.x,w[R+k+9]=r.y,w[R+k+10]=r.z,w[R+k+11]=W.itemSize===4?r.w:1}}u={count:f,texture:E,size:new re(_,x)},i.set(a,u),a.addEventListener("dispose",A)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(e,"morphTexture",o.morphTexture,n);else{let p=0;for(let y=0;y<c.length;y++)p+=c[y];let g=a.morphTargetsRelative?1:1-p;l.getUniforms().setValue(e,"morphTargetBaseInfluence",g),l.getUniforms().setValue(e,"morphTargetInfluences",c)}l.getUniforms().setValue(e,"morphTargetsTexture",u.texture,n),l.getUniforms().setValue(e,"morphTargetsTextureSize",u.size)}return{update:s}}function mS(e,t,n,i,r){let s=new WeakMap;function o(c){let h=r.render.frame,f=c.geometry,u=t.get(c,f);if(s.get(u)!==h)t.update(u),s.set(u,h);if(c.isInstancedMesh){if(c.hasEventListener("dispose",l)===!1)c.addEventListener("dispose",l);if(s.get(c)!==h){if(n.update(c.instanceMatrix,e.ARRAY_BUFFER),c.instanceColor!==null)n.update(c.instanceColor,e.ARRAY_BUFFER);s.set(c,h)}}if(c.isSkinnedMesh){let p=c.skeleton;if(s.get(p)!==h)p.update(),s.set(p,h)}return u}function a(){s=new WeakMap}function l(c){let h=c.target;if(h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),n.remove(h.instanceMatrix),h.instanceColor!==null)n.remove(h.instanceColor)}return{update:o,dispose:a}}var gS={[xs]:"LINEAR_TONE_MAPPING",[bs]:"REINHARD_TONE_MAPPING",[Ss]:"CINEON_TONE_MAPPING",[Ms]:"ACES_FILMIC_TONE_MAPPING",[Ts]:"AGX_TONE_MAPPING",[Es]:"NEUTRAL_TONE_MAPPING",[ws]:"CUSTOM_TONE_MAPPING"};function _S(e,t,n,i,r,s){let o=new Pt(t,n,{type:e,depthBuffer:r,stencilBuffer:s,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,c=new It;c.setAttribute("position",new mt([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new mt([0,2,0,0,2,0],2));let h=new zs({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),f=new zt(c,h),u=new Ki(-1,1,1,-1,0,1),p=null,g=null,y=!1,m,d=null,b=[],S=!1;this.setSize=function(_,x){if(o.setSize(_,x),a!==null)a.setSize(_,x);if(l!==null)l.setSize(_,x);for(let w=0;w<b.length;w++){let E=b[w];if(E.setSize)E.setSize(_,x)}},this.setEffects=function(_){b=_,S=b.length>0&&b[0].isRenderPass===!0;let{width:x,height:w}=o;if(b.length>0&&a===null)a=new Pt(x,w,{type:qt,depthBuffer:!1,stencilBuffer:!1}),l=new Pt(x,w,{type:qt,depthBuffer:!1,stencilBuffer:!1});for(let E=0;E<b.length;E++){let v=b[E];if(v.setSize)v.setSize(x,w)}},this.begin=function(_,x){if(y)return!1;if(_.toneMapping===Rn&&b.length===0)return!1;if(d=x,x!==null){let{width:w,height:E}=x;if(o.width!==w||o.height!==E)this.setSize(w,E)}if(S===!1)_.setRenderTarget(o);return m=_.toneMapping,_.toneMapping=Rn,!0},this.hasRenderPass=function(){return S},this.end=function(_,x){_.toneMapping=m,y=!0;let w=o,E=a;for(let v=0;v<b.length;v++){let A=b[v];if(A.enabled===!1)continue;if(A.render(_,E,w,x),A.needsSwap!==!1)w=E,E=E===a?l:a}if(p!==_.outputColorSpace||g!==_.toneMapping){if(p=_.outputColorSpace,g=_.toneMapping,h.defines={},We.getTransfer(p)===at)h.defines.SRGB_TRANSFER="";let v=gS[g];if(v)h.defines[v]="";h.needsUpdate=!0}h.uniforms.tDiffuse.value=w.texture,_.setRenderTarget(d),_.render(f,u),d=null,y=!1},this.isCompositing=function(){return y},this.dispose=function(){if(o.dispose(),a!==null)a.dispose();if(l!==null)l.dispose();c.dispose(),h.dispose()}}var Zm=new Ft,Bh=new qi(1,1),Jm=new ua,Km=new Qc,Qm=new _a,Im=[],Lm=[],Dm=new Float32Array(16),Nm=new Float32Array(9),Om=new Float32Array(4);function Xr(e,t,n){let i=e[0];if(i<=0||i>0)return e;let r=t*n,s=Im[r];if(s===void 0)s=new Float32Array(r),Im[r]=s;if(t!==0){i.toArray(s,0);for(let o=1,a=0;o!==t;++o)a+=n,e[o].toArray(s,a)}return s}function Lt(e,t){if(e.length!==t.length)return!1;for(let n=0,i=e.length;n<i;n++)if(e[n]!==t[n])return!1;return!0}function Dt(e,t){for(let n=0,i=t.length;n<i;n++)e[n]=t[n]}function Ia(e,t){let n=Lm[t];if(n===void 0)n=new Int32Array(t),Lm[t]=n;for(let i=0;i!==t;++i)n[i]=e.allocateTextureUnit();return n}function vS(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1f(this.addr,t),n[0]=t}function yS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Lt(n,t))return;e.uniform2fv(this.addr,t),Dt(n,t)}}function xS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else if(t.r!==void 0){if(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b}else{if(Lt(n,t))return;e.uniform3fv(this.addr,t),Dt(n,t)}}function bS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Lt(n,t))return;e.uniform4fv(this.addr,t),Dt(n,t)}}function SS(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Lt(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),Dt(n,t)}else{if(Lt(n,i))return;Om.set(i),e.uniformMatrix2fv(this.addr,!1,Om),Dt(n,i)}}function MS(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Lt(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),Dt(n,t)}else{if(Lt(n,i))return;Nm.set(i),e.uniformMatrix3fv(this.addr,!1,Nm),Dt(n,i)}}function wS(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Lt(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),Dt(n,t)}else{if(Lt(n,i))return;Dm.set(i),e.uniformMatrix4fv(this.addr,!1,Dm),Dt(n,i)}}function TS(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1i(this.addr,t),n[0]=t}function ES(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Lt(n,t))return;e.uniform2iv(this.addr,t),Dt(n,t)}}function AS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else{if(Lt(n,t))return;e.uniform3iv(this.addr,t),Dt(n,t)}}function CS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Lt(n,t))return;e.uniform4iv(this.addr,t),Dt(n,t)}}function RS(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1ui(this.addr,t),n[0]=t}function PS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Lt(n,t))return;e.uniform2uiv(this.addr,t),Dt(n,t)}}function IS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else{if(Lt(n,t))return;e.uniform3uiv(this.addr,t),Dt(n,t)}}function LS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Lt(n,t))return;e.uniform4uiv(this.addr,t),Dt(n,t)}}function DS(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;let s;if(this.type===e.SAMPLER_2D_SHADOW)Bh.compareFunction=n.isReversedDepthBuffer()?ha:ca,s=Bh;else s=Zm;n.setTexture2D(t||s,r)}function NS(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;n.setTexture3D(t||Km,r)}function OS(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;n.setTextureCube(t||Qm,r)}function US(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;n.setTexture2DArray(t||Jm,r)}function FS(e){switch(e){case 5126:return vS;case 35664:return yS;case 35665:return xS;case 35666:return bS;case 35674:return SS;case 35675:return MS;case 35676:return wS;case 5124:case 35670:return TS;case 35667:case 35671:return ES;case 35668:case 35672:return AS;case 35669:case 35673:return CS;case 5125:return RS;case 36294:return PS;case 36295:return IS;case 36296:return LS;case 35678:case 36198:case 36298:case 36306:case 35682:return DS;case 35679:case 36299:case 36307:return NS;case 35680:case 36300:case 36308:case 36293:return OS;case 36289:case 36303:case 36311:case 36292:return US}}function BS(e,t){e.uniform1fv(this.addr,t)}function kS(e,t){let n=Xr(t,this.size,2);e.uniform2fv(this.addr,n)}function zS(e,t){let n=Xr(t,this.size,3);e.uniform3fv(this.addr,n)}function GS(e,t){let n=Xr(t,this.size,4);e.uniform4fv(this.addr,n)}function HS(e,t){let n=Xr(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function VS(e,t){let n=Xr(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function WS(e,t){let n=Xr(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function XS(e,t){e.uniform1iv(this.addr,t)}function qS(e,t){e.uniform2iv(this.addr,t)}function jS(e,t){e.uniform3iv(this.addr,t)}function YS(e,t){e.uniform4iv(this.addr,t)}function $S(e,t){e.uniform1uiv(this.addr,t)}function ZS(e,t){e.uniform2uiv(this.addr,t)}function JS(e,t){e.uniform3uiv(this.addr,t)}function KS(e,t){e.uniform4uiv(this.addr,t)}function QS(e,t,n){let i=this.cache,r=t.length,s=Ia(n,r);if(!Lt(i,s))e.uniform1iv(this.addr,s),Dt(i,s);let o;if(this.type===e.SAMPLER_2D_SHADOW)o=Bh;else o=Zm;for(let a=0;a!==r;++a)n.setTexture2D(t[a]||o,s[a])}function eM(e,t,n){let i=this.cache,r=t.length,s=Ia(n,r);if(!Lt(i,s))e.uniform1iv(this.addr,s),Dt(i,s);for(let o=0;o!==r;++o)n.setTexture3D(t[o]||Km,s[o])}function tM(e,t,n){let i=this.cache,r=t.length,s=Ia(n,r);if(!Lt(i,s))e.uniform1iv(this.addr,s),Dt(i,s);for(let o=0;o!==r;++o)n.setTextureCube(t[o]||Qm,s[o])}function nM(e,t,n){let i=this.cache,r=t.length,s=Ia(n,r);if(!Lt(i,s))e.uniform1iv(this.addr,s),Dt(i,s);for(let o=0;o!==r;++o)n.setTexture2DArray(t[o]||Jm,s[o])}function iM(e){switch(e){case 5126:return BS;case 35664:return kS;case 35665:return zS;case 35666:return GS;case 35674:return HS;case 35675:return VS;case 35676:return WS;case 5124:case 35670:return XS;case 35667:case 35671:return qS;case 35668:case 35672:return jS;case 35669:case 35673:return YS;case 5125:return $S;case 36294:return ZS;case 36295:return JS;case 36296:return KS;case 35678:case 36198:case 36298:case 36306:case 35682:return QS;case 35679:case 36299:case 36307:return eM;case 35680:case 36300:case 36308:case 36293:return tM;case 36289:case 36303:case 36311:case 36292:return nM}}class eg{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=FS(t.type)}}class tg{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=iM(t.type)}}class ng{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let i=this.seq;for(let r=0,s=i.length;r!==s;++r){let o=i[r];o.setValue(e,t[o.id],n)}}}var Oh=/(\w+)(\])?(\[|\.)?/g;function Um(e,t){e.seq.push(t),e.map[t.id]=t}function rM(e,t,n){let i=e.name,r=i.length;Oh.lastIndex=0;while(!0){let s=Oh.exec(i),o=Oh.lastIndex,a=s[1],l=s[2]==="]",c=s[3];if(l)a=a|0;if(c===void 0||c==="["&&o+2===r){Um(n,c===void 0?new eg(a,e,t):new tg(a,e,t));break}else{let f=n.map[a];if(f===void 0)f=new ng(a),Um(n,f);n=f}}}class qs{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){let o=e.getActiveUniform(t,s),a=e.getUniformLocation(t,o.name);rM(o,a,this)}let i=[],r=[];for(let s of this.seq)if(s.type===e.SAMPLER_2D_SHADOW||s.type===e.SAMPLER_CUBE_SHADOW||s.type===e.SAMPLER_2D_ARRAY_SHADOW)i.push(s);else r.push(s);if(i.length>0)this.seq=i.concat(r)}setValue(e,t,n,i){let r=this.map[t];if(r!==void 0)r.setValue(e,n,i)}setOptional(e,t,n){let i=t[n];if(i!==void 0)this.setValue(e,n,i)}static upload(e,t,n,i){for(let r=0,s=t.length;r!==s;++r){let o=t[r],a=n[o.id];if(a.needsUpdate!==!1)o.setValue(e,a.value,i)}}static seqWithValue(e,t){let n=[];for(let i=0,r=e.length;i!==r;++i){let s=e[i];if(s.id in t)n.push(s)}return n}}function Fm(e,t,n){let i=e.createShader(t);return e.shaderSource(i,n),e.compileShader(i),i}var sM=37297,oM=0;function aM(e,t){let n=e.split(`
`),i=[],r=Math.max(t-6,0),s=Math.min(t+6,n.length);for(let o=r;o<s;o++){let a=o+1;i.push(`${a===t?">":" "} ${a}: ${n[o]}`)}return i.join(`
`)}var Bm=new Be;function lM(e){We._getMatrix(Bm,We.workingColorSpace,e);let t=`mat3( ${Bm.elements.map((n)=>n.toFixed(4))} )`;switch(We.getTransfer(e)){case jc:return[t,"LinearTransferOETF"];case at:return[t,"sRGBTransferOETF"];default:return Ie("WebGLProgram: Unsupported color space: ",e),[t,"LinearTransferOETF"]}}function km(e,t,n){let i=e.getShaderParameter(t,e.COMPILE_STATUS),s=(e.getShaderInfoLog(t)||"").trim();if(i&&s==="")return"";let o=/ERROR: 0:(\d+)/.exec(s);if(o){let a=parseInt(o[1]);return n.toUpperCase()+`

`+s+`

`+aM(e.getShaderSource(t),a)}else return s}function cM(e,t){let n=lM(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,"}"].join(`
`)}var hM={[xs]:"Linear",[bs]:"Reinhard",[Ss]:"Cineon",[Ms]:"ACESFilmic",[Ts]:"AgX",[Es]:"Neutral",[ws]:"Custom"};function uM(e,t){let n=hM[t];if(n===void 0)return Ie("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }";return"vec3 "+e+"( vec3 color ) { return "+n+"ToneMapping( color ); }"}var Ra=new L;function fM(){We.getLuminanceCoefficients(Ra);let e=Ra.x.toFixed(4),t=Ra.y.toFixed(4),n=Ra.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${t}, ${n} );`,"\treturn dot( weights, rgb );","}"].join(`
`)}function dM(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Xs).join(`
`)}function pM(e){let t=[];for(let n in e){let i=e[n];if(i===!1)continue;t.push("#define "+n+" "+i)}return t.join(`
`)}function mM(e,t){let n={},i=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){let s=e.getActiveAttrib(t,r),o=s.name,a=1;if(s.type===e.FLOAT_MAT2)a=2;if(s.type===e.FLOAT_MAT3)a=3;if(s.type===e.FLOAT_MAT4)a=4;n[o]={type:s.type,location:e.getAttribLocation(t,o),locationSize:a}}return n}function Xs(e){return e!==""}function zm(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Gm(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var gM=/^[ \t]*#include +<([\w\d./]+)>/gm;function kh(e){return e.replace(gM,vM)}var _M=new Map;function vM(e,t){let n=Ve[t];if(n===void 0){let i=_M.get(t);if(i!==void 0)n=Ve[i],Ie('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return kh(n)}var yM=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Hm(e){return e.replace(yM,xM)}function xM(e,t,n,i){let r="";for(let s=parseInt(t);s<parseInt(n);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function Vm(e){let t=`precision ${e.precision} float;
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
#define LOW_PRECISION`;return t}var bM={[_s]:"SHADOWMAP_TYPE_PCF",[Pr]:"SHADOWMAP_TYPE_VSM"};function SM(e){return bM[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var MM={[Dr]:"ENVMAP_TYPE_CUBE",[ki]:"ENVMAP_TYPE_CUBE",[As]:"ENVMAP_TYPE_CUBE_UV"};function wM(e){if(e.envMap===!1)return"ENVMAP_TYPE_CUBE";return MM[e.envMapMode]||"ENVMAP_TYPE_CUBE"}var TM={[ki]:"ENVMAP_MODE_REFRACTION"};function EM(e){if(e.envMap===!1)return"ENVMAP_MODE_REFLECTION";return TM[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}var AM={[Jp]:"ENVMAP_BLENDING_MULTIPLY",[Kp]:"ENVMAP_BLENDING_MIX",[Qp]:"ENVMAP_BLENDING_ADD"};function CM(e){if(e.envMap===!1)return"ENVMAP_BLENDING_NONE";return AM[e.combine]||"ENVMAP_BLENDING_NONE"}function RM(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,n),112)),texelHeight:i,maxMip:n}}function PM(e,t,n,i){let r=e.getContext(),{defines:s,vertexShader:o,fragmentShader:a}=n,l=SM(n),c=wM(n),h=EM(n),f=CM(n),u=RM(n),p=dM(n),g=pM(s),y=r.createProgram(),m,d,b=n.glslVersion?"#version "+n.glslVersion+`
`:"";if(n.isRawShaderMaterial){if(m=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(Xs).join(`
`),m.length>0)m+=`
`;if(d=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(Xs).join(`
`),d.length>0)d+=`
`}else m=[Vm(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",n.batching?"#define USE_BATCHING":"",n.batchingColor?"#define USE_BATCHING_COLOR":"",n.instancing?"#define USE_INSTANCING":"",n.instancingColor?"#define USE_INSTANCING_COLOR":"",n.instancingMorph?"#define USE_INSTANCING_MORPH":"",n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.map?"#define USE_MAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+h:"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.displacementMap?"#define USE_DISPLACEMENTMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.mapUv?"#define MAP_UV "+n.mapUv:"",n.alphaMapUv?"#define ALPHAMAP_UV "+n.alphaMapUv:"",n.lightMapUv?"#define LIGHTMAP_UV "+n.lightMapUv:"",n.aoMapUv?"#define AOMAP_UV "+n.aoMapUv:"",n.emissiveMapUv?"#define EMISSIVEMAP_UV "+n.emissiveMapUv:"",n.bumpMapUv?"#define BUMPMAP_UV "+n.bumpMapUv:"",n.normalMapUv?"#define NORMALMAP_UV "+n.normalMapUv:"",n.displacementMapUv?"#define DISPLACEMENTMAP_UV "+n.displacementMapUv:"",n.metalnessMapUv?"#define METALNESSMAP_UV "+n.metalnessMapUv:"",n.roughnessMapUv?"#define ROUGHNESSMAP_UV "+n.roughnessMapUv:"",n.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+n.anisotropyMapUv:"",n.clearcoatMapUv?"#define CLEARCOATMAP_UV "+n.clearcoatMapUv:"",n.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+n.clearcoatNormalMapUv:"",n.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+n.clearcoatRoughnessMapUv:"",n.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+n.iridescenceMapUv:"",n.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+n.iridescenceThicknessMapUv:"",n.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+n.sheenColorMapUv:"",n.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+n.sheenRoughnessMapUv:"",n.specularMapUv?"#define SPECULARMAP_UV "+n.specularMapUv:"",n.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+n.specularColorMapUv:"",n.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+n.specularIntensityMapUv:"",n.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+n.transmissionMapUv:"",n.thicknessMapUv?"#define THICKNESSMAP_UV "+n.thicknessMapUv:"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexNormals?"#define HAS_NORMAL":"",n.vertexColors?"#define USE_COLOR":"",n.vertexAlphas?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.flatShading?"#define FLAT_SHADED":"",n.skinning?"#define USE_SKINNING":"",n.morphTargets?"#define USE_MORPHTARGETS":"",n.morphNormals&&n.flatShading===!1?"#define USE_MORPHNORMALS":"",n.morphColors?"#define USE_MORPHCOLORS":"",n.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+n.morphTextureStride:"",n.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+n.morphTargetsCount:"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.sizeAttenuation?"#define USE_SIZEATTENUATION":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","\tattribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","\tattribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","\tuniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","\tattribute vec2 uv1;","#endif","#ifdef USE_UV2","\tattribute vec2 uv2;","#endif","#ifdef USE_UV3","\tattribute vec2 uv3;","#endif","#ifdef USE_TANGENT","\tattribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","\tattribute vec4 color;","#elif defined( USE_COLOR )","\tattribute vec3 color;","#endif","#ifdef USE_SKINNING","\tattribute vec4 skinIndex;","\tattribute vec4 skinWeight;","#endif",`
`].filter(Xs).join(`
`),d=[Vm(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",n.map?"#define USE_MAP":"",n.matcap?"#define USE_MATCAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+c:"",n.envMap?"#define "+h:"",n.envMap?"#define "+f:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoat?"#define USE_CLEARCOAT":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.dispersion?"#define USE_DISPERSION":"",n.retroreflection?"#define USE_RETROREFLECTION":"",n.iridescence?"#define USE_IRIDESCENCE":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaTest?"#define USE_ALPHATEST":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.sheen?"#define USE_SHEEN":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexColors||n.instancingColor?"#define USE_COLOR":"",n.vertexAlphas||n.batchingColor?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.gradientMap?"#define USE_GRADIENTMAP":"",n.flatShading?"#define FLAT_SHADED":"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",n.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",n.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",n.toneMapping!==Rn?"#define TONE_MAPPING":"",n.toneMapping!==Rn?Ve.tonemapping_pars_fragment:"",n.toneMapping!==Rn?uM("toneMapping",n.toneMapping):"",n.dithering?"#define DITHERING":"",n.opaque?"#define OPAQUE":"",Ve.colorspace_pars_fragment,cM("linearToOutputTexel",n.outputColorSpace),fM(),n.useDepthPacking?"#define DEPTH_PACKING "+n.depthPacking:"",`
`].filter(Xs).join(`
`);if(o=kh(o),o=zm(o,n),o=Gm(o,n),a=kh(a),a=zm(a,n),a=Gm(a,n),o=Hm(o),a=Hm(a),n.isRawShaderMaterial!==!0)b=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,d=["#define varying in",n.glslVersion===Yc?"":"layout(location = 0) out highp vec4 pc_fragColor;",n.glslVersion===Yc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+d;let S=b+m+o,_=b+d+a,x=Fm(r,r.VERTEX_SHADER,S),w=Fm(r,r.FRAGMENT_SHADER,_);if(r.attachShader(y,x),r.attachShader(y,w),n.index0AttributeName!==void 0)r.bindAttribLocation(y,0,n.index0AttributeName);else if(n.hasPositionAttribute===!0)r.bindAttribLocation(y,0,"position");r.linkProgram(y);function E(P){if(e.debug.checkShaderErrors){let D=r.getProgramInfoLog(y)||"",W=r.getShaderInfoLog(x)||"",R=r.getShaderInfoLog(w)||"",I=D.trim(),k=W.trim(),z=R.trim(),te=!0,Y=!0;if(r.getProgramParameter(y,r.LINK_STATUS)===!1)if(te=!1,typeof e.debug.onShaderError==="function")e.debug.onShaderError(r,y,x,w);else{let Q=km(r,x,"vertex"),G=km(r,w,"fragment");De("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(y,r.VALIDATE_STATUS)+`

Material Name: `+P.name+`
Material Type: `+P.type+`

Program Info Log: `+I+`
`+Q+`
`+G)}else if(I!=="")Ie("WebGLProgram: Program Info Log:",I);else if(k===""||z==="")Y=!1;if(Y)P.diagnostics={runnable:te,programLog:I,vertexShader:{log:k,prefix:m},fragmentShader:{log:z,prefix:d}}}r.deleteShader(x),r.deleteShader(w),v=new qs(r,y),A=mM(r,y)}let v;this.getUniforms=function(){if(v===void 0)E(this);return v};let A;this.getAttributes=function(){if(A===void 0)E(this);return A};let N=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){if(N===!1)N=r.getProgramParameter(y,sM);return N},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(y),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=oM++,this.cacheKey=t,this.usedTimes=1,this.program=y,this.vertexShader=x,this.fragmentShader=w,this}var IM=0;class ig{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let i=this._getShaderCacheForMaterial(e);if(i.has(t)===!1)i.add(t),t.usedTimes++;if(i.has(n)===!1)i.add(n),n.usedTimes++;return this}remove(e){let t=this.materialCache.get(e);for(let n of t)if(n.usedTimes--,n.usedTimes===0)this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);if(n===void 0)n=new Set,t.set(e,n);return n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);if(n===void 0)n=new rg(e),t.set(e,n);return n}}class rg{constructor(e){this.id=IM++,this.code=e,this.usedTimes=0}}function LM(e){return e===Vi||e===aa||e===la}function DM(e,t,n,i,r,s){let o=new Is,a=new ig,l=new Set,c=[],h=new Map,{logarithmicDepthBuffer:f,precision:u}=i,p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(v){if(l.add(v),v===0)return"uv";return`uv${v}`}function y(v,A,N,P,D,W){let R=P.fog,I=D.geometry,k=v.isMeshStandardMaterial||v.isMeshLambertMaterial||v.isMeshPhongMaterial?P.environment:null,z=v.isMeshStandardMaterial||v.isMeshLambertMaterial&&!v.envMap||v.isMeshPhongMaterial&&!v.envMap,te=t.get(v.envMap||k,z),Y=!!te&&te.mapping===As?te.image.height:null,Q=p[v.type];if(v.precision!==null){if(u=i.getMaxPrecision(v.precision),u!==v.precision)Ie("WebGLProgram.getParameters:",v.precision,"not supported, using",u,"instead.")}let G=I.morphAttributes.position||I.morphAttributes.normal||I.morphAttributes.color,ee=G!==void 0?G.length:0,oe=0;if(I.morphAttributes.position!==void 0)oe=1;if(I.morphAttributes.normal!==void 0)oe=2;if(I.morphAttributes.color!==void 0)oe=3;let Ue,Re,X,se;if(Q){let ut=Vn[Q];Ue=ut.vertexShader,Re=ut.fragmentShader}else{Ue=v.vertexShader,Re=v.fragmentShader;let ut=a.getVertexShaderStage(v),nt=a.getFragmentShaderStage(v);a.update(v,ut,nt),X=ut.id,se=nt.id}let le=e.getRenderTarget(),Pe=e.state.buffers.depth.getReversed(),Oe=D.isInstancedMesh===!0,Ae=D.isBatchedMesh===!0,Et=!!v.map,qe=!!v.matcap,je=!!te,rt=!!v.aoMap,Ye=!!v.lightMap,Bt=!!v.bumpMap&&v.wireframe===!1,dt=!!v.normalMap,tn=!!v.displacementMap,At=!!v.emissiveMap,Ct=!!v.metalnessMap,U=!!v.roughnessMap,nn=v.anisotropy>0,tt=v.clearcoat>0,yt=v.dispersion>0,C=v.retroreflectivity>0,M=v.iridescence>0,O=v.sheen>0,q=v.transmission>0,ie=nn&&!!v.anisotropyMap,ce=tt&&!!v.clearcoatMap,fe=tt&&!!v.clearcoatNormalMap,Z=tt&&!!v.clearcoatRoughnessMap,K=M&&!!v.iridescenceMap,ve=M&&!!v.iridescenceThicknessMap,Ee=O&&!!v.sheenColorMap,de=O&&!!v.sheenRoughnessMap,ae=!!v.specularMap,Ce=!!v.specularColorMap,Le=!!v.specularIntensityMap,Je=q&&!!v.transmissionMap,B=q&&!!v.thicknessMap,he=!!v.gradientMap,J=!!v.alphaMap,ue=v.alphaTest>0,ye=!!v.alphaHash,ne=!!v.extensions,me=Rn;if(v.toneMapped){if(le===null||le.isXRRenderTarget===!0)me=e.toneMapping}let ke={shaderID:Q,shaderType:v.type,shaderName:v.name,vertexShader:Ue,fragmentShader:Re,defines:v.defines,customVertexShaderID:X,customFragmentShaderID:se,isRawShaderMaterial:v.isRawShaderMaterial===!0,glslVersion:v.glslVersion,precision:u,batching:Ae,batchingColor:Ae&&D._colorsTexture!==null,instancing:Oe,instancingColor:Oe&&D.instanceColor!==null,instancingMorph:Oe&&D.morphTexture!==null,outputColorSpace:le===null?e.outputColorSpace:le.isXRRenderTarget===!0?le.texture.colorSpace:We.workingColorSpace,alphaToCoverage:!!v.alphaToCoverage,map:Et,matcap:qe,envMap:je,envMapMode:je&&te.mapping,envMapCubeUVHeight:Y,aoMap:rt,lightMap:Ye,bumpMap:Bt,normalMap:dt,displacementMap:tn,emissiveMap:At,normalMapObjectSpace:dt&&v.normalMapType===hm,normalMapTangentSpace:dt&&v.normalMapType===Xc,packedNormalMap:dt&&v.normalMapType===Xc&&LM(v.normalMap.format),metalnessMap:Ct,roughnessMap:U,anisotropy:nn,anisotropyMap:ie,clearcoat:tt,clearcoatMap:ce,clearcoatNormalMap:fe,clearcoatRoughnessMap:Z,dispersion:yt,retroreflection:C,iridescence:M,iridescenceMap:K,iridescenceThicknessMap:ve,sheen:O,sheenColorMap:Ee,sheenRoughnessMap:de,specularMap:ae,specularColorMap:Ce,specularIntensityMap:Le,transmission:q,transmissionMap:Je,thicknessMap:B,gradientMap:he,opaque:v.transparent===!1&&v.blending===vs&&v.alphaToCoverage===!1,alphaMap:J,alphaTest:ue,alphaHash:ye,combine:v.combine,mapUv:Et&&g(v.map.channel),aoMapUv:rt&&g(v.aoMap.channel),lightMapUv:Ye&&g(v.lightMap.channel),bumpMapUv:Bt&&g(v.bumpMap.channel),normalMapUv:dt&&g(v.normalMap.channel),displacementMapUv:tn&&g(v.displacementMap.channel),emissiveMapUv:At&&g(v.emissiveMap.channel),metalnessMapUv:Ct&&g(v.metalnessMap.channel),roughnessMapUv:U&&g(v.roughnessMap.channel),anisotropyMapUv:ie&&g(v.anisotropyMap.channel),clearcoatMapUv:ce&&g(v.clearcoatMap.channel),clearcoatNormalMapUv:fe&&g(v.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Z&&g(v.clearcoatRoughnessMap.channel),iridescenceMapUv:K&&g(v.iridescenceMap.channel),iridescenceThicknessMapUv:ve&&g(v.iridescenceThicknessMap.channel),sheenColorMapUv:Ee&&g(v.sheenColorMap.channel),sheenRoughnessMapUv:de&&g(v.sheenRoughnessMap.channel),specularMapUv:ae&&g(v.specularMap.channel),specularColorMapUv:Ce&&g(v.specularColorMap.channel),specularIntensityMapUv:Le&&g(v.specularIntensityMap.channel),transmissionMapUv:Je&&g(v.transmissionMap.channel),thicknessMapUv:B&&g(v.thicknessMap.channel),alphaMapUv:J&&g(v.alphaMap.channel),vertexTangents:!!I.attributes.tangent&&(dt||nn),vertexNormals:!!I.attributes.normal,vertexColors:v.vertexColors,vertexAlphas:v.vertexColors===!0&&!!I.attributes.color&&I.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!I.attributes.uv&&(Et||J),fog:!!R,useFog:v.fog===!0,fogExp2:!!R&&R.isFogExp2,flatShading:v.wireframe===!1&&(v.flatShading===!0||I.attributes.normal===void 0&&dt===!1&&(v.isMeshLambertMaterial||v.isMeshPhongMaterial||v.isMeshStandardMaterial||v.isMeshPhysicalMaterial)),sizeAttenuation:v.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:Pe,skinning:D.isSkinnedMesh===!0,hasPositionAttribute:I.attributes.position!==void 0,morphTargets:I.morphAttributes.position!==void 0,morphNormals:I.morphAttributes.normal!==void 0,morphColors:I.morphAttributes.color!==void 0,morphTargetsCount:ee,morphTextureStride:oe,numSunLights:A.sun.length,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numSunLightShadows:A.sunShadowMap.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:W.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:v.dithering,shadowMapEnabled:e.shadowMap.enabled&&N.length>0,shadowMapType:e.shadowMap.type,toneMapping:me,decodeVideoTexture:Et&&v.map.isVideoTexture===!0&&We.getTransfer(v.map.colorSpace)===at,decodeVideoTextureEmissive:At&&v.emissiveMap.isVideoTexture===!0&&We.getTransfer(v.emissiveMap.colorSpace)===at,premultipliedAlpha:v.premultipliedAlpha,doubleSided:v.side===Bn,flipSided:v.side===Xt,useDepthPacking:v.depthPacking>=0,depthPacking:v.depthPacking||0,index0AttributeName:v.index0AttributeName,extensionClipCullDistance:ne&&v.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ne&&v.extensions.multiDraw===!0||Ae)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:v.customProgramCacheKey()};return ke.vertexUv1s=l.has(1),ke.vertexUv2s=l.has(2),ke.vertexUv3s=l.has(3),l.clear(),ke}function m(v){let A=[];if(v.shaderID)A.push(v.shaderID);else A.push(v.customVertexShaderID),A.push(v.customFragmentShaderID);if(v.defines!==void 0)for(let N in v.defines)A.push(N),A.push(v.defines[N]);if(v.isRawShaderMaterial===!1)d(A,v),b(A,v),A.push(e.outputColorSpace);return A.push(v.customProgramCacheKey),A.join()}function d(v,A){v.push(A.precision),v.push(A.outputColorSpace),v.push(A.envMapMode),v.push(A.envMapCubeUVHeight),v.push(A.mapUv),v.push(A.alphaMapUv),v.push(A.lightMapUv),v.push(A.aoMapUv),v.push(A.bumpMapUv),v.push(A.normalMapUv),v.push(A.displacementMapUv),v.push(A.emissiveMapUv),v.push(A.metalnessMapUv),v.push(A.roughnessMapUv),v.push(A.anisotropyMapUv),v.push(A.clearcoatMapUv),v.push(A.clearcoatNormalMapUv),v.push(A.clearcoatRoughnessMapUv),v.push(A.iridescenceMapUv),v.push(A.iridescenceThicknessMapUv),v.push(A.sheenColorMapUv),v.push(A.sheenRoughnessMapUv),v.push(A.specularMapUv),v.push(A.specularColorMapUv),v.push(A.specularIntensityMapUv),v.push(A.transmissionMapUv),v.push(A.thicknessMapUv),v.push(A.combine),v.push(A.fogExp2),v.push(A.sizeAttenuation),v.push(A.morphTargetsCount),v.push(A.morphAttributeCount),v.push(A.numSunLights),v.push(A.numDirLights),v.push(A.numPointLights),v.push(A.numSpotLights),v.push(A.numSpotLightMaps),v.push(A.numHemiLights),v.push(A.numRectAreaLights),v.push(A.numSunLightShadows),v.push(A.numDirLightShadows),v.push(A.numPointLightShadows),v.push(A.numSpotLightShadows),v.push(A.numSpotLightShadowsWithMaps),v.push(A.numLightProbes),v.push(A.shadowMapType),v.push(A.toneMapping),v.push(A.numClippingPlanes),v.push(A.numClipIntersection),v.push(A.depthPacking)}function b(v,A){if(o.disableAll(),A.instancing)o.enable(0);if(A.instancingColor)o.enable(1);if(A.instancingMorph)o.enable(2);if(A.matcap)o.enable(3);if(A.envMap)o.enable(4);if(A.normalMapObjectSpace)o.enable(5);if(A.normalMapTangentSpace)o.enable(6);if(A.clearcoat)o.enable(7);if(A.iridescence)o.enable(8);if(A.alphaTest)o.enable(9);if(A.vertexColors)o.enable(10);if(A.vertexAlphas)o.enable(11);if(A.vertexUv1s)o.enable(12);if(A.vertexUv2s)o.enable(13);if(A.vertexUv3s)o.enable(14);if(A.vertexTangents)o.enable(15);if(A.anisotropy)o.enable(16);if(A.alphaHash)o.enable(17);if(A.batching)o.enable(18);if(A.dispersion)o.enable(19);if(A.retroreflection)o.enable(24);if(A.batchingColor)o.enable(20);if(A.gradientMap)o.enable(21);if(A.packedNormalMap)o.enable(22);if(A.vertexNormals)o.enable(23);if(v.push(o.mask),o.disableAll(),A.fog)o.enable(0);if(A.useFog)o.enable(1);if(A.flatShading)o.enable(2);if(A.logarithmicDepthBuffer)o.enable(3);if(A.reversedDepthBuffer)o.enable(4);if(A.skinning)o.enable(5);if(A.morphTargets)o.enable(6);if(A.morphNormals)o.enable(7);if(A.morphColors)o.enable(8);if(A.premultipliedAlpha)o.enable(9);if(A.shadowMapEnabled)o.enable(10);if(A.doubleSided)o.enable(11);if(A.flipSided)o.enable(12);if(A.useDepthPacking)o.enable(13);if(A.dithering)o.enable(14);if(A.transmission)o.enable(15);if(A.sheen)o.enable(16);if(A.opaque)o.enable(17);if(A.pointsUvs)o.enable(18);if(A.decodeVideoTexture)o.enable(19);if(A.decodeVideoTextureEmissive)o.enable(20);if(A.alphaToCoverage)o.enable(21);if(A.numLightProbeGrids>0)o.enable(22);if(A.hasPositionAttribute)o.enable(23);v.push(o.mask)}function S(v){let A=p[v.type],N;if(A){let P=Vn[A];N=si.clone(P.uniforms)}else N=v.uniforms;return N}function _(v,A){let N=h.get(A);if(N!==void 0)++N.usedTimes;else N=new PM(e,A,v,r),c.push(N),h.set(A,N);return N}function x(v){if(--v.usedTimes===0){let A=c.indexOf(v);c[A]=c[c.length-1],c.pop(),h.delete(v.cacheKey),v.destroy()}}function w(v){a.remove(v)}function E(){a.dispose()}return{getParameters:y,getProgramCacheKey:m,getUniforms:S,acquireProgram:_,releaseProgram:x,releaseShaderCache:w,programs:c,dispose:E}}function NM(){let e=new WeakMap;function t(o){return e.has(o)}function n(o){let a=e.get(o);if(a===void 0)a={},e.set(o,a);return a}function i(o){e.delete(o)}function r(o,a,l){e.get(o)[a]=l}function s(){e=new WeakMap}return{has:t,get:n,remove:i,update:r,dispose:s}}function OM(e,t){if(e.groupOrder!==t.groupOrder)return e.groupOrder-t.groupOrder;else if(e.renderOrder!==t.renderOrder)return e.renderOrder-t.renderOrder;else if(e.material.id!==t.material.id)return e.material.id-t.material.id;else if(e.materialVariant!==t.materialVariant)return e.materialVariant-t.materialVariant;else if(e.z!==t.z)return e.z-t.z;else return e.id-t.id}function Wm(e,t){if(e.groupOrder!==t.groupOrder)return e.groupOrder-t.groupOrder;else if(e.renderOrder!==t.renderOrder)return e.renderOrder-t.renderOrder;else if(e.z!==t.z)return t.z-e.z;else return e.id-t.id}function Xm(){let e=[],t=0,n=[],i=[],r=[];function s(){t=0,n.length=0,i.length=0,r.length=0}function o(u){let p=0;if(u.isInstancedMesh)p+=2;if(u.isSkinnedMesh)p+=1;return p}function a(u,p,g,y,m,d){let b=e[t];if(b===void 0)b={id:u.id,object:u,geometry:p,material:g,materialVariant:o(u),groupOrder:y,renderOrder:u.renderOrder,z:m,group:d},e[t]=b;else b.id=u.id,b.object=u,b.geometry=p,b.material=g,b.materialVariant=o(u),b.groupOrder=y,b.renderOrder=u.renderOrder,b.z=m,b.group=d;return t++,b}function l(u,p,g,y,m,d,b){if(b.reversedDepth===!0)m=-m;let S=a(u,p,g,y,m,d);if(g.transmission>0)i.push(S);else if(g.transparent===!0)r.push(S);else n.push(S)}function c(u,p,g,y,m,d){let b=a(u,p,g,y,m,d);if(g.transmission>0)i.unshift(b);else if(g.transparent===!0)r.unshift(b);else n.unshift(b)}function h(u,p){if(n.length>1)n.sort(u||OM);if(i.length>1)i.sort(p||Wm);if(r.length>1)r.sort(p||Wm)}function f(){for(let u=t,p=e.length;u<p;u++){let g=e[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:n,transmissive:i,transparent:r,init:s,push:l,unshift:c,finish:f,sort:h}}function UM(){let e=new WeakMap;function t(i,r){let s=e.get(i),o;if(s===void 0)o=new Xm,e.set(i,[o]);else if(r>=s.length)o=new Xm,s.push(o);else o=s[r];return o}function n(){e=new WeakMap}return{get:t,dispose:n}}function FM(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"SunLight":case"DirectionalLight":n={direction:new L,color:new Fe};break;case"SpotLight":n={position:new L,direction:new L,color:new Fe,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":n={position:new L,color:new Fe,distance:0,decay:0};break;case"HemisphereLight":n={direction:new L,skyColor:new Fe,groundColor:new Fe};break;case"RectAreaLight":n={color:new Fe,position:new L,halfWidth:new L,halfHeight:new L};break}return e[t.id]=n,n}}}function BM(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"SunLight":case"DirectionalLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new re};break;case"SpotLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new re};break;case"PointLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new re,shadowCameraNear:1,shadowCameraFar:1000};break}return e[t.id]=n,n}}}var kM=0;function zM(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+(t.map?1:0)-(e.map?1:0)}function GM(e){let t=new FM,n=BM(),i={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new L);let r=new L,s=new Ke,o=new Ke;function a(c){let h=0,f=0,u=0;for(let D=0;D<9;D++)i.probe[D].set(0,0,0);let p=0,g=0,y=0,m=0,d=0,b=0,S=0,_=0,x=0,w=0,E=0,v=0,A=0,N=0;c.sort(zM);for(let D=0,W=c.length;D<W;D++){let R=c[D],{color:I,intensity:k,distance:z}=R,te=null;if(R.shadow&&R.shadow.map)if(R.shadow.map.texture.format===Vi)te=R.shadow.map.texture;else te=R.shadow.map.depthTexture||R.shadow.map.texture;if(R.isAmbientLight)h+=I.r*k,f+=I.g*k,u+=I.b*k;else if(R.isLightProbe){for(let Y=0;Y<9;Y++)i.probe[Y].addScaledVector(R.sh.coefficients[Y],k);N++}else if(R.isSunLight){let Y=t.get(R);if(Y.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){let Q=R.shadow,G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize.copy(Q.mapSize).multiply(Q.getFrameExtents()),i.sunShadow[g]=G,i.sunShadowMap[g]=te;let ee=Q.getViewportCount();for(let oe=0;oe<ee;oe++)i.sunShadowMatrix[y+oe]=Q.getMatrix(oe),i.sunShadowCascade[y+oe]=Q._cascadeData[oe];y+=ee,g++}i.sun[p]=Y,p++}else if(R.isDirectionalLight){let Y=t.get(R);if(Y.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){let Q=R.shadow,G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize=Q.mapSize,i.directionalShadow[m]=G,i.directionalShadowMap[m]=te,i.directionalShadowMatrix[m]=R.shadow.matrix,x++}i.directional[m]=Y,m++}else if(R.isSpotLight){let Y=t.get(R);Y.position.setFromMatrixPosition(R.matrixWorld),Y.color.copy(I).multiplyScalar(k),Y.distance=z,Y.coneCos=Math.cos(R.angle),Y.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),Y.decay=R.decay,i.spot[b]=Y;let Q=R.shadow;if(R.map){if(i.spotLightMap[v]=R.map,v++,Q.updateMatrices(R),R.castShadow)A++}if(i.spotLightMatrix[b]=Q.matrix,R.castShadow){let G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize=Q.mapSize,i.spotShadow[b]=G,i.spotShadowMap[b]=te,E++}b++}else if(R.isRectAreaLight){let Y=t.get(R);Y.color.copy(I).multiplyScalar(k),Y.halfWidth.set(R.width*0.5,0,0),Y.halfHeight.set(0,R.height*0.5,0),i.rectArea[S]=Y,S++}else if(R.isPointLight){let Y=t.get(R);if(Y.color.copy(R.color).multiplyScalar(R.intensity),Y.distance=R.distance,Y.decay=R.decay,R.castShadow){let Q=R.shadow,G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize=Q.mapSize,G.shadowCameraNear=Q.camera.near,G.shadowCameraFar=Q.camera.far,i.pointShadow[d]=G,i.pointShadowMap[d]=te,i.pointShadowMatrix[d]=R.shadow.matrix,w++}i.point[d]=Y,d++}else if(R.isHemisphereLight){let Y=t.get(R);Y.skyColor.copy(R.color).multiplyScalar(k),Y.groundColor.copy(R.groundColor).multiplyScalar(k),i.hemi[_]=Y,_++}}if(S>0)if(e.has("OES_texture_float_linear")===!0)i.rectAreaLTC1=pe.LTC_FLOAT_1,i.rectAreaLTC2=pe.LTC_FLOAT_2;else i.rectAreaLTC1=pe.LTC_HALF_1,i.rectAreaLTC2=pe.LTC_HALF_2;i.ambient[0]=h,i.ambient[1]=f,i.ambient[2]=u;let P=i.hash;if(P.sunLength!==p||P.directionalLength!==m||P.pointLength!==d||P.spotLength!==b||P.rectAreaLength!==S||P.hemiLength!==_||P.numSunShadows!==g||P.numDirectionalShadows!==x||P.numPointShadows!==w||P.numSpotShadows!==E||P.numSpotMaps!==v||P.numLightProbes!==N)i.sun.length=p,i.directional.length=m,i.spot.length=b,i.rectArea.length=S,i.point.length=d,i.hemi.length=_,i.sunShadow.length=g,i.sunShadowMap.length=g,i.sunShadowMatrix.length=y,i.sunShadowCascade.length=y,i.directionalShadow.length=x,i.directionalShadowMap.length=x,i.directionalShadowMatrix.length=x,i.pointShadow.length=w,i.pointShadowMap.length=w,i.pointShadowMatrix.length=w,i.spotShadow.length=E,i.spotShadowMap.length=E,i.spotLightMatrix.length=E+v-A,i.spotLightMap.length=v,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=N,P.sunLength=p,P.directionalLength=m,P.pointLength=d,P.spotLength=b,P.rectAreaLength=S,P.hemiLength=_,P.numSunShadows=g,P.numDirectionalShadows=x,P.numPointShadows=w,P.numSpotShadows=E,P.numSpotMaps=v,P.numLightProbes=N,i.version=kM++}function l(c,h){let f=0,u=0,p=0,g=0,y=0,m=0,d=h.matrixWorldInverse;for(let b=0,S=c.length;b<S;b++){let _=c[b];if(_.isSunLight){let x=i.sun[f];x.direction.setFromMatrixPosition(_.matrixWorld),x.direction.transformDirection(d),f++}else if(_.isDirectionalLight){let x=i.directional[u];x.direction.setFromMatrixPosition(_.matrixWorld),r.setFromMatrixPosition(_.target.matrixWorld),x.direction.sub(r),x.direction.transformDirection(d),u++}else if(_.isSpotLight){let x=i.spot[g];x.position.setFromMatrixPosition(_.matrixWorld),x.position.applyMatrix4(d),x.direction.setFromMatrixPosition(_.matrixWorld),r.setFromMatrixPosition(_.target.matrixWorld),x.direction.sub(r),x.direction.transformDirection(d),g++}else if(_.isRectAreaLight){let x=i.rectArea[y];x.position.setFromMatrixPosition(_.matrixWorld),x.position.applyMatrix4(d),o.identity(),s.copy(_.matrixWorld),s.premultiply(d),o.extractRotation(s),x.halfWidth.set(_.width*0.5,0,0),x.halfHeight.set(0,_.height*0.5,0),x.halfWidth.applyMatrix4(o),x.halfHeight.applyMatrix4(o),y++}else if(_.isPointLight){let x=i.point[p];x.position.setFromMatrixPosition(_.matrixWorld),x.position.applyMatrix4(d),p++}else if(_.isHemisphereLight){let x=i.hemi[m];x.direction.setFromMatrixPosition(_.matrixWorld),x.direction.transformDirection(d),m++}}}return{setup:a,setupView:l,state:i}}function qm(e){let t=new GM(e),n=[],i=[],r=[];function s(u){f.camera=u,n.length=0,i.length=0,r.length=0}function o(u){n.push(u)}function a(u){i.push(u)}function l(u){r.push(u)}function c(){t.setup(n)}function h(u){t.setupView(n,u)}let f={lightsArray:n,shadowsArray:i,lightProbeGridArray:r,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:f,setupLights:c,setupLightsView:h,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function HM(e){let t=new WeakMap;function n(r,s=0){let o=t.get(r),a;if(o===void 0)a=new qm(e),t.set(r,[a]);else if(s>=o.length)a=new qm(e),o.push(a);else a=o[s];return a}function i(){t=new WeakMap}return{get:n,dispose:i}}var VM=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,WM=`uniform sampler2D shadow_pass;
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
}`,XM=[new L(1,0,0),new L(-1,0,0),new L(0,1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1)],qM=[new L(0,-1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1),new L(0,-1,0),new L(0,-1,0)],jm=new Ke,Ws=new L,Uh=new L;function jM(e,t,n){let i=new Ns,r=new re,s=new re,o=new gt,a=new fh,l=new dh,c={},h=n.maxTextureSize,f={[Ir]:Xt,[Xt]:Ir,[Bn]:Bn},u=new Tt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new re},radius:{value:4}},vertexShader:VM,fragmentShader:WM}),p=u.clone();p.defines.HORIZONTAL_PASS=1;let g=new It;g.setAttribute("position",new on(new Float32Array([-1,-1,0.5,3,-1,0.5,-1,3,0.5]),3));let y=new zt(g,u),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=_s;let d=this.type;this.render=function(w,E,v){if(m.enabled===!1)return;if(m.autoUpdate===!1&&m.needsUpdate===!1)return;if(w.length===0)return;if(this.type===Mp)Ie("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=_s;let A=e.getRenderTarget(),N=e.getActiveCubeFace(),P=e.getActiveMipmapLevel(),D=e.state;if(D.setBlending(bn),D.buffers.depth.getReversed()===!0)D.buffers.color.setClear(0,0,0,0);else D.buffers.color.setClear(1,1,1,1);D.buffers.depth.setTest(!0),D.setScissorTest(!1);let W=d!==this.type;if(W)E.traverse(function(R){if(R.material)if(Array.isArray(R.material))R.material.forEach((I)=>I.needsUpdate=!0);else R.material.needsUpdate=!0});for(let R=0,I=w.length;R<I;R++){let k=w[R],z=k.shadow;if(z===void 0){Ie("WebGLShadowMap:",k,"has no shadow.");continue}if(z.autoUpdate===!1&&z.needsUpdate===!1)continue;r.copy(z.mapSize);let te=z.getFrameExtents();if(r.multiply(te),s.copy(z.mapSize),r.x>h||r.y>h){if(r.x>h)s.x=Math.floor(h/te.x),r.x=s.x*te.x,z.mapSize.x=s.x;if(r.y>h)s.y=Math.floor(h/te.y),r.y=s.y*te.y,z.mapSize.y=s.y}let Y=e.state.buffers.depth.getReversed();if(z.camera._reversedDepth=Y,z.map===null||W===!0){if(z.map!==null){if(z.map.depthTexture!==null)z.map.depthTexture.dispose(),z.map.depthTexture=null;z.map.dispose()}if(this.type===Pr){if(k.isPointLight){Ie("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}z.map=new Pt(r.x,r.y,{format:Vi,type:qt,minFilter:an,magFilter:an,generateMipmaps:!1}),z.map.texture.name=k.name+".shadowMap",z.map.depthTexture=new qi(r.x,r.y,ii),z.map.depthTexture.name=k.name+".shadowMapDepth",z.map.depthTexture.format=Gi,z.map.depthTexture.compareFunction=null,z.map.depthTexture.minFilter=vi,z.map.depthTexture.magFilter=vi}else{if(k.isPointLight)z.map=new zh(r.x),z.map.depthTexture=new nh(r.x,yi);else z.map=new Pt(r.x,r.y),z.map.depthTexture=new qi(r.x,r.y,yi);if(z.map.depthTexture.name=k.name+".shadowMap",z.map.depthTexture.format=Gi,this.type===_s)z.map.depthTexture.compareFunction=Y?ha:ca,z.map.depthTexture.minFilter=an,z.map.depthTexture.magFilter=an;else z.map.depthTexture.compareFunction=null,z.map.depthTexture.minFilter=vi,z.map.depthTexture.magFilter=vi}z.camera.updateProjectionMatrix()}if(z.map.isWebGLCubeRenderTarget!==!0&&(z.map.width!==r.x||z.map.height!==r.y))z.map.setSize(r.x,r.y);let Q=z.map.isWebGLCubeRenderTarget?6:z.getViewportCount();if(k.isPointLight!==!0)z.updateMatrices(k,v);for(let G=0;G<Q;G++){let ee=z.getCamera(G);if(k.isPointLight){let{camera:oe,matrix:Ue}=z,Re=k.distance||oe.far;if(Re!==oe.far)oe.far=Re,oe.updateProjectionMatrix();Ws.setFromMatrixPosition(k.matrixWorld),oe.position.copy(Ws),Uh.copy(oe.position),Uh.add(XM[G]),oe.up.copy(qM[G]),oe.lookAt(Uh),oe.updateMatrixWorld(),Ue.makeTranslation(-Ws.x,-Ws.y,-Ws.z),jm.multiplyMatrices(oe.projectionMatrix,oe.matrixWorldInverse),z._frustum.setFromProjectionMatrix(jm,oe.coordinateSystem,oe.reversedDepth)}if(z.map.isWebGLCubeRenderTarget)e.setRenderTarget(z.map,G),e.clear();else{if(G===0)e.setRenderTarget(z.map),e.clear();let oe=z.getViewport(G);o.set(s.x*oe.x,s.y*oe.y,s.x*oe.z,s.y*oe.w),D.viewport(o)}i=z.getFrustum(G),_(E,v,ee,k,this.type)}if(z.isPointLightShadow!==!0&&this.type===Pr)b(z,v);z.needsUpdate=!1}d=this.type,m.needsUpdate=!1,e.setRenderTarget(A,N,P)};function b(w,E){let v=t.update(y);if(u.defines.VSM_SAMPLES!==w.blurSamples)u.defines.VSM_SAMPLES=w.blurSamples,p.defines.VSM_SAMPLES=w.blurSamples,u.needsUpdate=!0,p.needsUpdate=!0;if(w.mapPass===null)w.mapPass=new Pt(r.x,r.y,{format:Vi,type:qt});else if(w.mapPass.width!==w.map.width||w.mapPass.height!==w.map.height)w.mapPass.setSize(w.map.width,w.map.height);u.uniforms.shadow_pass.value=w.map.depthTexture,u.uniforms.resolution.value.set(w.map.width,w.map.height),u.uniforms.radius.value=w.radius,e.setRenderTarget(w.mapPass),e.clear(),e.renderBufferDirect(E,null,v,u,y,null),p.uniforms.shadow_pass.value=w.mapPass.texture,p.uniforms.resolution.value.set(w.map.width,w.map.height),p.uniforms.radius.value=w.radius,e.setRenderTarget(w.map),e.clear(),e.renderBufferDirect(E,null,v,p,y,null)}function S(w,E,v,A){let N=null,P=v.isPointLight===!0?w.customDistanceMaterial:w.customDepthMaterial;if(P!==void 0)N=P;else if(N=v.isPointLight===!0?l:a,e.localClippingEnabled&&E.clipShadows===!0&&Array.isArray(E.clippingPlanes)&&E.clippingPlanes.length!==0||E.displacementMap&&E.displacementScale!==0||E.alphaMap&&E.alphaTest>0||E.map&&E.alphaTest>0||E.alphaToCoverage===!0){let D=N.uuid,W=E.uuid,R=c[D];if(R===void 0)R={},c[D]=R;let I=R[W];if(I===void 0)I=N.clone(),R[W]=I,E.addEventListener("dispose",x);N=I}if(N.visible=E.visible,N.wireframe=E.wireframe,A===Pr)N.side=E.shadowSide!==null?E.shadowSide:E.side;else N.side=E.shadowSide!==null?E.shadowSide:f[E.side];if(N.alphaMap=E.alphaMap,N.alphaTest=E.alphaToCoverage===!0?0.5:E.alphaTest,N.map=E.map,N.clipShadows=E.clipShadows,N.clippingPlanes=E.clippingPlanes,N.clipIntersection=E.clipIntersection,N.displacementMap=E.displacementMap,N.displacementScale=E.displacementScale,N.displacementBias=E.displacementBias,N.wireframeLinewidth=E.wireframeLinewidth,N.linewidth=E.linewidth,v.isPointLight===!0&&N.isMeshDistanceMaterial===!0){let D=e.properties.get(N);D.light=v}return N}function _(w,E,v,A,N){if(w.visible===!1)return;if(w.layers.test(E.layers)&&(w.isMesh||w.isLine||w.isPoints)){if((w.castShadow||w.receiveShadow&&N===Pr)&&(!w.frustumCulled||w.intersectsFrustum(i))){w.modelViewMatrix.multiplyMatrices(v.matrixWorldInverse,w.matrixWorld);let W=t.update(w),R=w.material;if(Array.isArray(R)){let I=W.groups;for(let k=0,z=I.length;k<z;k++){let te=I[k],Y=R[te.materialIndex];if(Y&&Y.visible){let Q=S(w,Y,A,N);w.onBeforeShadow(e,w,E,v,W,Q,te),e.renderBufferDirect(v,null,W,Q,w,te),w.onAfterShadow(e,w,E,v,W,Q,te)}}}else if(R.visible){let I=S(w,R,A,N);w.onBeforeShadow(e,w,E,v,W,I,null),e.renderBufferDirect(v,null,W,I,w,null),w.onAfterShadow(e,w,E,v,W,I,null)}}}let D=w.children;for(let W=0,R=D.length;W<R;W++)_(D[W],E,v,A,N)}function x(w){w.target.removeEventListener("dispose",x);for(let v in c){let A=c[v],N=w.target.uuid;if(N in A)A[N].dispose(),delete A[N]}}}function YM(e,t){function n(){let B=!1,he=new gt,J=null,ue=new gt(0,0,0,0);return{setMask:function(ye){if(J!==ye&&!B)e.colorMask(ye,ye,ye,ye),J=ye},setLocked:function(ye){B=ye},setClear:function(ye,ne,me,ke,ut){if(ut===!0)ye*=ke,ne*=ke,me*=ke;if(he.set(ye,ne,me,ke),ue.equals(he)===!1)e.clearColor(ye,ne,me,ke),ue.copy(he)},reset:function(){B=!1,J=null,ue.set(-1,0,0,0)}}}function i(){let B=!1,he=!1,J=null,ue=null,ye=null;return{setReversed:function(ne){if(he!==ne){let me=t.get("EXT_clip_control");if(ne)me.clipControlEXT(me.LOWER_LEFT_EXT,me.ZERO_TO_ONE_EXT);else me.clipControlEXT(me.LOWER_LEFT_EXT,me.NEGATIVE_ONE_TO_ONE_EXT);he=ne;let ke=ye;ye=null,this.setClear(ke)}},getReversed:function(){return he},setTest:function(ne){if(ne)le(e.DEPTH_TEST);else Pe(e.DEPTH_TEST)},setMask:function(ne){if(J!==ne&&!B)e.depthMask(ne),J=ne},setFunc:function(ne){if(he)ne=xm[ne];if(ue!==ne){switch(ne){case Wp:e.depthFunc(e.NEVER);break;case Xp:e.depthFunc(e.ALWAYS);break;case qp:e.depthFunc(e.LESS);break;case lc:e.depthFunc(e.LEQUAL);break;case jp:e.depthFunc(e.EQUAL);break;case Yp:e.depthFunc(e.GEQUAL);break;case $p:e.depthFunc(e.GREATER);break;case Zp:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}ue=ne}},setLocked:function(ne){B=ne},setClear:function(ne){if(ye!==ne){if(ye=ne,he)ne=1-ne;e.clearDepth(ne)}},reset:function(){B=!1,J=null,ue=null,ye=null,he=!1}}}function r(){let B=!1,he=null,J=null,ue=null,ye=null,ne=null,me=null,ke=null,ut=null;return{setTest:function(nt){if(!B)if(nt)le(e.STENCIL_TEST);else Pe(e.STENCIL_TEST)},setMask:function(nt){if(he!==nt&&!B)e.stencilMask(nt),he=nt},setFunc:function(nt,On,jn){if(J!==nt||ue!==On||ye!==jn)e.stencilFunc(nt,On,jn),J=nt,ue=On,ye=jn},setOp:function(nt,On,jn){if(ne!==nt||me!==On||ke!==jn)e.stencilOp(nt,On,jn),ne=nt,me=On,ke=jn},setLocked:function(nt){B=nt},setClear:function(nt){if(ut!==nt)e.clearStencil(nt),ut=nt},reset:function(){B=!1,he=null,J=null,ue=null,ye=null,ne=null,me=null,ke=null,ut=null}}}let s=new n,o=new i,a=new r,l=new WeakMap,c=new WeakMap,h={},f={},u={},p=new WeakMap,g=[],y=null,m=!1,d=null,b=null,S=null,_=null,x=null,w=null,E=null,v=new Fe(0,0,0),A=0,N=!1,P=null,D=null,W=null,R=null,I=null,k=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),z=!1,te=0,Y=e.getParameter(e.VERSION);if(Y.indexOf("WebGL")!==-1)te=parseFloat(/^WebGL (\d)/.exec(Y)[1]),z=te>=1;else if(Y.indexOf("OpenGL ES")!==-1)te=parseFloat(/^OpenGL ES (\d)/.exec(Y)[1]),z=te>=2;let Q=null,G={},ee=e.getParameter(e.SCISSOR_BOX),oe=e.getParameter(e.VIEWPORT),Ue=new gt().fromArray(ee),Re=new gt().fromArray(oe);function X(B,he,J,ue){let ye=new Uint8Array(4),ne=e.createTexture();e.bindTexture(B,ne),e.texParameteri(B,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(B,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let me=0;me<J;me++)if(B===e.TEXTURE_3D||B===e.TEXTURE_2D_ARRAY)e.texImage3D(he,0,e.RGBA,1,1,ue,0,e.RGBA,e.UNSIGNED_BYTE,ye);else e.texImage2D(he+me,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,ye);return ne}let se={};se[e.TEXTURE_2D]=X(e.TEXTURE_2D,e.TEXTURE_2D,1),se[e.TEXTURE_CUBE_MAP]=X(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),se[e.TEXTURE_2D_ARRAY]=X(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),se[e.TEXTURE_3D]=X(e.TEXTURE_3D,e.TEXTURE_3D,1,1),s.setClear(0,0,0,1),o.setClear(1),a.setClear(0),le(e.DEPTH_TEST),o.setFunc(lc),Bt(!1),dt(sc),le(e.CULL_FACE),rt(bn);function le(B){if(h[B]!==!0)e.enable(B),h[B]=!0}function Pe(B){if(h[B]!==!1)e.disable(B),h[B]=!1}function Oe(B,he){if(u[B]!==he){if(e.bindFramebuffer(B,he),u[B]=he,B===e.DRAW_FRAMEBUFFER)u[e.FRAMEBUFFER]=he;if(B===e.FRAMEBUFFER)u[e.DRAW_FRAMEBUFFER]=he;return!0}return!1}function Ae(B,he){let J=g,ue=!1;if(B){if(J=p.get(he),J===void 0)J=[],p.set(he,J);let ye=B.textures;if(J.length!==ye.length||J[0]!==e.COLOR_ATTACHMENT0){for(let ne=0,me=ye.length;ne<me;ne++)J[ne]=e.COLOR_ATTACHMENT0+ne;J.length=ye.length,ue=!0}}else if(J[0]!==e.BACK)J[0]=e.BACK,ue=!0;if(ue)e.drawBuffers(J)}function Et(B){if(y!==B)return e.useProgram(B),y=B,!0;return!1}let qe={[Lr]:e.FUNC_ADD,[Tp]:e.FUNC_SUBTRACT,[Ep]:e.FUNC_REVERSE_SUBTRACT};qe[Ap]=e.MIN,qe[Cp]=e.MAX;let je={[Rp]:e.ZERO,[Pp]:e.ONE,[Ip]:e.SRC_COLOR,[Dp]:e.SRC_ALPHA,[kp]:e.SRC_ALPHA_SATURATE,[Fp]:e.DST_COLOR,[Op]:e.DST_ALPHA,[Lp]:e.ONE_MINUS_SRC_COLOR,[Np]:e.ONE_MINUS_SRC_ALPHA,[Bp]:e.ONE_MINUS_DST_COLOR,[Up]:e.ONE_MINUS_DST_ALPHA,[zp]:e.CONSTANT_COLOR,[Gp]:e.ONE_MINUS_CONSTANT_COLOR,[Hp]:e.CONSTANT_ALPHA,[Vp]:e.ONE_MINUS_CONSTANT_ALPHA};function rt(B,he,J,ue,ye,ne,me,ke,ut,nt){if(B===bn){if(m===!0)Pe(e.BLEND),m=!1;return}if(m===!1)le(e.BLEND),m=!0;if(B!==wp){if(B!==d||nt!==N){if(b!==Lr||x!==Lr)e.blendEquation(e.FUNC_ADD),b=Lr,x=Lr;if(nt)switch(B){case vs:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case ys:e.blendFunc(e.ONE,e.ONE);break;case oc:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case ac:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:De("WebGLState: Invalid blending: ",B);break}else switch(B){case vs:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case ys:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case oc:De("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case ac:De("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:De("WebGLState: Invalid blending: ",B);break}S=null,_=null,w=null,E=null,v.set(0,0,0),A=0,d=B,N=nt}return}if(ye=ye||he,ne=ne||J,me=me||ue,he!==b||ye!==x)e.blendEquationSeparate(qe[he],qe[ye]),b=he,x=ye;if(J!==S||ue!==_||ne!==w||me!==E)e.blendFuncSeparate(je[J],je[ue],je[ne],je[me]),S=J,_=ue,w=ne,E=me;if(ke.equals(v)===!1||ut!==A)e.blendColor(ke.r,ke.g,ke.b,ut),v.copy(ke),A=ut;d=B,N=!1}function Ye(B,he){B.side===Bn?Pe(e.CULL_FACE):le(e.CULL_FACE);let J=B.side===Xt;if(he)J=!J;Bt(J),B.blending===vs&&B.transparent===!1?rt(bn):rt(B.blending,B.blendEquation,B.blendSrc,B.blendDst,B.blendEquationAlpha,B.blendSrcAlpha,B.blendDstAlpha,B.blendColor,B.blendAlpha,B.premultipliedAlpha),o.setFunc(B.depthFunc),o.setTest(B.depthTest),o.setMask(B.depthWrite),s.setMask(B.colorWrite);let ue=B.stencilWrite;if(a.setTest(ue),ue)a.setMask(B.stencilWriteMask),a.setFunc(B.stencilFunc,B.stencilRef,B.stencilFuncMask),a.setOp(B.stencilFail,B.stencilZFail,B.stencilZPass);At(B.polygonOffset,B.polygonOffsetFactor,B.polygonOffsetUnits),B.alphaToCoverage===!0?le(e.SAMPLE_ALPHA_TO_COVERAGE):Pe(e.SAMPLE_ALPHA_TO_COVERAGE)}function Bt(B){if(P!==B){if(B)e.frontFace(e.CW);else e.frontFace(e.CCW);P=B}}function dt(B){if(B!==bp){if(le(e.CULL_FACE),B!==D)if(B===sc)e.cullFace(e.BACK);else if(B===Sp)e.cullFace(e.FRONT);else e.cullFace(e.FRONT_AND_BACK)}else Pe(e.CULL_FACE);D=B}function tn(B){if(B!==W){if(z)e.lineWidth(B);W=B}}function At(B,he,J){if(B){if(le(e.POLYGON_OFFSET_FILL),R!==he||I!==J){if(R=he,I=J,o.getReversed())he=-he;e.polygonOffset(he,J)}}else Pe(e.POLYGON_OFFSET_FILL)}function Ct(B){if(B)le(e.SCISSOR_TEST);else Pe(e.SCISSOR_TEST)}function U(B){if(B===void 0)B=e.TEXTURE0+k-1;if(Q!==B)e.activeTexture(B),Q=B}function nn(B,he,J){if(J===void 0)if(Q===null)J=e.TEXTURE0+k-1;else J=Q;let ue=G[J];if(ue===void 0)ue={type:void 0,texture:void 0},G[J]=ue;if(ue.type!==B||ue.texture!==he){if(Q!==J)e.activeTexture(J),Q=J;e.bindTexture(B,he||se[B]),ue.type=B,ue.texture=he}}function tt(){let B=G[Q];if(B!==void 0&&B.type!==void 0)e.bindTexture(B.type,null),B.type=void 0,B.texture=void 0}function yt(){try{e.compressedTexImage2D(...arguments)}catch(B){De("WebGLState:",B)}}function C(){try{e.compressedTexImage3D(...arguments)}catch(B){De("WebGLState:",B)}}function M(){try{e.texSubImage2D(...arguments)}catch(B){De("WebGLState:",B)}}function O(){try{e.texSubImage3D(...arguments)}catch(B){De("WebGLState:",B)}}function q(){try{e.compressedTexSubImage2D(...arguments)}catch(B){De("WebGLState:",B)}}function ie(){try{e.compressedTexSubImage3D(...arguments)}catch(B){De("WebGLState:",B)}}function ce(){try{e.texStorage2D(...arguments)}catch(B){De("WebGLState:",B)}}function fe(){try{e.texStorage3D(...arguments)}catch(B){De("WebGLState:",B)}}function Z(){try{e.texImage2D(...arguments)}catch(B){De("WebGLState:",B)}}function K(){try{e.texImage3D(...arguments)}catch(B){De("WebGLState:",B)}}function ve(B){if(f[B]!==void 0)return f[B];else return e.getParameter(B)}function Ee(B,he){if(f[B]!==he)e.pixelStorei(B,he),f[B]=he}function de(B){if(Ue.equals(B)===!1)e.scissor(B.x,B.y,B.z,B.w),Ue.copy(B)}function ae(B){if(Re.equals(B)===!1)e.viewport(B.x,B.y,B.z,B.w),Re.copy(B)}function Ce(B,he){let J=c.get(he);if(J===void 0)J=new WeakMap,c.set(he,J);let ue=J.get(B);if(ue===void 0)ue=e.getUniformBlockIndex(he,B.name),J.set(B,ue)}function Le(B,he){let ue=c.get(he).get(B);if(l.get(he)!==ue)e.uniformBlockBinding(he,ue,B.__bindingPointIndex),l.set(he,ue)}function Je(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),h={},f={},Q=null,G={},u={},p=new WeakMap,g=[],y=null,m=!1,d=null,b=null,S=null,_=null,x=null,w=null,E=null,v=new Fe(0,0,0),A=0,N=!1,P=null,D=null,W=null,R=null,I=null,Ue.set(0,0,e.canvas.width,e.canvas.height),Re.set(0,0,e.canvas.width,e.canvas.height),s.reset(),o.reset(),a.reset()}return{buffers:{color:s,depth:o,stencil:a},enable:le,disable:Pe,bindFramebuffer:Oe,drawBuffers:Ae,useProgram:Et,setBlending:rt,setMaterial:Ye,setFlipSided:Bt,setCullFace:dt,setLineWidth:tn,setPolygonOffset:At,setScissorTest:Ct,activeTexture:U,bindTexture:nn,unbindTexture:tt,compressedTexImage2D:yt,compressedTexImage3D:C,texImage2D:Z,texImage3D:K,pixelStorei:Ee,getParameter:ve,updateUBOMapping:Ce,uniformBlockBinding:Le,texStorage2D:ce,texStorage3D:fe,texSubImage2D:M,texSubImage3D:O,compressedTexSubImage2D:q,compressedTexSubImage3D:ie,scissor:de,viewport:ae,reset:Je}}function $M(e,t,n,i,r,s,o){let a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new re,h=new WeakMap,f=new Set,u,p=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch(C){}function y(C,M){return g?new OffscreenCanvas(C,M):Ar("canvas")}function m(C,M,O){let q=1,ie=yt(C);if(ie.width>O||ie.height>O)q=O/Math.max(ie.width,ie.height);if(q<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){let ce=Math.floor(q*ie.width),fe=Math.floor(q*ie.height);if(u===void 0)u=y(ce,fe);let Z=M?y(ce,fe):u;return Z.width=ce,Z.height=fe,Z.getContext("2d").drawImage(C,0,0,ce,fe),Ie("WebGLRenderer: Texture has been resized from ("+ie.width+"x"+ie.height+") to ("+ce+"x"+fe+")."),Z}else{if("data"in C)Ie("WebGLRenderer: Image in DataTexture is too big ("+ie.width+"x"+ie.height+").");return C}return C}function d(C){return C.generateMipmaps}function b(C){e.generateMipmap(C)}function S(C){if(C.isWebGLCubeRenderTarget)return e.TEXTURE_CUBE_MAP;if(C.isWebGL3DRenderTarget)return e.TEXTURE_3D;if(C.isWebGLArrayRenderTarget||C.isCompressedArrayTexture)return e.TEXTURE_2D_ARRAY;return e.TEXTURE_2D}function _(C,M,O,q,ie,ce=!1){if(C!==null){if(e[C]!==void 0)return e[C];Ie("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let fe;if(q){if(fe=t.get("EXT_texture_norm16"),!fe)Ie("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension")}let Z=M;if(M===e.RED){if(O===e.FLOAT)Z=e.R32F;if(O===e.HALF_FLOAT)Z=e.R16F;if(O===e.UNSIGNED_BYTE)Z=e.R8;if(O===e.UNSIGNED_SHORT&&fe)Z=fe.R16_EXT;if(O===e.SHORT&&fe)Z=fe.R16_SNORM_EXT}if(M===e.RED_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.R8UI;if(O===e.UNSIGNED_SHORT)Z=e.R16UI;if(O===e.UNSIGNED_INT)Z=e.R32UI;if(O===e.BYTE)Z=e.R8I;if(O===e.SHORT)Z=e.R16I;if(O===e.INT)Z=e.R32I}if(M===e.RG){if(O===e.FLOAT)Z=e.RG32F;if(O===e.HALF_FLOAT)Z=e.RG16F;if(O===e.UNSIGNED_BYTE)Z=e.RG8;if(O===e.UNSIGNED_SHORT&&fe)Z=fe.RG16_EXT;if(O===e.SHORT&&fe)Z=fe.RG16_SNORM_EXT}if(M===e.RG_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.RG8UI;if(O===e.UNSIGNED_SHORT)Z=e.RG16UI;if(O===e.UNSIGNED_INT)Z=e.RG32UI;if(O===e.BYTE)Z=e.RG8I;if(O===e.SHORT)Z=e.RG16I;if(O===e.INT)Z=e.RG32I}if(M===e.RGB_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.RGB8UI;if(O===e.UNSIGNED_SHORT)Z=e.RGB16UI;if(O===e.UNSIGNED_INT)Z=e.RGB32UI;if(O===e.BYTE)Z=e.RGB8I;if(O===e.SHORT)Z=e.RGB16I;if(O===e.INT)Z=e.RGB32I}if(M===e.RGBA_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.RGBA8UI;if(O===e.UNSIGNED_SHORT)Z=e.RGBA16UI;if(O===e.UNSIGNED_INT)Z=e.RGBA32UI;if(O===e.BYTE)Z=e.RGBA8I;if(O===e.SHORT)Z=e.RGBA16I;if(O===e.INT)Z=e.RGBA32I}if(M===e.RGB){if(O===e.UNSIGNED_SHORT&&fe)Z=fe.RGB16_EXT;if(O===e.SHORT&&fe)Z=fe.RGB16_SNORM_EXT;if(O===e.UNSIGNED_INT_5_9_9_9_REV)Z=e.RGB9_E5;if(O===e.UNSIGNED_INT_10F_11F_11F_REV)Z=e.R11F_G11F_B10F}if(M===e.RGBA){let K=ce?jc:We.getTransfer(ie);if(O===e.FLOAT)Z=e.RGBA32F;if(O===e.HALF_FLOAT)Z=e.RGBA16F;if(O===e.UNSIGNED_BYTE)Z=K===at?e.SRGB8_ALPHA8:e.RGBA8;if(O===e.UNSIGNED_SHORT&&fe)Z=fe.RGBA16_EXT;if(O===e.SHORT&&fe)Z=fe.RGBA16_SNORM_EXT;if(O===e.UNSIGNED_SHORT_4_4_4_4)Z=e.RGBA4;if(O===e.UNSIGNED_SHORT_5_5_5_1)Z=e.RGB5_A1}if(Z===e.R16F||Z===e.R32F||Z===e.RG16F||Z===e.RG32F||Z===e.RGBA16F||Z===e.RGBA32F)t.get("EXT_color_buffer_float");return Z}function x(C,M){let O;if(C){if(M===null||M===yi||M===Nr)O=e.DEPTH24_STENCIL8;else if(M===ii)O=e.DEPTH32F_STENCIL8;else if(M===Rs)O=e.DEPTH24_STENCIL8,Ie("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")}else if(M===null||M===yi||M===Nr)O=e.DEPTH_COMPONENT24;else if(M===ii)O=e.DEPTH_COMPONENT32F;else if(M===Rs)O=e.DEPTH_COMPONENT16;return O}function w(C,M){if(d(C)===!0||C.isFramebufferTexture&&C.minFilter!==vi&&C.minFilter!==an)return Math.log2(Math.max(M.width,M.height))+1;else if(C.mipmaps!==void 0&&C.mipmaps.length>0)return C.mipmaps.length;else if(C.isCompressedTexture&&Array.isArray(C.image))return M.mipmaps.length;else return 1}function E(C){let M=C.target;if(M.removeEventListener("dispose",E),A(M),M.isVideoTexture)h.delete(M);if(M.isHTMLTexture)f.delete(M)}function v(C){let M=C.target;M.removeEventListener("dispose",v),P(M)}function A(C){let M=i.get(C);if(M.__webglInit===void 0)return;let O=C.source,q=p.get(O);if(q){let ie=q[M.__cacheKey];if(ie.usedTimes--,ie.usedTimes===0)N(C);if(Object.keys(q).length===0)p.delete(O)}i.remove(C)}function N(C){let M=i.get(C);e.deleteTexture(M.__webglTexture);let O=C.source,q=p.get(O);delete q[M.__cacheKey],o.memory.textures--}function P(C){let M=i.get(C);if(C.depthTexture)C.depthTexture.dispose(),i.remove(C.depthTexture);if(C.isWebGLCubeRenderTarget)for(let q=0;q<6;q++){if(Array.isArray(M.__webglFramebuffer[q]))for(let ie=0;ie<M.__webglFramebuffer[q].length;ie++)e.deleteFramebuffer(M.__webglFramebuffer[q][ie]);else e.deleteFramebuffer(M.__webglFramebuffer[q]);if(M.__webglDepthbuffer)e.deleteRenderbuffer(M.__webglDepthbuffer[q])}else{if(Array.isArray(M.__webglFramebuffer))for(let q=0;q<M.__webglFramebuffer.length;q++)e.deleteFramebuffer(M.__webglFramebuffer[q]);else e.deleteFramebuffer(M.__webglFramebuffer);if(M.__webglDepthbuffer)e.deleteRenderbuffer(M.__webglDepthbuffer);if(M.__webglMultisampledFramebuffer)e.deleteFramebuffer(M.__webglMultisampledFramebuffer);if(M.__webglColorRenderbuffer){for(let q=0;q<M.__webglColorRenderbuffer.length;q++)if(M.__webglColorRenderbuffer[q])e.deleteRenderbuffer(M.__webglColorRenderbuffer[q])}if(M.__webglDepthRenderbuffer)e.deleteRenderbuffer(M.__webglDepthRenderbuffer)}let O=C.textures;for(let q=0,ie=O.length;q<ie;q++){let ce=i.get(O[q]);if(ce.__webglTexture)e.deleteTexture(ce.__webglTexture),o.memory.textures--;i.remove(O[q])}i.remove(C)}let D=0;function W(){D=0}function R(){return D}function I(C){D=C}function k(){let C=D;if(C>=r.maxTextures)Ie("WebGLTextures: Trying to use "+(C+1)+" texture units while this GPU supports only "+r.maxTextures);return D+=1,C}function z(C){let M=[];return M.push(C.wrapS),M.push(C.wrapT),M.push(C.wrapR||0),M.push(C.magFilter),M.push(C.minFilter),M.push(C.anisotropy),M.push(C.internalFormat),M.push(C.format),M.push(C.type),M.push(C.generateMipmaps),M.push(C.premultiplyAlpha),M.push(C.flipY),M.push(C.unpackAlignment),M.push(C.colorSpace),M.join()}function te(C,M){let O=i.get(C);if(C.isVideoTexture)nn(C);if(C.isRenderTargetTexture===!1&&C.isExternalTexture!==!0&&C.version>0&&O.__version!==C.version){let q=C.image;if(q===null)Ie("WebGLRenderer: Texture marked for update but no image data found.");else if(q.complete===!1)Ie("WebGLRenderer: Texture marked for update but image is incomplete");else{Pe(O,C,M);return}}else if(C.isExternalTexture)O.__webglTexture=C.sourceTexture?C.sourceTexture:null;n.bindTexture(e.TEXTURE_2D,O.__webglTexture,e.TEXTURE0+M)}function Y(C,M){let O=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&O.__version!==C.version){Pe(O,C,M);return}else if(C.isExternalTexture)O.__webglTexture=C.sourceTexture?C.sourceTexture:null;n.bindTexture(e.TEXTURE_2D_ARRAY,O.__webglTexture,e.TEXTURE0+M)}function Q(C,M){let O=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&O.__version!==C.version){Pe(O,C,M);return}n.bindTexture(e.TEXTURE_3D,O.__webglTexture,e.TEXTURE0+M)}function G(C,M){let O=i.get(C);if(C.isCubeDepthTexture!==!0&&C.version>0&&O.__version!==C.version){Oe(O,C,M);return}n.bindTexture(e.TEXTURE_CUBE_MAP,O.__webglTexture,e.TEXTURE0+M)}let ee={[em]:e.REPEAT,[ta]:e.CLAMP_TO_EDGE,[tm]:e.MIRRORED_REPEAT},oe={[vi]:e.NEAREST,[nm]:e.NEAREST_MIPMAP_NEAREST,[Cs]:e.NEAREST_MIPMAP_LINEAR,[an]:e.LINEAR,[na]:e.LINEAR_MIPMAP_NEAREST,[zi]:e.LINEAR_MIPMAP_LINEAR},Ue={[um]:e.NEVER,[gm]:e.ALWAYS,[fm]:e.LESS,[ca]:e.LEQUAL,[dm]:e.EQUAL,[ha]:e.GEQUAL,[pm]:e.GREATER,[mm]:e.NOTEQUAL};function Re(C,M){if(M.type===ii&&t.has("OES_texture_float_linear")===!1&&(M.magFilter===an||M.magFilter===na||M.magFilter===Cs||M.magFilter===zi||M.minFilter===an||M.minFilter===na||M.minFilter===Cs||M.minFilter===zi))Ie("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.");if(e.texParameteri(C,e.TEXTURE_WRAP_S,ee[M.wrapS]),e.texParameteri(C,e.TEXTURE_WRAP_T,ee[M.wrapT]),C===e.TEXTURE_3D||C===e.TEXTURE_2D_ARRAY)e.texParameteri(C,e.TEXTURE_WRAP_R,ee[M.wrapR]);if(e.texParameteri(C,e.TEXTURE_MAG_FILTER,oe[M.magFilter]),e.texParameteri(C,e.TEXTURE_MIN_FILTER,oe[M.minFilter]),M.compareFunction)e.texParameteri(C,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(C,e.TEXTURE_COMPARE_FUNC,Ue[M.compareFunction]);if(t.has("EXT_texture_filter_anisotropic")===!0){if(M.magFilter===vi)return;if(M.minFilter!==Cs&&M.minFilter!==zi)return;if(M.type===ii&&t.has("OES_texture_float_linear")===!1)return;if(M.anisotropy>1||i.get(M).__currentAnisotropy){let O=t.get("EXT_texture_filter_anisotropic");e.texParameterf(C,O.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(M.anisotropy,r.getMaxAnisotropy())),i.get(M).__currentAnisotropy=M.anisotropy}}}function X(C,M){let O=!1;if(C.__webglInit===void 0)C.__webglInit=!0,M.addEventListener("dispose",E);let q=M.source,ie=p.get(q);if(ie===void 0)ie={},p.set(q,ie);let ce=z(M);if(ce!==C.__cacheKey){if(ie[ce]===void 0)ie[ce]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,O=!0;ie[ce].usedTimes++;let fe=ie[C.__cacheKey];if(fe!==void 0){if(ie[C.__cacheKey].usedTimes--,fe.usedTimes===0)N(M)}C.__cacheKey=ce,C.__webglTexture=ie[ce].texture}return O}function se(C,M,O){return Math.floor(Math.floor(C/O)/M)}function le(C,M,O,q){let ce=C.updateRanges;if(ce.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,M.width,M.height,O,q,M.data);else{ce.sort((Ee,de)=>Ee.start-de.start);let fe=0;for(let Ee=1;Ee<ce.length;Ee++){let de=ce[fe],ae=ce[Ee],Ce=de.start+de.count,Le=se(ae.start,M.width,4),Je=se(de.start,M.width,4);if(ae.start<=Ce+1&&Le===Je&&se(ae.start+ae.count-1,M.width,4)===Le)de.count=Math.max(de.count,ae.start+ae.count-de.start);else++fe,ce[fe]=ae}ce.length=fe+1;let Z=n.getParameter(e.UNPACK_ROW_LENGTH),K=n.getParameter(e.UNPACK_SKIP_PIXELS),ve=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,M.width);for(let Ee=0,de=ce.length;Ee<de;Ee++){let ae=ce[Ee],Ce=Math.floor(ae.start/4),Le=Math.ceil(ae.count/4),Je=Ce%M.width,B=Math.floor(Ce/M.width),he=Le,J=1;n.pixelStorei(e.UNPACK_SKIP_PIXELS,Je),n.pixelStorei(e.UNPACK_SKIP_ROWS,B),n.texSubImage2D(e.TEXTURE_2D,0,Je,B,he,1,O,q,M.data)}C.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,Z),n.pixelStorei(e.UNPACK_SKIP_PIXELS,K),n.pixelStorei(e.UNPACK_SKIP_ROWS,ve)}}function Pe(C,M,O){let q=e.TEXTURE_2D;if(M.isDataArrayTexture||M.isCompressedArrayTexture)q=e.TEXTURE_2D_ARRAY;if(M.isData3DTexture)q=e.TEXTURE_3D;let ie=X(C,M),ce=M.source;n.bindTexture(q,C.__webglTexture,e.TEXTURE0+O);let fe=i.get(ce);if(ce.version!==fe.__version||ie===!0){if(n.activeTexture(e.TEXTURE0+O),(typeof ImageBitmap<"u"&&M.image instanceof ImageBitmap)===!1){let J=We.getPrimaries(We.workingColorSpace),ue=M.colorSpace===Wi?null:We.getPrimaries(M.colorSpace),ye=M.colorSpace===Wi||J===ue?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,ye)}n.pixelStorei(e.UNPACK_ALIGNMENT,M.unpackAlignment);let K=m(M.image,!1,r.maxTextureSize);K=tt(M,K);let ve=s.convert(M.format,M.colorSpace),Ee=s.convert(M.type),de=_(M.internalFormat,ve,Ee,M.normalized,M.colorSpace,M.isVideoTexture);Re(q,M);let ae,Ce=M.mipmaps,Le=M.isVideoTexture!==!0,Je=fe.__version===void 0||ie===!0,B=ce.dataReady,he=w(M,K);if(M.isDepthTexture){if(de=x(M.format===Hi,M.type),Je)if(Le)n.texStorage2D(e.TEXTURE_2D,1,de,K.width,K.height);else n.texImage2D(e.TEXTURE_2D,0,de,K.width,K.height,0,ve,Ee,null)}else if(M.isDataTexture)if(Ce.length>0){if(Le&&Je)n.texStorage2D(e.TEXTURE_2D,he,de,Ce[0].width,Ce[0].height);for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],Le){if(B)n.texSubImage2D(e.TEXTURE_2D,J,0,0,ae.width,ae.height,ve,Ee,ae.data)}else n.texImage2D(e.TEXTURE_2D,J,de,ae.width,ae.height,0,ve,Ee,ae.data);M.generateMipmaps=!1}else if(Le){if(Je)n.texStorage2D(e.TEXTURE_2D,he,de,K.width,K.height);if(B)le(M,K,ve,Ee)}else n.texImage2D(e.TEXTURE_2D,0,de,K.width,K.height,0,ve,Ee,K.data);else if(M.isCompressedTexture)if(M.isCompressedArrayTexture){if(Le&&Je)n.texStorage3D(e.TEXTURE_2D_ARRAY,he,de,Ce[0].width,Ce[0].height,K.depth);for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],M.format!==kn)if(ve!==null)if(Le){if(B)if(M.layerUpdates.size>0){let ye=Ph(ae.width,ae.height,M.format,M.type);for(let ne of M.layerUpdates){let me=ae.data.subarray(ne*ye/ae.data.BYTES_PER_ELEMENT,(ne+1)*ye/ae.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,J,0,0,ne,ae.width,ae.height,1,ve,me)}}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,J,0,0,0,ae.width,ae.height,K.depth,ve,ae.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,J,de,ae.width,ae.height,K.depth,0,ae.data,0,0);else Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(Le){if(B)n.texSubImage3D(e.TEXTURE_2D_ARRAY,J,0,0,0,ae.width,ae.height,K.depth,ve,Ee,ae.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,J,de,ae.width,ae.height,K.depth,0,ve,Ee,ae.data);if(M.layerUpdates.size>0)M.clearLayerUpdates()}else{if(Le&&Je)n.texStorage2D(e.TEXTURE_2D,he,de,Ce[0].width,Ce[0].height);for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],M.format!==kn)if(ve!==null)if(Le){if(B)n.compressedTexSubImage2D(e.TEXTURE_2D,J,0,0,ae.width,ae.height,ve,ae.data)}else n.compressedTexImage2D(e.TEXTURE_2D,J,de,ae.width,ae.height,0,ae.data);else Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(Le){if(B)n.texSubImage2D(e.TEXTURE_2D,J,0,0,ae.width,ae.height,ve,Ee,ae.data)}else n.texImage2D(e.TEXTURE_2D,J,de,ae.width,ae.height,0,ve,Ee,ae.data)}else if(M.isDataArrayTexture)if(Le){if(Je)n.texStorage3D(e.TEXTURE_2D_ARRAY,he,de,K.width,K.height,K.depth);if(B)if(M.layerUpdates.size>0){let J=Ph(K.width,K.height,M.format,M.type);for(let ue of M.layerUpdates){let ye=K.data.subarray(ue*J/K.data.BYTES_PER_ELEMENT,(ue+1)*J/K.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,ue,K.width,K.height,1,ve,Ee,ye)}M.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,K.width,K.height,K.depth,ve,Ee,K.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,de,K.width,K.height,K.depth,0,ve,Ee,K.data);else if(M.isData3DTexture)if(Le){if(Je)n.texStorage3D(e.TEXTURE_3D,he,de,K.width,K.height,K.depth);if(B)n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,K.width,K.height,K.depth,ve,Ee,K.data)}else n.texImage3D(e.TEXTURE_3D,0,de,K.width,K.height,K.depth,0,ve,Ee,K.data);else if(M.isFramebufferTexture){if(Je)if(Le)n.texStorage2D(e.TEXTURE_2D,he,de,K.width,K.height);else{let J=K.width,ue=K.height;for(let ye=0;ye<he;ye++)n.texImage2D(e.TEXTURE_2D,ye,de,J,ue,0,ve,Ee,null),J>>=1,ue>>=1}}else if(M.isHTMLTexture){if("texElementImage2D"in e){let J=e.canvas;if(!J.hasAttribute("layoutsubtree"))J.setAttribute("layoutsubtree","true");if(K.parentNode!==J){J.appendChild(K),f.add(M),J.onpaint=(ue)=>{let ye=ue.changedElements;for(let ne of f)if(ye.includes(ne.image))ne.needsUpdate=!0},J.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,K);else{let{RGBA:ye,RGBA:ne,UNSIGNED_BYTE:me}=e;e.texElementImage2D(e.TEXTURE_2D,0,ye,ne,me,K)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(Ce.length>0){if(Le&&Je){let J=yt(Ce[0]);n.texStorage2D(e.TEXTURE_2D,he,de,J.width,J.height)}for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],Le){if(B)n.texSubImage2D(e.TEXTURE_2D,J,0,0,ve,Ee,ae)}else n.texImage2D(e.TEXTURE_2D,J,de,ve,Ee,ae);M.generateMipmaps=!1}else if(Le){if(Je){let J=yt(K);n.texStorage2D(e.TEXTURE_2D,he,de,J.width,J.height)}if(B)n.texSubImage2D(e.TEXTURE_2D,0,0,0,ve,Ee,K)}else n.texImage2D(e.TEXTURE_2D,0,de,ve,Ee,K);if(d(M))b(q);if(fe.__version=ce.version,M.onUpdate)M.onUpdate(M)}C.__version=M.version}function Oe(C,M,O){if(M.image.length!==6)return;let q=X(C,M),ie=M.source;n.bindTexture(e.TEXTURE_CUBE_MAP,C.__webglTexture,e.TEXTURE0+O);let ce=i.get(ie);if(ie.version!==ce.__version||q===!0){n.activeTexture(e.TEXTURE0+O);let fe=We.getPrimaries(We.workingColorSpace),Z=M.colorSpace===Wi?null:We.getPrimaries(M.colorSpace),K=M.colorSpace===Wi||fe===Z?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,M.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,K);let ve=M.isCompressedTexture||M.image[0].isCompressedTexture,Ee=M.image[0]&&M.image[0].isDataTexture,de=[];for(let ne=0;ne<6;ne++){if(!ve&&!Ee)de[ne]=m(M.image[ne],!0,r.maxCubemapSize);else de[ne]=Ee?M.image[ne].image:M.image[ne];de[ne]=tt(M,de[ne])}let ae=de[0],Ce=s.convert(M.format,M.colorSpace),Le=s.convert(M.type),Je=_(M.internalFormat,Ce,Le,M.normalized,M.colorSpace),B=M.isVideoTexture!==!0,he=ce.__version===void 0||q===!0,J=ie.dataReady,ue=w(M,ae);Re(e.TEXTURE_CUBE_MAP,M);let ye;if(ve){if(B&&he)n.texStorage2D(e.TEXTURE_CUBE_MAP,ue,Je,ae.width,ae.height);for(let ne=0;ne<6;ne++){ye=de[ne].mipmaps;for(let me=0;me<ye.length;me++){let ke=ye[me];if(M.format!==kn)if(Ce!==null)if(B){if(J)n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me,0,0,ke.width,ke.height,Ce,ke.data)}else n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me,Je,ke.width,ke.height,0,ke.data);else Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()");else if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me,0,0,ke.width,ke.height,Ce,Le,ke.data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me,Je,ke.width,ke.height,0,Ce,Le,ke.data)}}}else{if(ye=M.mipmaps,B&&he){if(ye.length>0)ue++;let ne=yt(de[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,ue,Je,ne.width,ne.height)}for(let ne=0;ne<6;ne++)if(Ee){if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,0,0,de[ne].width,de[ne].height,Ce,Le,de[ne].data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,Je,de[ne].width,de[ne].height,0,Ce,Le,de[ne].data);for(let me=0;me<ye.length;me++){let ut=ye[me].image[ne].image;if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me+1,0,0,ut.width,ut.height,Ce,Le,ut.data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me+1,Je,ut.width,ut.height,0,Ce,Le,ut.data)}}else{if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,0,0,Ce,Le,de[ne])}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,Je,Ce,Le,de[ne]);for(let me=0;me<ye.length;me++){let ke=ye[me];if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me+1,0,0,Ce,Le,ke.image[ne])}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me+1,Je,Ce,Le,ke.image[ne])}}}if(d(M))b(e.TEXTURE_CUBE_MAP);if(ce.__version=ie.version,M.onUpdate)M.onUpdate(M)}C.__version=M.version}function Ae(C,M,O,q,ie,ce){let fe=s.convert(O.format,O.colorSpace),Z=s.convert(O.type),K=_(O.internalFormat,fe,Z,O.normalized,O.colorSpace),ve=i.get(M),Ee=i.get(O);if(Ee.__renderTarget=M,!ve.__hasExternalTextures){let de=Math.max(1,M.width>>ce),ae=Math.max(1,M.height>>ce);if(ie===e.TEXTURE_3D||ie===e.TEXTURE_2D_ARRAY)n.texImage3D(ie,ce,K,de,ae,M.depth,0,fe,Z,null);else n.texImage2D(ie,ce,K,de,ae,0,fe,Z,null)}if(n.bindFramebuffer(e.FRAMEBUFFER,C),U(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,q,ie,Ee.__webglTexture,0,Ct(M));else if(ie===e.TEXTURE_2D||ie>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&ie<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)e.framebufferTexture2D(e.FRAMEBUFFER,q,ie,Ee.__webglTexture,ce);n.bindFramebuffer(e.FRAMEBUFFER,null)}function Et(C,M,O){if(e.bindRenderbuffer(e.RENDERBUFFER,C),M.depthBuffer){let q=M.depthTexture,ie=q&&q.isDepthTexture?q.type:null,ce=x(M.stencilBuffer,ie),fe=M.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(U(M))a.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Ct(M),ce,M.width,M.height);else if(O)e.renderbufferStorageMultisample(e.RENDERBUFFER,Ct(M),ce,M.width,M.height);else e.renderbufferStorage(e.RENDERBUFFER,ce,M.width,M.height);e.framebufferRenderbuffer(e.FRAMEBUFFER,fe,e.RENDERBUFFER,C)}else{let q=M.textures;for(let ie=0;ie<q.length;ie++){let ce=q[ie],fe=s.convert(ce.format,ce.colorSpace),Z=s.convert(ce.type),K=_(ce.internalFormat,fe,Z,ce.normalized,ce.colorSpace);if(U(M))a.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,Ct(M),K,M.width,M.height);else if(O)e.renderbufferStorageMultisample(e.RENDERBUFFER,Ct(M),K,M.width,M.height);else e.renderbufferStorage(e.RENDERBUFFER,K,M.width,M.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function qe(C,M,O){let q=M.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,C),!(M.depthTexture&&M.depthTexture.isDepthTexture))throw Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let ie=i.get(M.depthTexture);if(ie.__renderTarget=M,!ie.__webglTexture||M.depthTexture.image.width!==M.width||M.depthTexture.image.height!==M.height)M.depthTexture.image.width=M.width,M.depthTexture.image.height=M.height,M.depthTexture.needsUpdate=!0;if(q){if(ie.__webglInit===void 0)ie.__webglInit=!0,M.depthTexture.addEventListener("dispose",E);if(ie.__webglTexture===void 0){ie.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,ie.__webglTexture),Re(e.TEXTURE_CUBE_MAP,M.depthTexture);let ve=s.convert(M.depthTexture.format),Ee=s.convert(M.depthTexture.type),de;if(M.depthTexture.format===Gi)de=e.DEPTH_COMPONENT24;else if(M.depthTexture.format===Hi)de=e.DEPTH24_STENCIL8;for(let ae=0;ae<6;ae++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ae,0,de,M.width,M.height,0,ve,Ee,null)}}else te(M.depthTexture,0);let ce=ie.__webglTexture,fe=Ct(M),Z=q?e.TEXTURE_CUBE_MAP_POSITIVE_X+O:e.TEXTURE_2D,K=M.depthTexture.format===Hi?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(M.depthTexture.format===Gi)if(U(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,K,Z,ce,0,fe);else e.framebufferTexture2D(e.FRAMEBUFFER,K,Z,ce,0);else if(M.depthTexture.format===Hi)if(U(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,K,Z,ce,0,fe);else e.framebufferTexture2D(e.FRAMEBUFFER,K,Z,ce,0);else throw Error("THREE.WebGLTextures: Unknown depthTexture format.")}function je(C){let M=i.get(C),O=C.isWebGLCubeRenderTarget===!0;if(M.__boundDepthTexture!==C.depthTexture){let q=C.depthTexture;if(M.__depthDisposeCallback)M.__depthDisposeCallback();if(q){let ie=()=>{delete M.__boundDepthTexture,delete M.__depthDisposeCallback,q.removeEventListener("dispose",ie)};q.addEventListener("dispose",ie),M.__depthDisposeCallback=ie}M.__boundDepthTexture=q}if(C.depthTexture&&!M.__autoAllocateDepthBuffer)if(O)for(let q=0;q<6;q++)qe(M.__webglFramebuffer[q],C,q);else{let q=C.texture.mipmaps;if(q&&q.length>0)qe(M.__webglFramebuffer[0],C,0);else qe(M.__webglFramebuffer,C,0)}else if(O){M.__webglDepthbuffer=[];for(let q=0;q<6;q++)if(n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer[q]),M.__webglDepthbuffer[q]===void 0)M.__webglDepthbuffer[q]=e.createRenderbuffer(),Et(M.__webglDepthbuffer[q],C,!1);else{let ie=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ce=M.__webglDepthbuffer[q];e.bindRenderbuffer(e.RENDERBUFFER,ce),e.framebufferRenderbuffer(e.FRAMEBUFFER,ie,e.RENDERBUFFER,ce)}}else{let q=C.texture.mipmaps;if(q&&q.length>0)n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer[0]);else n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer);if(M.__webglDepthbuffer===void 0)M.__webglDepthbuffer=e.createRenderbuffer(),Et(M.__webglDepthbuffer,C,!1);else{let ie=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ce=M.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,ce),e.framebufferRenderbuffer(e.FRAMEBUFFER,ie,e.RENDERBUFFER,ce)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function rt(C,M,O){let q=i.get(C);if(M!==void 0)Ae(q.__webglFramebuffer,C,C.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0);if(O!==void 0)je(C)}function Ye(C){let M=C.texture,O=i.get(C),q=i.get(M);C.addEventListener("dispose",v);let ie=C.textures,ce=C.isWebGLCubeRenderTarget===!0,fe=ie.length>1;if(!fe){if(q.__webglTexture===void 0)q.__webglTexture=e.createTexture();q.__version=M.version,o.memory.textures++}if(ce){O.__webglFramebuffer=[];for(let Z=0;Z<6;Z++)if(M.mipmaps&&M.mipmaps.length>0){O.__webglFramebuffer[Z]=[];for(let K=0;K<M.mipmaps.length;K++)O.__webglFramebuffer[Z][K]=e.createFramebuffer()}else O.__webglFramebuffer[Z]=e.createFramebuffer()}else{if(M.mipmaps&&M.mipmaps.length>0){O.__webglFramebuffer=[];for(let Z=0;Z<M.mipmaps.length;Z++)O.__webglFramebuffer[Z]=e.createFramebuffer()}else O.__webglFramebuffer=e.createFramebuffer();if(fe)for(let Z=0,K=ie.length;Z<K;Z++){let ve=i.get(ie[Z]);if(ve.__webglTexture===void 0)ve.__webglTexture=e.createTexture(),o.memory.textures++}if(C.samples>0&&U(C)===!1){O.__webglMultisampledFramebuffer=e.createFramebuffer(),O.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,O.__webglMultisampledFramebuffer);for(let Z=0;Z<ie.length;Z++){let K=ie[Z];O.__webglColorRenderbuffer[Z]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,O.__webglColorRenderbuffer[Z]);let ve=s.convert(K.format,K.colorSpace),Ee=s.convert(K.type),de=_(K.internalFormat,ve,Ee,K.normalized,K.colorSpace,C.isXRRenderTarget===!0),ae=Ct(C);e.renderbufferStorageMultisample(e.RENDERBUFFER,ae,de,C.width,C.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+Z,e.RENDERBUFFER,O.__webglColorRenderbuffer[Z])}if(e.bindRenderbuffer(e.RENDERBUFFER,null),C.depthBuffer)O.__webglDepthRenderbuffer=e.createRenderbuffer(),Et(O.__webglDepthRenderbuffer,C,!0);n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(ce){n.bindTexture(e.TEXTURE_CUBE_MAP,q.__webglTexture),Re(e.TEXTURE_CUBE_MAP,M);for(let Z=0;Z<6;Z++)if(M.mipmaps&&M.mipmaps.length>0)for(let K=0;K<M.mipmaps.length;K++)Ae(O.__webglFramebuffer[Z][K],C,M,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,K);else Ae(O.__webglFramebuffer[Z],C,M,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0);if(d(M))b(e.TEXTURE_CUBE_MAP);n.unbindTexture()}else if(fe){for(let Z=0,K=ie.length;Z<K;Z++){let ve=ie[Z],Ee=i.get(ve),de=e.TEXTURE_2D;if(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)de=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY;if(n.bindTexture(de,Ee.__webglTexture),Re(de,ve),Ae(O.__webglFramebuffer,C,ve,e.COLOR_ATTACHMENT0+Z,de,0),d(ve))b(de)}n.unbindTexture()}else{let Z=e.TEXTURE_2D;if(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)Z=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY;if(n.bindTexture(Z,q.__webglTexture),Re(Z,M),M.mipmaps&&M.mipmaps.length>0)for(let K=0;K<M.mipmaps.length;K++)Ae(O.__webglFramebuffer[K],C,M,e.COLOR_ATTACHMENT0,Z,K);else Ae(O.__webglFramebuffer,C,M,e.COLOR_ATTACHMENT0,Z,0);if(d(M))b(Z);n.unbindTexture()}if(C.depthBuffer)je(C)}function Bt(C){let M=C.textures;for(let O=0,q=M.length;O<q;O++){let ie=M[O];if(d(ie)){let ce=S(C),fe=i.get(ie).__webglTexture;n.bindTexture(ce,fe),b(ce),n.unbindTexture()}}}let dt=[],tn=[];function At(C){if(C.samples>0){if(U(C)===!1){let{textures:M,width:O,height:q}=C,ie=e.COLOR_BUFFER_BIT,ce=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,fe=i.get(C),Z=M.length>1;if(Z)for(let ve=0;ve<M.length;ve++)n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,fe.__webglMultisampledFramebuffer);let K=C.texture.mipmaps;if(K&&K.length>0)n.bindFramebuffer(e.DRAW_FRAMEBUFFER,fe.__webglFramebuffer[0]);else n.bindFramebuffer(e.DRAW_FRAMEBUFFER,fe.__webglFramebuffer);for(let ve=0;ve<M.length;ve++){if(C.resolveDepthBuffer){if(C.depthBuffer)ie|=e.DEPTH_BUFFER_BIT;if(C.stencilBuffer&&C.resolveStencilBuffer)ie|=e.STENCIL_BUFFER_BIT}if(Z){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,fe.__webglColorRenderbuffer[ve]);let Ee=i.get(M[ve]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,Ee,0)}if(e.blitFramebuffer(0,0,O,q,0,0,O,q,ie,e.NEAREST),l===!0){if(dt.length=0,tn.length=0,dt.push(e.COLOR_ATTACHMENT0+ve),C.depthBuffer&&C.storeMultisampledDepthBuffer===!1)dt.push(ce),tn.push(ce),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,tn);e.invalidateFramebuffer(e.READ_FRAMEBUFFER,dt)}}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),Z)for(let ve=0;ve<M.length;ve++){n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.RENDERBUFFER,fe.__webglColorRenderbuffer[ve]);let Ee=i.get(M[ve]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.TEXTURE_2D,Ee,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,fe.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.storeMultisampledDepthBuffer===!1&&l){let M=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[M])}}}function Ct(C){return Math.min(r.maxSamples,C.samples)}function U(C){let M=i.get(C);return C.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&M.__useRenderToTexture!==!1}function nn(C){let M=o.render.frame;if(h.get(C)!==M)h.set(C,M),C.update()}function tt(C,M){let{colorSpace:O,format:q,type:ie}=C;if(C.isCompressedTexture===!0||C.isVideoTexture===!0)return M;if(O!==qc&&O!==Wi)if(We.getTransfer(O)===at){if(q!==kn||ie!==Pn)Ie("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.")}else De("WebGLTextures: Unsupported texture color space:",O);return M}function yt(C){if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement)c.width=C.naturalWidth||C.width,c.height=C.naturalHeight||C.height;else if(typeof VideoFrame<"u"&&C instanceof VideoFrame)c.width=C.displayWidth,c.height=C.displayHeight;else c.width=C.width,c.height=C.height;return c}this.allocateTextureUnit=k,this.resetTextureUnits=W,this.getTextureUnits=R,this.setTextureUnits=I,this.setTexture2D=te,this.setTexture2DArray=Y,this.setTexture3D=Q,this.setTextureCube=G,this.rebindTextures=rt,this.setupRenderTarget=Ye,this.updateRenderTargetMipmap=Bt,this.updateMultisampleRenderTarget=At,this.setupDepthRenderbuffer=je,this.setupFrameBufferTexture=Ae,this.useMultisampledRTT=U,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function ZM(e,t){function n(i,r=Wi){let s,o=We.getTransfer(r);if(i===Pn)return e.UNSIGNED_BYTE;if(i===hc)return e.UNSIGNED_SHORT_4_4_4_4;if(i===uc)return e.UNSIGNED_SHORT_5_5_5_1;if(i===sm)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===om)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===im)return e.BYTE;if(i===rm)return e.SHORT;if(i===Rs)return e.UNSIGNED_SHORT;if(i===cc)return e.INT;if(i===yi)return e.UNSIGNED_INT;if(i===ii)return e.FLOAT;if(i===qt)return e.HALF_FLOAT;if(i===am)return e.ALPHA;if(i===lm)return e.RGB;if(i===kn)return e.RGBA;if(i===Gi)return e.DEPTH_COMPONENT;if(i===Hi)return e.DEPTH_STENCIL;if(i===cm)return e.RED;if(i===fc)return e.RED_INTEGER;if(i===Vi)return e.RG;if(i===dc)return e.RG_INTEGER;if(i===pc)return e.RGBA_INTEGER;if(i===ia||i===ra||i===sa||i===oa)if(o===at)if(s=t.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===ia)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===ra)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===sa)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===oa)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=t.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===ia)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===ra)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===sa)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===oa)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===mc||i===gc||i===_c||i===vc)if(s=t.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===mc)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===gc)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===_c)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===vc)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===yc||i===xc||i===bc||i===Sc||i===Mc||i===aa||i===wc)if(s=t.get("WEBGL_compressed_texture_etc"),s!==null){if(i===yc||i===xc)return o===at?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===bc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(i===Sc)return s.COMPRESSED_R11_EAC;if(i===Mc)return s.COMPRESSED_SIGNED_R11_EAC;if(i===aa)return s.COMPRESSED_RG11_EAC;if(i===wc)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Tc||i===Ec||i===Ac||i===Cc||i===Rc||i===Pc||i===Ic||i===Lc||i===Dc||i===Nc||i===Oc||i===Uc||i===Fc||i===Bc)if(s=t.get("WEBGL_compressed_texture_astc"),s!==null){if(i===Tc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Ec)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Ac)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Cc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Rc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Pc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Ic)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Lc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Dc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Nc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Oc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Uc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Fc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Bc)return o===at?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===kc||i===zc||i===Gc)if(s=t.get("EXT_texture_compression_bptc"),s!==null){if(i===kc)return o===at?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===zc)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Gc)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Hc||i===Vc||i===la||i===Wc)if(s=t.get("EXT_texture_compression_rgtc"),s!==null){if(i===Hc)return s.COMPRESSED_RED_RGTC1_EXT;if(i===Vc)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===la)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Wc)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;if(i===Nr)return e.UNSIGNED_INT_24_8;return e[i]!==void 0?e[i]:null}return{convert:n}}var JM=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,KM=`
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

}`;class sg{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new ya(e.texture);if(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)this.depthNear=e.depthNear,this.depthFar=e.depthFar;this.texture=n}}getMesh(e){if(this.texture!==null){if(this.mesh===null){let t=e.cameras[0].viewport,n=new Tt({vertexShader:JM,fragmentShader:KM,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new zt(new Bs(20,20),n)}}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class og extends zn{constructor(e,t){super();let n=this,i=null,r=1,s=null,o="local-floor",a=1,l=null,c=null,h=null,f=null,u=null,p=null,g=typeof XRWebGLBinding<"u",y=new sg,m={},d=t.getContextAttributes(),b=null,S=null,_=[],x=[],w=new re,E=null,v=null,A=new Kt;A.viewport=new gt;let N=new Kt;N.viewport=new gt;let P=[A,N],D=new Eh,W=null,R=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(X){let se=_[X];if(se===void 0)se=new Ls,_[X]=se;return se.getTargetRaySpace()},this.getControllerGrip=function(X){let se=_[X];if(se===void 0)se=new Ls,_[X]=se;return se.getGripSpace()},this.getHand=function(X){let se=_[X];if(se===void 0)se=new Ls,_[X]=se;return se.getHandSpace()};function I(X){let se=x.indexOf(X.inputSource);if(se===-1)return;let le=_[se];if(le!==void 0)le.update(X.inputSource,X.frame,l||s),le.dispatchEvent({type:X.type,data:X.inputSource})}function k(){i.removeEventListener("select",I),i.removeEventListener("selectstart",I),i.removeEventListener("selectend",I),i.removeEventListener("squeeze",I),i.removeEventListener("squeezestart",I),i.removeEventListener("squeezeend",I),i.removeEventListener("end",k),i.removeEventListener("inputsourceschange",z);for(let X=0;X<_.length;X++){let se=x[X];if(se===null)continue;x[X]=null,_[X].disconnect(se)}W=null,R=null,y.reset();for(let X in m)delete m[X];if(e.setRenderTarget(b),u=null,f=null,h=null,i=null,S=null,Re.stop(),n.isPresenting=!1,e.setPixelRatio(E),e.setSize(w.width,w.height,!1),v!==null){let X=v.camera;X.fov=v.fov,X.zoom=v.zoom,X.updateProjectionMatrix(),v=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(X){if(r=X,n.isPresenting===!0)Ie("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(X){if(o=X,n.isPresenting===!0)Ie("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||s},this.setReferenceSpace=function(X){l=X},this.getBaseLayer=function(){return f!==null?f:u},this.getBinding=function(){if(h===null&&g)h=new XRWebGLBinding(i,t);return h},this.getFrame=function(){return p},this.getSession=function(){return i},this.setSession=async function(X){if(i=X,i!==null){if(b=e.getRenderTarget(),i.addEventListener("select",I),i.addEventListener("selectstart",I),i.addEventListener("selectend",I),i.addEventListener("squeeze",I),i.addEventListener("squeezestart",I),i.addEventListener("squeezeend",I),i.addEventListener("end",k),i.addEventListener("inputsourceschange",z),d.xrCompatible!==!0)await t.makeXRCompatible();if(E=e.getPixelRatio(),e.getSize(w),!(g&&("createProjectionLayer"in XRWebGLBinding.prototype))){let le={antialias:d.antialias,alpha:!0,depth:d.depth,stencil:d.stencil,framebufferScaleFactor:r};u=new XRWebGLLayer(i,t,le),i.updateRenderState({baseLayer:u}),e.setPixelRatio(1),e.setSize(u.framebufferWidth,u.framebufferHeight,!1),S=new Pt(u.framebufferWidth,u.framebufferHeight,{format:kn,type:Pn,colorSpace:e.outputColorSpace,stencilBuffer:d.stencil,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}else{let le=null,Pe=null,Oe=null;if(d.depth)Oe=d.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,le=d.stencil?Hi:Gi,Pe=d.stencil?Nr:yi;let Ae={colorFormat:t.RGBA8,depthFormat:Oe,scaleFactor:r};h=this.getBinding(),f=h.createProjectionLayer(Ae),i.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),S=new Pt(f.textureWidth,f.textureHeight,{format:kn,type:Pn,depthTexture:new qi(f.textureWidth,f.textureHeight,Pe,void 0,void 0,void 0,void 0,void 0,void 0,le),stencilBuffer:d.stencil,colorSpace:e.outputColorSpace,samples:d.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(a),l=null,s=await i.requestReferenceSpace(o),Re.setContext(i),Re.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return y.getDepthTexture()};function z(X){for(let se=0;se<X.removed.length;se++){let le=X.removed[se],Pe=x.indexOf(le);if(Pe>=0)x[Pe]=null,_[Pe].disconnect(le)}for(let se=0;se<X.added.length;se++){let le=X.added[se],Pe=x.indexOf(le);if(Pe===-1){for(let Ae=0;Ae<_.length;Ae++)if(Ae>=x.length){x.push(le),Pe=Ae;break}else if(x[Ae]===null){x[Ae]=le,Pe=Ae;break}if(Pe===-1)break}let Oe=_[Pe];if(Oe)Oe.connect(le)}}let te=new L,Y=new L;function Q(X,se,le){te.setFromMatrixPosition(se.matrixWorld),Y.setFromMatrixPosition(le.matrixWorld);let Pe=te.distanceTo(Y),Oe=se.projectionMatrix.elements,Ae=le.projectionMatrix.elements,Et=Oe[14]/(Oe[10]-1),qe=Oe[14]/(Oe[10]+1),je=(Oe[9]+1)/Oe[5],rt=(Oe[9]-1)/Oe[5],Ye=(Oe[8]-1)/Oe[0],Bt=(Ae[8]+1)/Ae[0],dt=Et*Ye,tn=Et*Bt,At=Pe/(-Ye+Bt),Ct=At*-Ye;if(se.matrixWorld.decompose(X.position,X.quaternion,X.scale),X.translateX(Ct),X.translateZ(At),X.matrixWorld.compose(X.position,X.quaternion,X.scale),X.matrixWorldInverse.copy(X.matrixWorld).invert(),Oe[10]===-1)X.projectionMatrix.copy(se.projectionMatrix),X.projectionMatrixInverse.copy(se.projectionMatrixInverse);else{let U=Et+At,nn=qe+At,tt=dt-Ct,yt=tn+(Pe-Ct),C=je*qe/nn*U,M=rt*qe/nn*U;X.projectionMatrix.makePerspective(tt,yt,C,M,U,nn),X.projectionMatrixInverse.copy(X.projectionMatrix).invert()}}function G(X,se){if(se===null)X.matrixWorld.copy(X.matrix);else X.matrixWorld.multiplyMatrices(se.matrixWorld,X.matrix);X.matrixWorldInverse.copy(X.matrixWorld).invert()}this.updateCamera=function(X){if(i===null)return;let{near:se,far:le}=X;if(y.texture!==null){if(y.depthNear>0)se=y.depthNear;if(y.depthFar>0)le=y.depthFar}if(D.near=N.near=A.near=se,D.far=N.far=A.far=le,W!==D.near||R!==D.far)i.updateRenderState({depthNear:D.near,depthFar:D.far}),W=D.near,R=D.far;D.layers.mask=X.layers.mask|6,A.layers.mask=D.layers.mask&-5,N.layers.mask=D.layers.mask&-3;let Pe=X.parent,Oe=D.cameras;G(D,Pe);for(let Ae=0;Ae<Oe.length;Ae++)G(Oe[Ae],Pe);if(Oe.length===2)Q(D,A,N);else D.projectionMatrix.copy(A.projectionMatrix);if(v===null&&X.isPerspectiveCamera)v={camera:X,fov:X.fov,zoom:X.zoom};ee(X,D,Pe)};function ee(X,se,le){if(le===null)X.matrix.copy(se.matrixWorld);else X.matrix.copy(le.matrixWorld),X.matrix.invert(),X.matrix.multiply(se.matrixWorld);if(X.matrix.decompose(X.position,X.quaternion,X.scale),X.updateMatrixWorld(!0),X.projectionMatrix.copy(se.projectionMatrix),X.projectionMatrixInverse.copy(se.projectionMatrixInverse),X.isPerspectiveCamera)X.fov=Rr*2*Math.atan(1/X.projectionMatrix.elements[5]),X.zoom=1}this.getCamera=function(){return D},this.getFoveation=function(){if(f===null&&u===null)return;return a},this.setFoveation=function(X){if(a=X,f!==null)f.fixedFoveation=X;if(u!==null&&u.fixedFoveation!==void 0)u.fixedFoveation=X},this.hasDepthSensing=function(){return y.texture!==null},this.getDepthSensingMesh=function(){return y.getMesh(D)},this.getCameraTexture=function(X){return m[X]};let oe=null;function Ue(X,se){if(c=se.getViewerPose(l||s),p=se,c!==null){let le=c.views;if(u!==null)e.setRenderTargetFramebuffer(S,u.framebuffer),e.setRenderTarget(S);let Pe=!1;if(le.length!==D.cameras.length)D.cameras.length=0,Pe=!0;for(let qe=0;qe<le.length;qe++){let je=le[qe],rt=null;if(u!==null)rt=u.getViewport(je);else{let Bt=h.getViewSubImage(f,je);if(rt=Bt.viewport,qe===0)e.setRenderTargetTextures(S,Bt.colorTexture,Bt.depthStencilTexture),e.setRenderTarget(S)}let Ye=P[qe];if(Ye===void 0)Ye=new Kt,Ye.layers.enable(qe),Ye.viewport=new gt,P[qe]=Ye;if(Ye.matrix.fromArray(je.transform.matrix),Ye.matrix.decompose(Ye.position,Ye.quaternion,Ye.scale),Ye.projectionMatrix.fromArray(je.projectionMatrix),Ye.projectionMatrixInverse.copy(Ye.projectionMatrix).invert(),Ye.viewport.set(rt.x,rt.y,rt.width,rt.height),qe===0)D.matrix.copy(Ye.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale);if(Pe===!0)D.cameras.push(Ye)}let Oe=i.enabledFeatures;if(Oe&&Oe.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&g){h=n.getBinding();let qe=h.getDepthInformation(le[0]);if(qe&&qe.isValid&&qe.texture)y.init(qe,i.renderState)}if(Oe&&Oe.includes("camera-access")&&g){e.state.unbindTexture(),h=n.getBinding();for(let qe=0;qe<le.length;qe++){let je=le[qe].camera;if(je){let rt=m[je];if(!rt)rt=new ya,m[je]=rt;let Ye=h.getCameraImage(je);rt.sourceTexture=Ye}}}}for(let le=0;le<_.length;le++){let Pe=x[le],Oe=_[le];if(Pe!==null&&Oe!==void 0)Oe.update(Pe,se,l||s)}if(oe)oe(X,se);if(se.detectedPlanes)n.dispatchEvent({type:"planesdetected",data:se});p=null}let Re=new Ym;Re.setAnimationLoop(Ue),this.setAnimationLoop=function(X){oe=X},this.dispose=function(){}}}var QM=new Ke,ag=new Be;ag.set(-1,0,0,0,1,0,0,0,1);function ew(e,t){function n(m,d){if(m.matrixAutoUpdate===!0)m.updateMatrix();d.value.copy(m.matrix)}function i(m,d){if(d.color.getRGB(m.fogColor.value,uh(e)),d.isFog)m.fogNear.value=d.near,m.fogFar.value=d.far;else if(d.isFogExp2)m.fogDensity.value=d.density}function r(m,d,b,S,_){if(d.isNodeMaterial)d.uniformsNeedUpdate=!1;else if(d.isMeshBasicMaterial)s(m,d);else if(d.isMeshLambertMaterial){if(s(m,d),d.envMap)m.envMapIntensity.value=d.envMapIntensity}else if(d.isMeshToonMaterial)s(m,d),f(m,d);else if(d.isMeshPhongMaterial){if(s(m,d),h(m,d),d.envMap)m.envMapIntensity.value=d.envMapIntensity}else if(d.isMeshStandardMaterial){if(s(m,d),u(m,d),d.isMeshPhysicalMaterial)p(m,d,_)}else if(d.isMeshMatcapMaterial)s(m,d),g(m,d);else if(d.isMeshDepthMaterial)s(m,d);else if(d.isMeshDistanceMaterial)s(m,d),y(m,d);else if(d.isMeshNormalMaterial)s(m,d);else if(d.isLineBasicMaterial){if(o(m,d),d.isLineDashedMaterial)a(m,d)}else if(d.isPointsMaterial)l(m,d,b,S);else if(d.isSpriteMaterial)c(m,d);else if(d.isShadowMaterial)m.color.value.copy(d.color),m.opacity.value=d.opacity;else if(d.isShaderMaterial)d.uniformsNeedUpdate=!1}function s(m,d){if(m.opacity.value=d.opacity,d.color)m.diffuse.value.copy(d.color);if(d.emissive)m.emissive.value.copy(d.emissive).multiplyScalar(d.emissiveIntensity);if(d.map)m.map.value=d.map,n(d.map,m.mapTransform);if(d.alphaMap)m.alphaMap.value=d.alphaMap,n(d.alphaMap,m.alphaMapTransform);if(d.bumpMap){if(m.bumpMap.value=d.bumpMap,n(d.bumpMap,m.bumpMapTransform),m.bumpScale.value=d.bumpScale,d.side===Xt)m.bumpScale.value*=-1}if(d.normalMap){if(m.normalMap.value=d.normalMap,n(d.normalMap,m.normalMapTransform),m.normalScale.value.copy(d.normalScale),d.side===Xt)m.normalScale.value.negate()}if(d.displacementMap)m.displacementMap.value=d.displacementMap,n(d.displacementMap,m.displacementMapTransform),m.displacementScale.value=d.displacementScale,m.displacementBias.value=d.displacementBias;if(d.emissiveMap)m.emissiveMap.value=d.emissiveMap,n(d.emissiveMap,m.emissiveMapTransform);if(d.specularMap)m.specularMap.value=d.specularMap,n(d.specularMap,m.specularMapTransform);if(d.alphaTest>0)m.alphaTest.value=d.alphaTest;let b=t.get(d),{envMap:S,envMapRotation:_}=b;if(S){if(m.envMap.value=S,m.envMapRotation.value.setFromMatrix4(QM.makeRotationFromEuler(_)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1)m.envMapRotation.value.premultiply(ag);m.reflectivity.value=d.reflectivity,m.ior.value=d.ior,m.refractionRatio.value=d.refractionRatio}if(d.lightMap)m.lightMap.value=d.lightMap,m.lightMapIntensity.value=d.lightMapIntensity,n(d.lightMap,m.lightMapTransform);if(d.aoMap)m.aoMap.value=d.aoMap,m.aoMapIntensity.value=d.aoMapIntensity,n(d.aoMap,m.aoMapTransform)}function o(m,d){if(m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,d.map)m.map.value=d.map,n(d.map,m.mapTransform)}function a(m,d){m.dashSize.value=d.dashSize,m.totalSize.value=d.dashSize+d.gapSize,m.scale.value=d.scale}function l(m,d,b,S){if(m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.size.value=d.size*b,m.scale.value=S*0.5,d.map)m.map.value=d.map,n(d.map,m.uvTransform);if(d.alphaMap)m.alphaMap.value=d.alphaMap,n(d.alphaMap,m.alphaMapTransform);if(d.alphaTest>0)m.alphaTest.value=d.alphaTest}function c(m,d){if(m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.rotation.value=d.rotation,d.map)m.map.value=d.map,n(d.map,m.mapTransform);if(d.alphaMap)m.alphaMap.value=d.alphaMap,n(d.alphaMap,m.alphaMapTransform);if(d.alphaTest>0)m.alphaTest.value=d.alphaTest}function h(m,d){m.specular.value.copy(d.specular),m.shininess.value=Math.max(d.shininess,0.0001)}function f(m,d){if(d.gradientMap)m.gradientMap.value=d.gradientMap}function u(m,d){if(m.metalness.value=d.metalness,d.metalnessMap)m.metalnessMap.value=d.metalnessMap,n(d.metalnessMap,m.metalnessMapTransform);if(m.roughness.value=d.roughness,d.roughnessMap)m.roughnessMap.value=d.roughnessMap,n(d.roughnessMap,m.roughnessMapTransform);if(d.envMap)m.envMapIntensity.value=d.envMapIntensity}function p(m,d,b){if(m.ior.value=d.ior,d.sheen>0){if(m.sheenColor.value.copy(d.sheenColor).multiplyScalar(d.sheen),m.sheenRoughness.value=d.sheenRoughness,d.sheenColorMap)m.sheenColorMap.value=d.sheenColorMap,n(d.sheenColorMap,m.sheenColorMapTransform);if(d.sheenRoughnessMap)m.sheenRoughnessMap.value=d.sheenRoughnessMap,n(d.sheenRoughnessMap,m.sheenRoughnessMapTransform)}if(d.clearcoat>0){if(m.clearcoat.value=d.clearcoat,m.clearcoatRoughness.value=d.clearcoatRoughness,d.clearcoatMap)m.clearcoatMap.value=d.clearcoatMap,n(d.clearcoatMap,m.clearcoatMapTransform);if(d.clearcoatRoughnessMap)m.clearcoatRoughnessMap.value=d.clearcoatRoughnessMap,n(d.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform);if(d.clearcoatNormalMap){if(m.clearcoatNormalMap.value=d.clearcoatNormalMap,n(d.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(d.clearcoatNormalScale),d.side===Xt)m.clearcoatNormalScale.value.negate()}}if(d.dispersion>0)m.dispersion.value=d.dispersion;if(d.retroreflectivity>0)m.retroreflectivity.value=d.retroreflectivity;if(d.iridescence>0){if(m.iridescence.value=d.iridescence,m.iridescenceIOR.value=d.iridescenceIOR,m.iridescenceThicknessMinimum.value=d.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=d.iridescenceThicknessRange[1],d.iridescenceMap)m.iridescenceMap.value=d.iridescenceMap,n(d.iridescenceMap,m.iridescenceMapTransform);if(d.iridescenceThicknessMap)m.iridescenceThicknessMap.value=d.iridescenceThicknessMap,n(d.iridescenceThicknessMap,m.iridescenceThicknessMapTransform)}if(d.transmission>0){if(m.transmission.value=d.transmission,m.transmissionSamplerMap.value=b.texture,m.transmissionSamplerSize.value.set(b.width,b.height),d.transmissionMap)m.transmissionMap.value=d.transmissionMap,n(d.transmissionMap,m.transmissionMapTransform);if(m.thickness.value=d.thickness,d.thicknessMap)m.thicknessMap.value=d.thicknessMap,n(d.thicknessMap,m.thicknessMapTransform);m.attenuationDistance.value=d.attenuationDistance,m.attenuationColor.value.copy(d.attenuationColor)}if(d.anisotropy>0){if(m.anisotropyVector.value.set(d.anisotropy*Math.cos(d.anisotropyRotation),d.anisotropy*Math.sin(d.anisotropyRotation)),d.anisotropyMap)m.anisotropyMap.value=d.anisotropyMap,n(d.anisotropyMap,m.anisotropyMapTransform)}if(m.specularIntensity.value=d.specularIntensity,m.specularColor.value.copy(d.specularColor),d.specularColorMap)m.specularColorMap.value=d.specularColorMap,n(d.specularColorMap,m.specularColorMapTransform);if(d.specularIntensityMap)m.specularIntensityMap.value=d.specularIntensityMap,n(d.specularIntensityMap,m.specularIntensityMapTransform)}function g(m,d){if(d.matcap)m.matcap.value=d.matcap}function y(m,d){let b=t.get(d).light;m.referencePosition.value.setFromMatrixPosition(b.matrixWorld),m.nearDistance.value=b.shadow.camera.near,m.farDistance.value=b.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function tw(e,t,n,i){let r={},s={},o=[],a=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function l(_,x){let w=x.program;i.uniformBlockBinding(_,w)}function c(_,x){let w=r[_.id];if(w===void 0)m(_),w=h(_),r[_.id]=w,_.addEventListener("dispose",b);let E=x.program;i.updateUBOMapping(_,E);let v=t.render.frame;if(s[_.id]!==v)u(_),s[_.id]=v}function h(_){let x=f();_.__bindingPointIndex=x;let w=e.createBuffer(),{__size:E,usage:v}=_;return e.bindBuffer(e.UNIFORM_BUFFER,w),e.bufferData(e.UNIFORM_BUFFER,E,v),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,x,w),w}function f(){for(let _=0;_<a;_++)if(o.indexOf(_)===-1)return o.push(_),_;return De("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(_){let x=r[_.id],{uniforms:w,__cache:E}=_;e.bindBuffer(e.UNIFORM_BUFFER,x);for(let v=0,A=w.length;v<A;v++){let N=w[v];if(Array.isArray(N))for(let P=0,D=N.length;P<D;P++)p(N[P],v,P,E);else p(N,v,0,E)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(_,x,w,E){if(y(_,x,w,E)===!0){let{__offset:v,value:A}=_;if(Array.isArray(A)){let N=0;for(let P=0;P<A.length;P++){let D=A[P],W=d(D);if(g(D,_.__data,N),typeof D!=="number"&&typeof D!=="boolean"&&!D.isMatrix3&&!ArrayBuffer.isView(D))N+=W.storage/Float32Array.BYTES_PER_ELEMENT}}else g(A,_.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,v,_.__data)}}function g(_,x,w){if(typeof _==="number"||typeof _==="boolean")x[0]=_;else if(_.isMatrix3)x[0]=_.elements[0],x[1]=_.elements[1],x[2]=_.elements[2],x[3]=0,x[4]=_.elements[3],x[5]=_.elements[4],x[6]=_.elements[5],x[7]=0,x[8]=_.elements[6],x[9]=_.elements[7],x[10]=_.elements[8],x[11]=0;else if(ArrayBuffer.isView(_))x.set(new _.constructor(_.buffer,_.byteOffset,x.length));else _.toArray(x,w)}function y(_,x,w,E){let v=_.value,A=x+"_"+w;if(E[A]===void 0){if(typeof v==="number"||typeof v==="boolean")E[A]=v;else if(ArrayBuffer.isView(v))E[A]=v.slice();else E[A]=v.clone();return!0}else{let N=E[A];if(typeof v==="number"||typeof v==="boolean"){if(N!==v)return E[A]=v,!0}else if(ArrayBuffer.isView(v))return!0;else if(N.equals(v)===!1)return N.copy(v),!0}return!1}function m(_){let x=_.uniforms,w=0,E=16;for(let A=0,N=x.length;A<N;A++){let P=Array.isArray(x[A])?x[A]:[x[A]];for(let D=0,W=P.length;D<W;D++){let R=P[D],I=Array.isArray(R.value)?R.value:[R.value];for(let k=0,z=I.length;k<z;k++){let te=I[k],Y=d(te),Q=w%E,G=Q%Y.boundary,ee=Q+G;if(w+=G,ee!==0&&E-ee<Y.storage)w+=E-ee;R.__data=new Float32Array(Y.storage/Float32Array.BYTES_PER_ELEMENT),R.__offset=w,w+=Y.storage}}}let v=w%E;if(v>0)w+=E-v;return _.__size=w,_.__cache={},this}function d(_){let x={boundary:0,storage:0};if(typeof _==="number"||typeof _==="boolean")x.boundary=4,x.storage=4;else if(_.isVector2)x.boundary=8,x.storage=8;else if(_.isVector3||_.isColor)x.boundary=16,x.storage=12;else if(_.isVector4)x.boundary=16,x.storage=16;else if(_.isMatrix3)x.boundary=48,x.storage=48;else if(_.isMatrix4)x.boundary=64,x.storage=64;else if(_.isTexture)Ie("WebGLRenderer: Texture samplers can not be part of an uniforms group.");else if(ArrayBuffer.isView(_))x.boundary=16,x.storage=_.byteLength;else Ie("WebGLRenderer: Unsupported uniform value type.",_);return x}function b(_){let x=_.target;x.removeEventListener("dispose",b);let w=o.indexOf(x.__bindingPointIndex);o.splice(w,1),e.deleteBuffer(r[x.id]),delete r[x.id],delete s[x.id]}function S(){for(let _ in r)e.deleteBuffer(r[_]);o=[],r={},s={}}return{bind:l,update:c,dispose:S}}var nw=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Hn=null;function iw(){if(Hn===null)Hn=new th(nw,16,16,Vi,qt),Hn.name="DFG_LUT",Hn.minFilter=an,Hn.magFilter=an,Hn.wrapS=ta,Hn.wrapT=ta,Hn.generateMipmaps=!1,Hn.needsUpdate=!0;return Hn}class Gh{constructor(e={}){let{canvas:t=_m(),context:n=null,depth:i=!0,stencil:r=!1,alpha:s=!1,antialias:o=!1,premultipliedAlpha:a=!0,preserveDrawingBuffer:l=!1,powerPreference:c="default",failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:f=!1,outputBufferType:u=Pn}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=s;let g=u,y=new Set([pc,dc,fc]),m=new Set([Pn,yi,Rs,Nr,hc,uc]),d=new Uint32Array(4),b=new Int32Array(4),S=new L,_=null,x=null,w=[],E=[],v=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Rn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let A=this,N=!1,P=null,D=null,W=null,R=null;this._outputColorSpace=Or;let I=0,k=0,z=null,te=-1,Y=null,Q=new gt,G=new gt,ee=null,oe=new Fe(0),Ue=0,{width:Re,height:X}=t,se=1,le=null,Pe=null,Oe=new gt(0,0,Re,X),Ae=new gt(0,0,Re,X),Et=!1,qe=new Ns,je=!1,rt=!1,Ye=new Ke,Bt=new L,dt=new gt,tn={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},At=!1;function Ct(){return z===null?se:1}let U=n;function nn(T,F){return t.getContext(T,F)}let tt,yt,C,M,O,q,ie,ce,fe,Z,K,ve,Ee,de,ae,Ce,Le,Je,B,he,J,ue,ye;try{let T={alpha:!0,depth:i,stencil:r,antialias:o,premultipliedAlpha:a,preserveDrawingBuffer:l,powerPreference:c,failIfMajorPerformanceCaveat:h};if("setAttribute"in t)t.setAttribute("data-engine",`three.js r${Ko}`);if(t.addEventListener("webglcontextlost",ke,!1),t.addEventListener("webglcontextrestored",ut,!1),t.addEventListener("webglcontextcreationerror",nt,!1),U===null){if(U=nn("webgl2",T),U===null)if(nn("webgl2"))throw Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.");else throw Error("THREE.WebGLRenderer: Error creating WebGL context.")}ne()}catch(T){throw t.removeEventListener("webglcontextlost",ke,!1),t.removeEventListener("webglcontextrestored",ut,!1),t.removeEventListener("webglcontextcreationerror",nt,!1),De("WebGLRenderer: "+T.message),T}function ne(){if(tt=new hS(U),tt.init(),J=new ZM(U,tt),yt=new eS(U,tt,e,J),C=new YM(U,tt),yt.reversedDepthBuffer&&f)C.buffers.depth.setReversed(!0);D=U.createFramebuffer(),W=U.createFramebuffer(),R=U.createFramebuffer(),M=new dS(U),O=new NM,q=new $M(U,tt,C,O,yt,J,M),ie=new cS(A),ce=new my(U),ue=new Kb(U,ce),fe=new uS(U,ce,M,ue),Z=new mS(U,fe,ce,ue,M),Je=new pS(U,yt,q),ae=new tS(O),K=new DM(A,ie,tt,yt,ue,ae),ve=new ew(A,O),Ee=new UM,de=new HM(tt),Le=new Jb(A,ie,C,Z,p,a),Ce=new jM(A,Z,yt),ye=new tw(U,M,yt,C),B=new Qb(U,tt,M),he=new fS(U,tt,M),M.programs=K.programs,A.capabilities=yt,A.extensions=tt,A.properties=O,A.renderLists=Ee,A.shadowMap=Ce,A.state=C,A.info=M}if(g!==Pn)v=new _S(g,t.width,t.height,o,i,r);let me=new og(A,U);this.xr=me,this.getContext=function(){return U},this.getContextAttributes=function(){return U.getContextAttributes()},this.forceContextLoss=function(){let T=tt.get("WEBGL_lose_context");if(T)T.loseContext()},this.forceContextRestore=function(){let T=tt.get("WEBGL_lose_context");if(T)T.restoreContext()},this.getPixelRatio=function(){return se},this.setPixelRatio=function(T){if(T===void 0)return;se=T,this.setSize(Re,X,!1)},this.getSize=function(T){return T.set(Re,X)},this.setSize=function(T,F,j=!0){if(me.isPresenting){Ie("WebGLRenderer: Can't change size while VR device is presenting.");return}if(Re=T,X=F,t.width=Math.floor(T*se),t.height=Math.floor(F*se),j===!0)t.style.width=T+"px",t.style.height=F+"px";if(v!==null)v.setSize(t.width,t.height);this.setViewport(0,0,T,F)},this.getDrawingBufferSize=function(T){return T.set(Re*se,X*se).floor()},this.setDrawingBufferSize=function(T,F,j){Re=T,X=F,se=j,t.width=Math.floor(T*j),t.height=Math.floor(F*j),this.setViewport(0,0,T,F)},this.setEffects=function(T){if(g===Pn){De("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(T){for(let F=0;F<T.length;F++)if(T[F].isOutputPass===!0){Ie("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}v.setEffects(T||[])},this.getCurrentViewport=function(T){return T.copy(Q)},this.getViewport=function(T){return T.copy(Oe)},this.setViewport=function(T,F,j,H){if(T.isVector4)Oe.set(T.x,T.y,T.z,T.w);else Oe.set(T,F,j,H);C.viewport(Q.copy(Oe).multiplyScalar(se).round())},this.getScissor=function(T){return T.copy(Ae)},this.setScissor=function(T,F,j,H){if(T.isVector4)Ae.set(T.x,T.y,T.z,T.w);else Ae.set(T,F,j,H);C.scissor(G.copy(Ae).multiplyScalar(se).round())},this.getScissorTest=function(){return Et},this.setScissorTest=function(T){C.setScissorTest(Et=T)},this.setOpaqueSort=function(T){le=T},this.setTransparentSort=function(T){Pe=T},this.getClearColor=function(T){return T.copy(Le.getClearColor())},this.setClearColor=function(){Le.setClearColor(...arguments)},this.getClearAlpha=function(){return Le.getClearAlpha()},this.setClearAlpha=function(){Le.setClearAlpha(...arguments)},this.clear=function(T=!0,F=!0,j=!0){let H=0;if(T){let V=!1;if(z!==null){let _e=z.texture.format;V=y.has(_e)}if(V){let _e=z.texture.type,be=m.has(_e),ge=Le.getClearColor(),Se=Le.getClearAlpha(),{r:we,g:Ge,b:Xe}=ge;if(be)d[0]=we,d[1]=Ge,d[2]=Xe,d[3]=Se,U.clearBufferuiv(U.COLOR,0,d);else b[0]=we,b[1]=Ge,b[2]=Xe,b[3]=Se,U.clearBufferiv(U.COLOR,0,b)}else H|=U.COLOR_BUFFER_BIT}if(F)H|=U.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0);if(j)H|=U.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295);if(H!==0)U.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(T){T.setRenderer(this),P=T},this.dispose=function(){t.removeEventListener("webglcontextlost",ke,!1),t.removeEventListener("webglcontextrestored",ut,!1),t.removeEventListener("webglcontextcreationerror",nt,!1),Le.dispose(),Ee.dispose(),de.dispose(),O.dispose(),ie.dispose(),Z.dispose(),ue.dispose(),ye.dispose(),K.dispose(),me.dispose(),me.removeEventListener("sessionstart",Ld),me.removeEventListener("sessionend",Dd),Di.stop()};function ke(T){T.preventDefault(),ms("WebGLRenderer: Context Lost."),N=!0}function ut(){ms("WebGLRenderer: Context Restored."),N=!1;let T=M.autoReset,F=Ce.enabled,j=Ce.autoUpdate,H=Ce.needsUpdate,V=Ce.type;ne(),M.autoReset=T,Ce.enabled=F,Ce.autoUpdate=j,Ce.needsUpdate=H,Ce.type=V}function nt(T){De("WebGLRenderer: A WebGL context could not be created. Reason: ",T.statusMessage)}function On(T){let F=T.target;F.removeEventListener("dispose",On),jn(F)}function jn(T){J0(T),O.remove(T)}function J0(T){let F=O.get(T).programs;if(F!==void 0){if(F.forEach(function(j){K.releaseProgram(j)}),T.isShaderMaterial)K.releaseShaderCache(T)}}this.renderBufferDirect=function(T,F,j,H,V,_e){if(F===null)F=tn;let be=V.isMesh&&V.matrixWorld.determinantAffine()<0,ge=ev(T,F,j,H,V);C.setMaterial(H,be);let Se=j.index,we=1;if(H.wireframe===!0){if(Se=fe.getWireframeAttribute(j),Se===void 0)return;we=2}let Ge=j.drawRange,Xe=j.attributes.position,Me=Ge.start*we,it=(Ge.start+Ge.count)*we;if(_e!==null)Me=Math.max(Me,_e.start*we),it=Math.min(it,(_e.start+_e.count)*we);if(Se!==null)Me=Math.max(Me,0),it=Math.min(it,Se.count);else if(Xe!==void 0&&Xe!==null)Me=Math.max(Me,0),it=Math.min(it,Xe.count);let Mt=it-Me;if(Mt<0||Mt===1/0)return;ue.setup(V,H,ge,j,Se);let pt,ht=B;if(Se!==null)pt=ce.get(Se),ht=he,ht.setIndex(pt);if(V.isMesh)if(H.wireframe===!0)C.setLineWidth(H.wireframeLinewidth*Ct()),ht.setMode(U.LINES);else ht.setMode(U.TRIANGLES);else if(V.isLine){let Ht=H.linewidth;if(Ht===void 0)Ht=1;if(C.setLineWidth(Ht*Ct()),V.isLineSegments)ht.setMode(U.LINES);else if(V.isLineLoop)ht.setMode(U.LINE_LOOP);else ht.setMode(U.LINE_STRIP)}else if(V.isPoints)ht.setMode(U.POINTS);else if(V.isSprite)ht.setMode(U.TRIANGLES);if(V.isBatchedMesh)if(!tt.get("WEBGL_multi_draw")){let{_multiDrawStarts:Ht,_multiDrawCounts:xe,_multiDrawCount:Zt}=V,Ze=Se?ce.get(Se).bytesPerElement:1,vn=O.get(H).currentProgram.getUniforms();for(let Un=0;Un<Zt;Un++)vn.setValue(U,"_gl_DrawID",Un),ht.render(Ht[Un]/Ze,xe[Un])}else ht.renderMultiDraw(V._multiDrawStarts,V._multiDrawCounts,V._multiDrawCount);else if(V.isInstancedMesh)ht.renderInstances(Me,Mt,V.count);else if(j.isInstancedBufferGeometry){let Ht=j._maxInstanceCount!==void 0?j._maxInstanceCount:1/0,xe=Math.min(j.instanceCount,Ht);ht.renderInstances(Me,Mt,xe)}else ht.render(Me,Mt)};function Id(T,F,j,H){if(P!==null&&T.isNodeMaterial)P.setObject(H,T);if(je===!0)ae.setState(T,j,!1);if(T.transparent===!0&&T.side===Bn&&T.forceSinglePass===!1)T.side=Xt,T.needsUpdate=!0,wo(T,F,H),T.side=Ir,T.needsUpdate=!0,wo(T,F,H),T.side=Bn;else wo(T,F,H)}this.compile=function(T,F,j=null){if(j===null)j=T;if(P!==null)P.renderStart(T,F,j);if(x=de.get(j),x.init(F),E.push(x),j.traverseVisible(function(V){if(V.isLight&&V.layers.test(F.layers)){if(x.pushLight(V),V.castShadow)x.pushShadow(V)}}),T!==j)T.traverseVisible(function(V){if(V.isLight&&V.layers.test(F.layers)){if(x.pushLight(V),V.castShadow)x.pushShadow(V)}});if(x.setupLights(),P!==null)P.updateLights(x.state.lightsArray);if(rt=this.localClippingEnabled,je=ae.init(this.clippingPlanes,rt),je===!0)ae.setGlobalState(this.clippingPlanes,F);if(P!==null)Ce.render(x.state.shadowsArray,j,F);let H=new Set;if(T.traverse(function(V){if(!(V.isMesh||V.isPoints||V.isLine||V.isSprite))return;let _e=V.material;if(_e)if(Array.isArray(_e))for(let be=0;be<_e.length;be++){let ge=_e[be];Id(ge,j,F,V),H.add(ge)}else Id(_e,j,F,V),H.add(_e)}),x=E.pop(),P!==null)P.renderEnd();return H},this.compileAsync=function(T,F,j=null){let H=this.compile(T,F,j);return new Promise((V)=>{function _e(){if(H.forEach(function(be){let Se=O.get(be).currentProgram;if(Se===void 0||Se.isReady())H.delete(be)}),H.size===0){V(T);return}setTimeout(_e,10)}if(tt.get("KHR_parallel_shader_compile")!==null)_e();else setTimeout(_e,10)})};let Pl=null;function K0(T){if(Pl)Pl(T)}function Ld(){Di.stop()}function Dd(){Di.start()}let Di=new Ym;if(Di.setAnimationLoop(K0),typeof self<"u")Di.setContext(self);this.setAnimationLoop=function(T){Pl=T,me.setAnimationLoop(T),T===null?Di.stop():Di.start()},me.addEventListener("sessionstart",Ld),me.addEventListener("sessionend",Dd),this.render=function(T,F){if(F!==void 0&&F.isCamera!==!0){De("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(N===!0)return;if(P!==null)P.renderStart(T,F);let j=me.enabled===!0&&me.isPresenting===!0,H=v!==null&&(z===null||j)&&v.begin(A,z);if(T.matrixWorldAutoUpdate===!0)T.updateMatrixWorld();if(F.parent===null&&F.matrixWorldAutoUpdate===!0)F.updateMatrixWorld();if(me.enabled===!0&&me.isPresenting===!0&&(v===null||v.isCompositing()===!1)){if(me.cameraAutoUpdate===!0)me.updateCamera(F);F=me.getCamera()}if(T.isScene===!0)T.onBeforeRender(A,T,F,z);if(x=de.get(T,E.length),x.init(F),x.state.textureUnits=q.getTextureUnits(),E.push(x),Ye.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),qe.setFromProjectionMatrix(Ye,$c,F.reversedDepth),rt=this.localClippingEnabled,je=ae.init(this.clippingPlanes,rt),_=Ee.get(T,w.length),_.init(),w.push(_),me.enabled===!0&&me.isPresenting===!0){let be=A.xr.getDepthSensingMesh();if(be!==null)Il(be,F,-1/0,A.sortObjects)}if(Il(T,F,0,A.sortObjects),_.finish(),P!==null)P.updateLights(x.state.lightsArray);if(A.sortObjects===!0)_.sort(le,Pe);if(At=me.enabled===!1||me.isPresenting===!1||me.hasDepthSensing()===!1,At)Le.addToRenderList(_,T);if(this.info.render.frame++,this.info.autoReset===!0)this.info.reset();if(je===!0)ae.beginShadows();let V=x.state.shadowsArray;if(Ce.render(V,T,F),je===!0)ae.endShadows();if((H&&v.hasRenderPass())===!1){let be=_.opaque,ge=_.transmissive;if(x.setupLights(),F.isArrayCamera){let Se=F.cameras;if(ge.length>0)for(let we=0,Ge=Se.length;we<Ge;we++){let Xe=Se[we];Od(be,ge,T,Xe)}if(At)Le.render(T);for(let we=0,Ge=Se.length;we<Ge;we++){let Xe=Se[we];Nd(_,T,Xe,Xe.viewport)}}else{if(ge.length>0)Od(be,ge,T,F);if(At)Le.render(T);Nd(_,T,F)}}if(z!==null&&k===0)q.updateMultisampleRenderTarget(z),q.updateRenderTargetMipmap(z);if(H)v.end(A);if(T.isScene===!0)T.onAfterRender(A,T,F);if(ue.resetDefaultState(),te=-1,Y=null,E.pop(),E.length>0){if(x=E[E.length-1],q.setTextureUnits(x.state.textureUnits),je===!0)ae.setGlobalState(A.clippingPlanes,x.state.camera)}else x=null;if(w.pop(),w.length>0)_=w[w.length-1];else _=null;if(P!==null)P.renderEnd()};function Il(T,F,j,H){if(T.visible===!1)return;if(T.layers.test(F.layers)){if(T.isGroup)j=T.renderOrder;else if(T.isLOD){if(T.autoUpdate===!0)T.update(F)}else if(T.isLightProbeGrid)x.pushLightProbeGrid(T);else if(T.isLight){if(x.pushLight(T),T.castShadow)x.pushShadow(T)}else if(T.isSprite){if(!T.frustumCulled||T.intersectsFrustum(qe)){if(H)dt.setFromMatrixPosition(T.matrixWorld).applyMatrix4(Ye);let be=Z.update(T),ge=T.material;if(ge.visible)_.push(T,be,ge,j,dt.z,null,F)}}else if(T.isMesh||T.isLine||T.isPoints){if(!T.frustumCulled||T.intersectsFrustum(qe)){let be=Z.update(T),ge=T.material;if(H){if(T.boundingSphere!==void 0){if(T.boundingSphere===null)T.computeBoundingSphere();dt.copy(T.boundingSphere.center)}else{if(be.boundingSphere===null)be.computeBoundingSphere();dt.copy(be.boundingSphere.center)}dt.applyMatrix4(T.matrixWorld).applyMatrix4(Ye)}if(Array.isArray(ge)){let Se=be.groups;for(let we=0,Ge=Se.length;we<Ge;we++){let Xe=Se[we],Me=ge[Xe.materialIndex];if(Me&&Me.visible)_.push(T,be,Me,j,dt.z,Xe,F)}}else if(ge.visible)_.push(T,be,ge,j,dt.z,null,F)}}}let _e=T.children;for(let be=0,ge=_e.length;be<ge;be++)Il(_e[be],F,j,H)}function Nd(T,F,j,H){let{opaque:V,transmissive:_e,transparent:be}=T;if(x.setupLightsView(j),je===!0)ae.setGlobalState(A.clippingPlanes,j);if(H)C.viewport(Q.copy(H));if(V.length>0)Mo(V,F,j);if(_e.length>0)Mo(_e,F,j);if(be.length>0)Mo(be,F,j);C.buffers.depth.setTest(!0),C.buffers.depth.setMask(!0),C.buffers.color.setMask(!0),C.setPolygonOffset(!1)}function Od(T,F,j,H){if((j.isScene===!0?j.overrideMaterial:null)!==null)return;if(x.state.transmissionRenderTarget[H.id]===void 0){let Me=tt.has("EXT_color_buffer_half_float")||tt.has("EXT_color_buffer_float");x.state.transmissionRenderTarget[H.id]=new Pt(1,1,{generateMipmaps:!0,type:Me?qt:Pn,minFilter:zi,samples:Math.max(4,yt.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:We.workingColorSpace})}let _e=x.state.transmissionRenderTarget[H.id],be=H.viewport||Q;_e.setSize(be.z*A.transmissionResolutionScale,be.w*A.transmissionResolutionScale);let ge=A.getRenderTarget(),Se=A.getActiveCubeFace(),we=A.getActiveMipmapLevel();if(A.setRenderTarget(_e),A.getClearColor(oe),Ue=A.getClearAlpha(),Ue<1)A.setClearColor(16777215,0.5);if(A.clear(),At)Le.render(j);let Ge=A.toneMapping;A.toneMapping=Rn;let Xe=H.viewport;if(H.viewport!==void 0)H.viewport=void 0;if(x.setupLightsView(H),je===!0)ae.setGlobalState(A.clippingPlanes,H);if(Mo(T,j,H),q.updateMultisampleRenderTarget(_e),q.updateRenderTargetMipmap(_e),tt.has("WEBGL_multisampled_render_to_texture")===!1){let Me=!1;for(let it=0,Mt=F.length;it<Mt;it++){let pt=F[it],{object:ht,geometry:Ht,material:xe,group:Zt}=pt;if(xe.side===Bn&&ht.layers.test(H.layers)){let Ze=xe.side;xe.side=Xt,xe.needsUpdate=!0,Ud(ht,j,H,Ht,xe,Zt),xe.side=Ze,xe.needsUpdate=!0,Me=!0}}if(Me===!0)q.updateMultisampleRenderTarget(_e),q.updateRenderTargetMipmap(_e)}if(A.setRenderTarget(ge,Se,we),A.setClearColor(oe,Ue),Xe!==void 0)H.viewport=Xe;A.toneMapping=Ge}function Mo(T,F,j){let H=F.isScene===!0?F.overrideMaterial:null;for(let V=0,_e=T.length;V<_e;V++){let be=T[V],{object:ge,geometry:Se,group:we}=be,Ge=be.material;if(Ge.allowOverride===!0&&H!==null)Ge=H;if(ge.layers.test(j.layers))Ud(ge,F,j,Se,Ge,we)}}function Ud(T,F,j,H,V,_e){if(P!==null&&V.isNodeMaterial)P.setObject(T,V);if(T.onBeforeRender(A,F,j,H,V,_e),T.modelViewMatrix.multiplyMatrices(j.matrixWorldInverse,T.matrixWorld),T.normalMatrix.getNormalMatrix(T.modelViewMatrix),V.onBeforeRender(A,F,j,H,T,_e),V.transparent===!0&&V.side===Bn&&V.forceSinglePass===!1)V.side=Xt,V.needsUpdate=!0,A.renderBufferDirect(j,F,H,V,T,_e),V.side=Ir,V.needsUpdate=!0,A.renderBufferDirect(j,F,H,V,T,_e),V.side=Bn;else A.renderBufferDirect(j,F,H,V,T,_e);T.onAfterRender(A,F,j,H,V,_e)}function wo(T,F,j){if(F.isScene!==!0)F=tn;let H=O.get(T),V=x.state.lights,_e=x.state.shadowsArray,be=V.state.version,ge=K.getParameters(T,V.state,_e,F,j,x.state.lightProbeGridArray),Se=K.getProgramCacheKey(ge),we=H.programs;H.environment=T.isMeshStandardMaterial||T.isMeshLambertMaterial||T.isMeshPhongMaterial?F.environment:null,H.fog=F.fog;let Ge=T.isMeshStandardMaterial||T.isMeshLambertMaterial&&!T.envMap||T.isMeshPhongMaterial&&!T.envMap;if(H.envMap=ie.get(T.envMap||H.environment,Ge),H.envMapRotation=H.environment!==null&&T.envMap===null?F.environmentRotation:T.envMapRotation,we===void 0)T.addEventListener("dispose",On),we=new Map,H.programs=we;let Xe=we.get(Se);if(Xe!==void 0){if(H.currentProgram===Xe&&H.lightsStateVersion===be)return Bd(T,ge),Xe}else{if(ge.uniforms=K.getUniforms(T),P!==null&&T.isNodeMaterial)P.build(T,j,ge);T.onBeforeCompile(ge,A),Xe=K.acquireProgram(ge,Se),we.set(Se,Xe),H.uniforms=ge.uniforms}let Me=H.uniforms;if(!T.isShaderMaterial&&!T.isRawShaderMaterial||T.clipping===!0)Me.clippingPlanes=ae.uniform;if(Bd(T,ge),H.needsLights=nv(T),H.lightsStateVersion=be,H.needsLights)Me.ambientLightColor.value=V.state.ambient,Me.lightProbe.value=V.state.probe,Me.sunLights.value=V.state.sun,Me.sunLightShadows.value=V.state.sunShadow,Me.directionalLights.value=V.state.directional,Me.directionalLightShadows.value=V.state.directionalShadow,Me.spotLights.value=V.state.spot,Me.spotLightShadows.value=V.state.spotShadow,Me.rectAreaLights.value=V.state.rectArea,Me.ltc_1.value=V.state.rectAreaLTC1,Me.ltc_2.value=V.state.rectAreaLTC2,Me.pointLights.value=V.state.point,Me.pointLightShadows.value=V.state.pointShadow,Me.hemisphereLights.value=V.state.hemi,Me.sunShadowMatrix.value=V.state.sunShadowMatrix,Me.sunShadowCascade.value=V.state.sunShadowCascade,Me.directionalShadowMatrix.value=V.state.directionalShadowMatrix,Me.spotLightMatrix.value=V.state.spotLightMatrix,Me.spotLightMap.value=V.state.spotLightMap,Me.pointShadowMatrix.value=V.state.pointShadowMatrix;return H.lightProbeGrid=x.state.lightProbeGridArray.length>0,H.currentProgram=Xe,H.uniformsList=null,Xe}function Fd(T){if(T.uniformsList===null){let F=T.currentProgram.getUniforms();T.uniformsList=qs.seqWithValue(F.seq,T.uniforms)}return T.uniformsList}function Bd(T,F){let j=O.get(T);j.outputColorSpace=F.outputColorSpace,j.batching=F.batching,j.batchingColor=F.batchingColor,j.instancing=F.instancing,j.instancingColor=F.instancingColor,j.instancingMorph=F.instancingMorph,j.skinning=F.skinning,j.morphTargets=F.morphTargets,j.morphNormals=F.morphNormals,j.morphColors=F.morphColors,j.morphTargetsCount=F.morphTargetsCount,j.numClippingPlanes=F.numClippingPlanes,j.numIntersection=F.numClipIntersection,j.vertexAlphas=F.vertexAlphas,j.vertexTangents=F.vertexTangents,j.toneMapping=F.toneMapping}function Q0(T,F){if(T.length===0)return null;if(T.length===1)return T[0].texture!==null?T[0]:null;S.setFromMatrixPosition(F.matrixWorld);for(let j=0,H=T.length;j<H;j++){let V=T[j];if(V.texture!==null&&V.boundingBox.containsPoint(S))return V}return null}function ev(T,F,j,H,V){if(F.isScene!==!0)F=tn;q.resetTextureUnits();let _e=F.fog,be=H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial?F.environment:null,ge=z===null?A.outputColorSpace:z.isXRRenderTarget===!0?z.texture.colorSpace:We.workingColorSpace,Se=H.isMeshStandardMaterial||H.isMeshLambertMaterial&&!H.envMap||H.isMeshPhongMaterial&&!H.envMap,we=ie.get(H.envMap||be,Se),Ge=H.vertexColors===!0&&!!j.attributes.color&&j.attributes.color.itemSize===4,Xe=!!j.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Me=!!j.morphAttributes.position,it=!!j.morphAttributes.normal,Mt=!!j.morphAttributes.color,pt=Rn;if(H.toneMapped){if(z===null||z.isXRRenderTarget===!0)pt=A.toneMapping}let ht=j.morphAttributes.position||j.morphAttributes.normal||j.morphAttributes.color,Ht=ht!==void 0?ht.length:0,xe=O.get(H),Zt=x.state.lights;if(je===!0){if(rt===!0||T!==Y){let ft=T===Y&&H.id===te;ae.setState(H,T,ft)}}let Ze=!1;if(H.version===xe.__version){if(xe.needsLights&&xe.lightsStateVersion!==Zt.state.version)Ze=!0;else if(xe.outputColorSpace!==ge)Ze=!0;else if(V.isBatchedMesh&&xe.batching===!1)Ze=!0;else if(!V.isBatchedMesh&&xe.batching===!0)Ze=!0;else if(V.isBatchedMesh&&xe.batchingColor===!0&&V._colorsTexture===null)Ze=!0;else if(V.isBatchedMesh&&xe.batchingColor===!1&&V._colorsTexture!==null)Ze=!0;else if(V.isInstancedMesh&&xe.instancing===!1)Ze=!0;else if(!V.isInstancedMesh&&xe.instancing===!0)Ze=!0;else if(V.isSkinnedMesh&&xe.skinning===!1)Ze=!0;else if(!V.isSkinnedMesh&&xe.skinning===!0)Ze=!0;else if(V.isInstancedMesh&&xe.instancingColor===!0&&V.instanceColor===null)Ze=!0;else if(V.isInstancedMesh&&xe.instancingColor===!1&&V.instanceColor!==null)Ze=!0;else if(V.isInstancedMesh&&xe.instancingMorph===!0&&V.morphTexture===null)Ze=!0;else if(V.isInstancedMesh&&xe.instancingMorph===!1&&V.morphTexture!==null)Ze=!0;else if(xe.envMap!==we)Ze=!0;else if(H.fog===!0&&xe.fog!==_e)Ze=!0;else if(xe.numClippingPlanes!==void 0&&(xe.numClippingPlanes!==ae.numPlanes||xe.numIntersection!==ae.numIntersection))Ze=!0;else if(xe.vertexAlphas!==Ge)Ze=!0;else if(xe.vertexTangents!==Xe)Ze=!0;else if(xe.morphTargets!==Me)Ze=!0;else if(xe.morphNormals!==it)Ze=!0;else if(xe.morphColors!==Mt)Ze=!0;else if(xe.toneMapping!==pt)Ze=!0;else if(xe.morphTargetsCount!==Ht)Ze=!0;else if(!!xe.lightProbeGrid!==x.state.lightProbeGridArray.length>0)Ze=!0}else Ze=!0,xe.__version=H.version;let vn=xe.currentProgram;if(Ze===!0){if(vn=wo(H,F,V),P&&H.isNodeMaterial)P.onUpdateProgram(H,vn,xe)}let Un=!1,hi=!1,or=!1,ct=vn.getUniforms(),bt=xe.uniforms;if(C.useProgram(vn.program))Un=!0,hi=!0,or=!0;if(H.id!==te)te=H.id,hi=!0;if(xe.needsLights){let ft=Q0(x.state.lightProbeGridArray,V);if(xe.lightProbeGrid!==ft)xe.lightProbeGrid=ft,hi=!0}if(Un||Y!==T){if(C.buffers.depth.getReversed()&&T.reversedDepth!==!0)T._reversedDepth=!0,T.updateProjectionMatrix();ct.setValue(U,"projectionMatrix",T.projectionMatrix),ct.setValue(U,"viewMatrix",T.matrixWorldInverse);let fi=ct.map.cameraPosition;if(fi!==void 0)fi.setValue(U,Bt.setFromMatrixPosition(T.matrixWorld));if(yt.logarithmicDepthBuffer)ct.setValue(U,"logDepthBufFC",2/(Math.log(T.far+1)/Math.LN2));if(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)ct.setValue(U,"isOrthographic",T.isOrthographicCamera===!0);if(Y!==T)Y=T,hi=!0,or=!0}if(xe.needsLights){if(Zt.state.sunShadowMap.length>0)ct.setValue(U,"sunShadowMap",Zt.state.sunShadowMap,q);if(Zt.state.directionalShadowMap.length>0)ct.setValue(U,"directionalShadowMap",Zt.state.directionalShadowMap,q);if(Zt.state.spotShadowMap.length>0)ct.setValue(U,"spotShadowMap",Zt.state.spotShadowMap,q);if(Zt.state.pointShadowMap.length>0)ct.setValue(U,"pointShadowMap",Zt.state.pointShadowMap,q)}if(V.isSkinnedMesh){ct.setOptional(U,V,"bindMatrix"),ct.setOptional(U,V,"bindMatrixInverse");let ft=V.skeleton;if(ft){if(ft.boneTexture===null)ft.computeBoneTexture();ct.setValue(U,"boneTexture",ft.boneTexture,q)}}if(V.isBatchedMesh){if(ct.setOptional(U,V,"batchingTexture"),ct.setValue(U,"batchingTexture",V._matricesTexture,q),ct.setOptional(U,V,"batchingIdTexture"),ct.setValue(U,"batchingIdTexture",V._indirectTexture,q),ct.setOptional(U,V,"batchingColorTexture"),V._colorsTexture!==null)ct.setValue(U,"batchingColorTexture",V._colorsTexture,q)}let ui=j.morphAttributes;if(ui.position!==void 0||ui.normal!==void 0||ui.color!==void 0)Je.update(V,j,vn);if(hi||xe.receiveShadow!==V.receiveShadow)xe.receiveShadow=V.receiveShadow,ct.setValue(U,"receiveShadow",V.receiveShadow);if((H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial)&&H.envMap===null&&F.environment!==null)bt.envMapIntensity.value=F.environmentIntensity;if(bt.dfgLUT!==void 0)bt.dfgLUT.value=iw();if(hi){if(ct.setValue(U,"toneMappingExposure",A.toneMappingExposure),xe.needsLights)tv(bt,or);if(_e&&H.fog===!0)ve.refreshFogUniforms(bt,_e);if(ve.refreshMaterialUniforms(bt,H,se,X,x.state.transmissionRenderTarget[T.id]),xe.needsLights&&xe.lightProbeGrid){let ft=xe.lightProbeGrid;bt.probesSH.value=ft.texture,bt.probesMin.value.copy(ft.boundingBox.min),bt.probesMax.value.copy(ft.boundingBox.max),bt.probesResolution.value.copy(ft.resolution)}qs.upload(U,Fd(xe),bt,q)}if(H.isShaderMaterial&&H.uniformsNeedUpdate===!0)qs.upload(U,Fd(xe),bt,q),H.uniformsNeedUpdate=!1;if(H.isSpriteMaterial)ct.setValue(U,"center",V.center);if(ct.setValue(U,"modelViewMatrix",V.modelViewMatrix),ct.setValue(U,"normalMatrix",V.normalMatrix),ct.setValue(U,"modelMatrix",V.matrixWorld),H.uniformsGroups!==void 0){let ft=H.uniformsGroups;for(let fi=0,ar=ft.length;fi<ar;fi++){let zd=ft[fi];ye.update(zd,vn),ye.bind(zd,vn)}}return vn}function tv(T,F){T.ambientLightColor.needsUpdate=F,T.lightProbe.needsUpdate=F,T.sunLights.needsUpdate=F,T.sunLightShadows.needsUpdate=F,T.directionalLights.needsUpdate=F,T.directionalLightShadows.needsUpdate=F,T.pointLights.needsUpdate=F,T.pointLightShadows.needsUpdate=F,T.spotLights.needsUpdate=F,T.spotLightShadows.needsUpdate=F,T.rectAreaLights.needsUpdate=F,T.hemisphereLights.needsUpdate=F}function nv(T){return T.isMeshLambertMaterial||T.isMeshToonMaterial||T.isMeshPhongMaterial||T.isMeshStandardMaterial||T.isShadowMaterial||T.isShaderMaterial&&T.lights===!0}this.getActiveCubeFace=function(){return I},this.getActiveMipmapLevel=function(){return k},this.getRenderTarget=function(){return z},this.setRenderTargetTextures=function(T,F,j){let H=O.get(T);if(H.__autoAllocateDepthBuffer=T.resolveDepthBuffer===!1,H.__autoAllocateDepthBuffer===!1)H.__useRenderToTexture=!1;O.get(T.texture).__webglTexture=F,O.get(T.depthTexture).__webglTexture=H.__autoAllocateDepthBuffer?void 0:j,H.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(T,F){let j=O.get(T);j.__webglFramebuffer=F,j.__useDefaultFramebuffer=F===void 0},this.setRenderTarget=function(T,F=0,j=0){z=T,I=F,k=j;let H=null,V=!1,_e=!1;if(T){let ge=O.get(T);if(ge.__useDefaultFramebuffer!==void 0){C.bindFramebuffer(U.FRAMEBUFFER,ge.__webglFramebuffer),Q.copy(T.viewport),G.copy(T.scissor),ee=T.scissorTest,C.viewport(Q),C.scissor(G),C.setScissorTest(ee),te=-1;return}else if(ge.__webglFramebuffer===void 0)q.setupRenderTarget(T);else if(ge.__hasExternalTextures)q.rebindTextures(T,O.get(T.texture).__webglTexture,O.get(T.depthTexture).__webglTexture);else if(T.depthBuffer){let Ge=T.depthTexture;if(ge.__boundDepthTexture!==Ge){if(Ge!==null&&O.has(Ge)&&(T.width!==Ge.image.width||T.height!==Ge.image.height))throw Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");q.setupDepthRenderbuffer(T)}}let Se=T.texture;if(Se.isData3DTexture||Se.isDataArrayTexture||Se.isCompressedArrayTexture)_e=!0;let we=O.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget){if(Array.isArray(we[F]))H=we[F][j];else H=we[F];V=!0}else if(T.samples>0&&q.useMultisampledRTT(T)===!1)H=O.get(T).__webglMultisampledFramebuffer;else if(Array.isArray(we))H=we[j];else H=we;Q.copy(T.viewport),G.copy(T.scissor),ee=T.scissorTest}else Q.copy(Oe).multiplyScalar(se).floor(),G.copy(Ae).multiplyScalar(se).floor(),ee=Et;if(j!==0)H=D;if(C.bindFramebuffer(U.FRAMEBUFFER,H))C.drawBuffers(T,H);if(C.viewport(Q),C.scissor(G),C.setScissorTest(ee),V){let ge=O.get(T.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_CUBE_MAP_POSITIVE_X+F,ge.__webglTexture,j)}else if(_e){let ge=F;for(let Se=0;Se<T.textures.length;Se++){let we=O.get(T.textures[Se]);U.framebufferTextureLayer(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0+Se,we.__webglTexture,j,ge)}}else if(T!==null&&j!==0){let ge=O.get(T.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,ge.__webglTexture,j)}te=-1};function kd(T){let F=O.get(T);if(F.__readFormat!==T.format||F.__readType!==T.type)F.__readFormat=T.format,F.__readType=T.type,F.__formatReadable=yt.textureFormatReadable(T.format),F.__typeReadable=yt.textureTypeReadable(T.type);return F}if(this.readRenderTargetPixels=function(T,F,j,H,V,_e,be,ge=0){if(!(T&&T.isWebGLRenderTarget)){De("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Se=O.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&be!==void 0)Se=Se[be];if(Se){C.bindFramebuffer(U.FRAMEBUFFER,Se);try{let we=T.textures[ge],{format:Ge,type:Xe}=we;if(T.textures.length>1)U.readBuffer(U.COLOR_ATTACHMENT0+ge);let Me=kd(we);if(Me.__formatReadable===!1){De("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Me.__typeReadable===!1){De("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}if(F>=0&&F<=T.width-H&&(j>=0&&j<=T.height-V))U.readPixels(F,j,H,V,J.convert(Ge),J.convert(Xe),_e)}finally{let we=z!==null?O.get(z).__webglFramebuffer:null;C.bindFramebuffer(U.FRAMEBUFFER,we)}}},this.readRenderTargetPixelsAsync=async function(T,F,j,H,V,_e,be,ge=0){if(!(T&&T.isWebGLRenderTarget))throw Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Se=O.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&be!==void 0)Se=Se[be];if(Se)if(F>=0&&F<=T.width-H&&(j>=0&&j<=T.height-V)){C.bindFramebuffer(U.FRAMEBUFFER,Se);let we=T.textures[ge],{format:Ge,type:Xe}=we;if(T.textures.length>1)U.readBuffer(U.COLOR_ATTACHMENT0+ge);let Me=kd(we);if(Me.__formatReadable===!1)throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Me.__typeReadable===!1)throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let it=U.createBuffer();U.bindBuffer(U.PIXEL_PACK_BUFFER,it),U.bufferData(U.PIXEL_PACK_BUFFER,_e.byteLength,U.STREAM_READ),U.readPixels(F,j,H,V,J.convert(Ge),J.convert(Xe),0),U.bindBuffer(U.PIXEL_PACK_BUFFER,null);let Mt=z!==null?O.get(z).__webglFramebuffer:null;C.bindFramebuffer(U.FRAMEBUFFER,Mt);let pt=U.fenceSync(U.SYNC_GPU_COMMANDS_COMPLETE,0);return U.flush(),await ym(U,pt,4),U.bindBuffer(U.PIXEL_PACK_BUFFER,it),U.getBufferSubData(U.PIXEL_PACK_BUFFER,0,_e),U.bindBuffer(U.PIXEL_PACK_BUFFER,null),U.deleteBuffer(it),U.deleteSync(pt),_e}else throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(T,F=null,j=0){let H=Math.pow(2,-j),V=Math.floor(T.image.width*H),_e=Math.floor(T.image.height*H),be=F!==null?F.x:0,ge=F!==null?F.y:0;q.setTexture2D(T,0),U.copyTexSubImage2D(U.TEXTURE_2D,j,0,0,be,ge,V,_e),C.unbindTexture()},this.copyTextureToTexture=function(T,F,j=null,H=null,V=0,_e=0){let be,ge,Se,we,Ge,Xe,Me,it,Mt,pt=T.isCompressedTexture?T.mipmaps[_e]:T.image;if(j!==null)be=j.max.x-j.min.x,ge=j.max.y-j.min.y,Se=j.isBox3?j.max.z-j.min.z:1,we=j.min.x,Ge=j.min.y,Xe=j.isBox3?j.min.z:0;else{let bt=Math.pow(2,-V);if(be=Math.floor(pt.width*bt),ge=Math.floor(pt.height*bt),T.isDataArrayTexture)Se=pt.depth;else if(T.isData3DTexture)Se=Math.floor(pt.depth*bt);else Se=1;we=0,Ge=0,Xe=0}if(H!==null)Me=H.x,it=H.y,Mt=H.z;else Me=0,it=0,Mt=0;let ht=J.convert(F.format),Ht=J.convert(F.type),xe;if(F.isData3DTexture)q.setTexture3D(F,0),xe=U.TEXTURE_3D;else if(F.isDataArrayTexture||F.isCompressedArrayTexture)q.setTexture2DArray(F,0),xe=U.TEXTURE_2D_ARRAY;else q.setTexture2D(F,0),xe=U.TEXTURE_2D;C.activeTexture(U.TEXTURE0),C.pixelStorei(U.UNPACK_FLIP_Y_WEBGL,F.flipY),C.pixelStorei(U.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),C.pixelStorei(U.UNPACK_ALIGNMENT,F.unpackAlignment);let Zt=C.getParameter(U.UNPACK_ROW_LENGTH),Ze=C.getParameter(U.UNPACK_IMAGE_HEIGHT),vn=C.getParameter(U.UNPACK_SKIP_PIXELS),Un=C.getParameter(U.UNPACK_SKIP_ROWS),hi=C.getParameter(U.UNPACK_SKIP_IMAGES);C.pixelStorei(U.UNPACK_ROW_LENGTH,pt.width),C.pixelStorei(U.UNPACK_IMAGE_HEIGHT,pt.height),C.pixelStorei(U.UNPACK_SKIP_PIXELS,we),C.pixelStorei(U.UNPACK_SKIP_ROWS,Ge),C.pixelStorei(U.UNPACK_SKIP_IMAGES,Xe);let or=T.isDataArrayTexture||T.isData3DTexture,ct=F.isDataArrayTexture||F.isData3DTexture;if(T.isDepthTexture){let bt=O.get(T),ui=O.get(F),ft=O.get(bt.__renderTarget),fi=O.get(ui.__renderTarget);C.bindFramebuffer(U.READ_FRAMEBUFFER,ft.__webglFramebuffer),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,fi.__webglFramebuffer);for(let ar=0;ar<Se;ar++){if(or)U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,O.get(T).__webglTexture,V,Xe+ar),U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,O.get(F).__webglTexture,_e,Mt+ar);U.blitFramebuffer(we,Ge,be,ge,Me,it,be,ge,U.DEPTH_BUFFER_BIT,U.NEAREST)}C.bindFramebuffer(U.READ_FRAMEBUFFER,null),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else if(V!==0||T.isRenderTargetTexture||O.has(T)){let bt=O.get(T),ui=O.get(F);C.bindFramebuffer(U.READ_FRAMEBUFFER,W),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,R);for(let ft=0;ft<Se;ft++){if(or)U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,bt.__webglTexture,V,Xe+ft);else U.framebufferTexture2D(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,bt.__webglTexture,V);if(ct)U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,ui.__webglTexture,_e,Mt+ft);else U.framebufferTexture2D(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,ui.__webglTexture,_e);if(V!==0)U.blitFramebuffer(we,Ge,be,ge,Me,it,be,ge,U.COLOR_BUFFER_BIT,U.NEAREST);else if(ct)U.copyTexSubImage3D(xe,_e,Me,it,Mt+ft,we,Ge,be,ge);else U.copyTexSubImage2D(xe,_e,Me,it,we,Ge,be,ge)}C.bindFramebuffer(U.READ_FRAMEBUFFER,null),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else if(ct)if(T.isDataTexture||T.isData3DTexture)U.texSubImage3D(xe,_e,Me,it,Mt,be,ge,Se,ht,Ht,pt.data);else if(F.isCompressedArrayTexture)U.compressedTexSubImage3D(xe,_e,Me,it,Mt,be,ge,Se,ht,pt.data);else U.texSubImage3D(xe,_e,Me,it,Mt,be,ge,Se,ht,Ht,pt);else if(T.isDataTexture)U.texSubImage2D(U.TEXTURE_2D,_e,Me,it,be,ge,ht,Ht,pt.data);else if(T.isCompressedTexture)U.compressedTexSubImage2D(U.TEXTURE_2D,_e,Me,it,pt.width,pt.height,ht,pt.data);else U.texSubImage2D(U.TEXTURE_2D,_e,Me,it,be,ge,ht,Ht,pt);if(C.pixelStorei(U.UNPACK_ROW_LENGTH,Zt),C.pixelStorei(U.UNPACK_IMAGE_HEIGHT,Ze),C.pixelStorei(U.UNPACK_SKIP_PIXELS,vn),C.pixelStorei(U.UNPACK_SKIP_ROWS,Un),C.pixelStorei(U.UNPACK_SKIP_IMAGES,hi),_e===0&&F.generateMipmaps)U.generateMipmap(xe);C.unbindTexture()},this.initRenderTarget=function(T){if(O.get(T).__webglFramebuffer===void 0)q.setupRenderTarget(T)},this.initTexture=function(T){if(T.isCubeTexture)q.setTextureCube(T,0);else if(T.isData3DTexture)q.setTexture3D(T,0);else if(T.isDataArrayTexture||T.isCompressedArrayTexture)q.setTexture2DArray(T,0);else q.setTexture2D(T,0);C.unbindTexture()},this.resetState=function(){I=0,k=0,z=null,C.reset(),ue.reset()},typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return $c}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=We._getDrawingBufferColorSpace(e),t.unpackColorSpace=We._getUnpackColorSpace()}}var qr=new sn,oi=new re,lg=new L,Hh=new re,La=new re,Da=new L,Vh=new L,cg=new Ke,hg=new L,ug=new L,Yt=null,Wn=null,ai=[],bi={NONE:-1,PAN:0,ROTATE:1};class Wh extends Gn{constructor(e,t,n=null){super(t,n);if(this.objects=e,this.recursive=!0,this.transformGroup=!1,this.rotateSpeed=1,this.raycaster=new Hr,this.mouseButtons={LEFT:St.PAN,MIDDLE:St.PAN,RIGHT:St.ROTATE},this.touches={ONE:xn.PAN},this._onPointerMove=rw.bind(this),this._onPointerDown=sw.bind(this),this._onPointerCancel=ow.bind(this),this._onContextMenu=aw.bind(this),n!==null)this.connect(n)}connect(e){super.connect(e),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointerup",this._onPointerCancel),this.domElement.addEventListener("pointerleave",this._onPointerCancel),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointerup",this._onPointerCancel),this.domElement.removeEventListener("pointerleave",this._onPointerCancel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="",this.domElement.style.cursor=""}dispose(){this.disconnect()}_updatePointer(e){let t=this.domElement.getBoundingClientRect();oi.x=(e.clientX-t.left)/t.width*2-1,oi.y=-(e.clientY-t.top)/t.height*2+1}_updateState(e){let t;if(e.pointerType==="touch")t=this.touches.ONE;else switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=null}switch(t){case St.PAN:case xn.PAN:this.state=bi.PAN;break;case St.ROTATE:case xn.ROTATE:this.state=bi.ROTATE;break;default:this.state=bi.NONE}}}function rw(e){let t=this.object,n=this.domElement,i=this.raycaster;if(this.enabled===!1)return;if(this._updatePointer(e),i.setFromCamera(oi,t),Yt){if(this.state===bi.PAN){if(i.ray.intersectPlane(qr,Da))Yt.position.copy(Da.sub(lg).applyMatrix4(cg)),this.dispatchEvent({type:"drag",object:Yt})}else if(this.state===bi.ROTATE)Hh.subVectors(oi,La).multiplyScalar(this.rotateSpeed),Yt.rotateOnWorldAxis(hg,Hh.x),Yt.rotateOnWorldAxis(ug.normalize(),-Hh.y),this.dispatchEvent({type:"drag",object:Yt});La.copy(oi)}else if(e.pointerType==="mouse"||e.pointerType==="pen"){if(ai.length=0,i.setFromCamera(oi,t),i.intersectObjects(this.objects,this.recursive,ai),ai.length>0){let r=ai[0].object;if(qr.setFromNormalAndCoplanarPoint(t.getWorldDirection(qr.normal),Vh.setFromMatrixPosition(r.matrixWorld)),Wn!==r&&Wn!==null)this.dispatchEvent({type:"hoveroff",object:Wn}),n.style.cursor="auto",Wn=null;if(Wn!==r)this.dispatchEvent({type:"hoveron",object:r}),n.style.cursor="pointer",Wn=r}else if(Wn!==null)this.dispatchEvent({type:"hoveroff",object:Wn}),n.style.cursor="auto",Wn=null}La.copy(oi)}function sw(e){let t=this.object,n=this.domElement,i=this.raycaster;if(this.enabled===!1)return;if(this._updatePointer(e),this._updateState(e),ai.length=0,i.setFromCamera(oi,t),i.intersectObjects(this.objects,this.recursive,ai),ai.length>0){if(this.transformGroup===!0)Yt=fg(ai[0].object);else Yt=ai[0].object;if(qr.setFromNormalAndCoplanarPoint(t.getWorldDirection(qr.normal),Vh.setFromMatrixPosition(Yt.matrixWorld)),i.ray.intersectPlane(qr,Da)){if(this.state===bi.PAN)cg.copy(Yt.parent.matrixWorld).invert(),lg.copy(Da).sub(Vh.setFromMatrixPosition(Yt.matrixWorld)),n.style.cursor="move",this.dispatchEvent({type:"dragstart",object:Yt});else if(this.state===bi.ROTATE)hg.set(0,1,0).applyQuaternion(t.quaternion).normalize(),ug.set(1,0,0).applyQuaternion(t.quaternion).normalize(),n.style.cursor="move",this.dispatchEvent({type:"dragstart",object:Yt})}}La.copy(oi)}function ow(){if(this.enabled===!1)return;if(Yt)this.dispatchEvent({type:"dragend",object:Yt}),Yt=null;this.domElement.style.cursor=Wn?"pointer":"auto",this.state=bi.NONE}function aw(e){if(this.enabled===!1)return;e.preventDefault()}function fg(e,t=null){if(e.isGroup)t=e;if(e.parent===null)return t;return fg(e.parent,t)}function Na(e,t,n){var i,r=1;if(e==null)e=0;if(t==null)t=0;if(n==null)n=0;function s(){var o,a=i.length,l,c=0,h=0,f=0;for(o=0;o<a;++o)l=i[o],c+=l.x||0,h+=l.y||0,f+=l.z||0;for(c=(c/a-e)*r,h=(h/a-t)*r,f=(f/a-n)*r,o=0;o<a;++o){if(l=i[o],c)l.x-=c;if(h)l.y-=h;if(f)l.z-=f}}return s.initialize=function(o){i=o},s.x=function(o){return arguments.length?(e=+o,s):e},s.y=function(o){return arguments.length?(t=+o,s):t},s.z=function(o){return arguments.length?(n=+o,s):n},s.strength=function(o){return arguments.length?(r=+o,s):r},s}function pn(e){return function(){return e}}function Mn(e){return(e()-0.5)*0.000001}function lw(e){return e.index}function dg(e,t){var n=e.get(t);if(!n)throw Error("node not found: "+t);return n}function Oa(e){var t=lw,n=u,i,r=pn(30),s,o,a,l,c,h,f=1;if(e==null)e=[];function u(d){return 1/Math.min(l[d.source.index],l[d.target.index])}function p(d){for(var b=0,S=e.length;b<f;++b)for(var _=0,x,w,E,v=0,A=0,N=0,P,D;_<S;++_){if(x=e[_],w=x.source,E=x.target,v=E.x+E.vx-w.x-w.vx||Mn(h),a>1)A=E.y+E.vy-w.y-w.vy||Mn(h);if(a>2)N=E.z+E.vz-w.z-w.vz||Mn(h);if(P=Math.sqrt(v*v+A*A+N*N),P=(P-s[_])/P*d*i[_],v*=P,A*=P,N*=P,E.vx-=v*(D=c[_]),a>1)E.vy-=A*D;if(a>2)E.vz-=N*D;if(w.vx+=v*(D=1-D),a>1)w.vy+=A*D;if(a>2)w.vz+=N*D}}function g(){if(!o)return;var d,b=o.length,S=e.length,_=new Map(o.map((w,E)=>[t(w,E,o),w])),x;for(d=0,l=Array(b);d<S;++d){if(x=e[d],x.index=d,typeof x.source!=="object")x.source=dg(_,x.source);if(typeof x.target!=="object")x.target=dg(_,x.target);l[x.source.index]=(l[x.source.index]||0)+1,l[x.target.index]=(l[x.target.index]||0)+1}for(d=0,c=Array(S);d<S;++d)x=e[d],c[d]=l[x.source.index]/(l[x.source.index]+l[x.target.index]);i=Array(S),y(),s=Array(S),m()}function y(){if(!o)return;for(var d=0,b=e.length;d<b;++d)i[d]=+n(e[d],d,e)}function m(){if(!o)return;for(var d=0,b=e.length;d<b;++d)s[d]=+r(e[d],d,e)}return p.initialize=function(d,...b){o=d,h=b.find((S)=>typeof S==="function")||Math.random,a=b.find((S)=>[1,2,3].includes(S))||2,g()},p.links=function(d){return arguments.length?(e=d,g(),p):e},p.id=function(d){return arguments.length?(t=d,p):t},p.iterations=function(d){return arguments.length?(f=+d,p):f},p.strength=function(d){return arguments.length?(n=typeof d==="function"?d:pn(+d),y(),p):n},p.distance=function(d){return arguments.length?(r=typeof d==="function"?d:pn(+d),m(),p):r},p}function Xh(e){let t=+this._x.call(null,e);return pg(this.cover(t),t,e)}function pg(e,t,n){if(isNaN(t))return e;var i,r=e._root,s={data:n},{_x0:o,_x1:a}=e,l,c,h,f,u;if(!r)return e._root=s,e;while(r.length){if(h=t>=(l=(o+a)/2))o=l;else a=l;if(i=r,!(r=r[f=+h]))return i[f]=s,e}if(c=+e._x.call(null,r.data),t===c)return s.next=r,i?i[f]=s:e._root=s,e;do if(i=i?i[f]=[,,]:e._root=[,,],h=t>=(l=(o+a)/2))o=l;else a=l;while((f=+h)===(u=+(c>=l)));return i[u]=r,i[f]=s,e}function mg(e){if(!Array.isArray(e))e=Array.from(e);let t=e.length,n=new Float64Array(t),i=1/0,r=-1/0;for(let s=0,o;s<t;++s){if(isNaN(o=+this._x.call(null,e[s])))continue;if(n[s]=o,o<i)i=o;if(o>r)r=o}if(i>r)return this;this.cover(i).cover(r);for(let s=0;s<t;++s)pg(this,n[s],e[s]);return this}function qh(e){if(isNaN(e=+e))return this;var t=this._x0,n=this._x1;if(isNaN(t))n=(t=Math.floor(e))+1;else{var i=n-t||1,r=this._root,s,o;while(t>e||e>=n)switch(o=+(e<t),s=[,,],s[o]=r,r=s,i*=2,o){case 0:n=t+i;break;case 1:t=n-i;break}if(this._root&&this._root.length)this._root=r}return this._x0=t,this._x1=n,this}function jh(){var e=[];return this.visit(function(t){if(!t.length)do e.push(t.data);while(t=t.next)}),e}function Yh(e){return arguments.length?this.cover(+e[0][0]).cover(+e[1][0]):isNaN(this._x0)?void 0:[[this._x0],[this._x1]]}function mn(e,t,n){this.node=e,this.x0=t,this.x1=n}function $h(e,t){var n,i=this._x0,r,s,o=this._x1,a=[],l=this._root,c,h;if(l)a.push(new mn(l,i,o));if(t==null)t=1/0;else i=e-t,o=e+t;while(c=a.pop()){if(!(l=c.node)||(r=c.x0)>o||(s=c.x1)<i)continue;if(l.length){var f=(r+s)/2;if(a.push(new mn(l[1],f,s),new mn(l[0],r,f)),h=+(e>=f))c=a[a.length-1],a[a.length-1]=a[a.length-1-h],a[a.length-1-h]=c}else{var u=Math.abs(e-+this._x.call(null,l.data));if(u<t)t=u,i=e-u,o=e+u,n=l.data}}return n}function Zh(e){if(isNaN(l=+this._x.call(null,e)))return this;var t,n=this._root,i,r,s,o=this._x0,a=this._x1,l,c,h,f,u;if(!n)return this;if(n.length)while(!0){if(h=l>=(c=(o+a)/2))o=c;else a=c;if(t=n,!(n=n[f=+h]))return this;if(!n.length)break;if(t[f+1&1])i=t,u=f}while(n.data!==e)if(r=n,!(n=n.next))return this;if(s=n.next)delete n.next;if(r)return s?r.next=s:delete r.next,this;if(!t)return this._root=s,this;if(s?t[f]=s:delete t[f],(n=t[0]||t[1])&&n===(t[1]||t[0])&&!n.length)if(i)i[u]=n;else this._root=n;return this}function gg(e){for(var t=0,n=e.length;t<n;++t)this.remove(e[t]);return this}function Jh(){return this._root}function Kh(){var e=0;return this.visit(function(t){if(!t.length)do++e;while(t=t.next)}),e}function Qh(e){var t=[],n,i=this._root,r,s,o;if(i)t.push(new mn(i,this._x0,this._x1));while(n=t.pop())if(!e(i=n.node,s=n.x0,o=n.x1)&&i.length){var a=(s+o)/2;if(r=i[1])t.push(new mn(r,a,o));if(r=i[0])t.push(new mn(r,s,a))}return this}function eu(e){var t=[],n=[],i;if(this._root)t.push(new mn(this._root,this._x0,this._x1));while(i=t.pop()){var r=i.node;if(r.length){var s,o=i.x0,a=i.x1,l=(o+a)/2;if(s=r[0])t.push(new mn(s,o,l));if(s=r[1])t.push(new mn(s,l,a))}n.push(i)}while(i=n.pop())e(i.node,i.x0,i.x1);return this}function _g(e){return e[0]}function tu(e){return arguments.length?(this._x=e,this):this._x}function js(e,t){var n=new nu(t==null?_g:t,NaN,NaN);return e==null?n:n.addAll(e)}function nu(e,t,n){this._x=e,this._x0=t,this._x1=n,this._root=void 0}function vg(e){var t={data:e.data},n=t;while(e=e.next)n=n.next={data:e.data};return t}var ln=js.prototype=nu.prototype;ln.copy=function(){var e=new nu(this._x,this._x0,this._x1),t=this._root,n,i;if(!t)return e;if(!t.length)return e._root=vg(t),e;n=[{source:t,target:e._root=[,,]}];while(t=n.pop())for(var r=0;r<2;++r)if(i=t.source[r])if(i.length)n.push({source:i,target:t.target[r]=[,,]});else t.target[r]=vg(i);return e};ln.add=Xh;ln.addAll=mg;ln.cover=qh;ln.data=jh;ln.extent=Yh;ln.find=$h;ln.remove=Zh;ln.removeAll=gg;ln.root=Jh;ln.size=Kh;ln.visit=Qh;ln.visitAfter=eu;ln.x=tu;function iu(e){let t=+this._x.call(null,e),n=+this._y.call(null,e);return yg(this.cover(t,n),t,n,e)}function yg(e,t,n,i){if(isNaN(t)||isNaN(n))return e;var r,s=e._root,o={data:i},{_x0:a,_y0:l,_x1:c,_y1:h}=e,f,u,p,g,y,m,d,b;if(!s)return e._root=o,e;while(s.length){if(y=t>=(f=(a+c)/2))a=f;else c=f;if(m=n>=(u=(l+h)/2))l=u;else h=u;if(r=s,!(s=s[d=m<<1|y]))return r[d]=o,e}if(p=+e._x.call(null,s.data),g=+e._y.call(null,s.data),t===p&&n===g)return o.next=s,r?r[d]=o:e._root=o,e;do{if(r=r?r[d]=[,,,,]:e._root=[,,,,],y=t>=(f=(a+c)/2))a=f;else c=f;if(m=n>=(u=(l+h)/2))l=u;else h=u}while((d=m<<1|y)===(b=(g>=u)<<1|p>=f));return r[b]=s,r[d]=o,e}function xg(e){var t,n,i=e.length,r,s,o=Array(i),a=Array(i),l=1/0,c=1/0,h=-1/0,f=-1/0;for(n=0;n<i;++n){if(isNaN(r=+this._x.call(null,t=e[n]))||isNaN(s=+this._y.call(null,t)))continue;if(o[n]=r,a[n]=s,r<l)l=r;if(r>h)h=r;if(s<c)c=s;if(s>f)f=s}if(l>h||c>f)return this;this.cover(l,c).cover(h,f);for(n=0;n<i;++n)yg(this,o[n],a[n],e[n]);return this}function ru(e,t){if(isNaN(e=+e)||isNaN(t=+t))return this;var n=this._x0,i=this._y0,r=this._x1,s=this._y1;if(isNaN(n))r=(n=Math.floor(e))+1,s=(i=Math.floor(t))+1;else{var o=r-n||1,a=this._root,l,c;while(n>e||e>=r||i>t||t>=s)switch(c=(t<i)<<1|e<n,l=[,,,,],l[c]=a,a=l,o*=2,c){case 0:r=n+o,s=i+o;break;case 1:n=r-o,s=i+o;break;case 2:r=n+o,i=s-o;break;case 3:n=r-o,i=s-o;break}if(this._root&&this._root.length)this._root=a}return this._x0=n,this._y0=i,this._x1=r,this._y1=s,this}function su(){var e=[];return this.visit(function(t){if(!t.length)do e.push(t.data);while(t=t.next)}),e}function ou(e){return arguments.length?this.cover(+e[0][0],+e[0][1]).cover(+e[1][0],+e[1][1]):isNaN(this._x0)?void 0:[[this._x0,this._y0],[this._x1,this._y1]]}function Nt(e,t,n,i,r){this.node=e,this.x0=t,this.y0=n,this.x1=i,this.y1=r}function au(e,t,n){var i,r=this._x0,s=this._y0,o,a,l,c,h=this._x1,f=this._y1,u=[],p=this._root,g,y;if(p)u.push(new Nt(p,r,s,h,f));if(n==null)n=1/0;else r=e-n,s=t-n,h=e+n,f=t+n,n*=n;while(g=u.pop()){if(!(p=g.node)||(o=g.x0)>h||(a=g.y0)>f||(l=g.x1)<r||(c=g.y1)<s)continue;if(p.length){var m=(o+l)/2,d=(a+c)/2;if(u.push(new Nt(p[3],m,d,l,c),new Nt(p[2],o,d,m,c),new Nt(p[1],m,a,l,d),new Nt(p[0],o,a,m,d)),y=(t>=d)<<1|e>=m)g=u[u.length-1],u[u.length-1]=u[u.length-1-y],u[u.length-1-y]=g}else{var b=e-+this._x.call(null,p.data),S=t-+this._y.call(null,p.data),_=b*b+S*S;if(_<n){var x=Math.sqrt(n=_);r=e-x,s=t-x,h=e+x,f=t+x,i=p.data}}}return i}function lu(e){if(isNaN(h=+this._x.call(null,e))||isNaN(f=+this._y.call(null,e)))return this;var t,n=this._root,i,r,s,o=this._x0,a=this._y0,l=this._x1,c=this._y1,h,f,u,p,g,y,m,d;if(!n)return this;if(n.length)while(!0){if(g=h>=(u=(o+l)/2))o=u;else l=u;if(y=f>=(p=(a+c)/2))a=p;else c=p;if(t=n,!(n=n[m=y<<1|g]))return this;if(!n.length)break;if(t[m+1&3]||t[m+2&3]||t[m+3&3])i=t,d=m}while(n.data!==e)if(r=n,!(n=n.next))return this;if(s=n.next)delete n.next;if(r)return s?r.next=s:delete r.next,this;if(!t)return this._root=s,this;if(s?t[m]=s:delete t[m],(n=t[0]||t[1]||t[2]||t[3])&&n===(t[3]||t[2]||t[1]||t[0])&&!n.length)if(i)i[d]=n;else this._root=n;return this}function bg(e){for(var t=0,n=e.length;t<n;++t)this.remove(e[t]);return this}function cu(){return this._root}function hu(){var e=0;return this.visit(function(t){if(!t.length)do++e;while(t=t.next)}),e}function uu(e){var t=[],n,i=this._root,r,s,o,a,l;if(i)t.push(new Nt(i,this._x0,this._y0,this._x1,this._y1));while(n=t.pop())if(!e(i=n.node,s=n.x0,o=n.y0,a=n.x1,l=n.y1)&&i.length){var c=(s+a)/2,h=(o+l)/2;if(r=i[3])t.push(new Nt(r,c,h,a,l));if(r=i[2])t.push(new Nt(r,s,h,c,l));if(r=i[1])t.push(new Nt(r,c,o,a,h));if(r=i[0])t.push(new Nt(r,s,o,c,h))}return this}function fu(e){var t=[],n=[],i;if(this._root)t.push(new Nt(this._root,this._x0,this._y0,this._x1,this._y1));while(i=t.pop()){var r=i.node;if(r.length){var s,o=i.x0,a=i.y0,l=i.x1,c=i.y1,h=(o+l)/2,f=(a+c)/2;if(s=r[0])t.push(new Nt(s,o,a,h,f));if(s=r[1])t.push(new Nt(s,h,a,l,f));if(s=r[2])t.push(new Nt(s,o,f,h,c));if(s=r[3])t.push(new Nt(s,h,f,l,c))}n.push(i)}while(i=n.pop())e(i.node,i.x0,i.y0,i.x1,i.y1);return this}function Sg(e){return e[0]}function du(e){return arguments.length?(this._x=e,this):this._x}function Mg(e){return e[1]}function pu(e){return arguments.length?(this._y=e,this):this._y}function Ys(e,t,n){var i=new mu(t==null?Sg:t,n==null?Mg:n,NaN,NaN,NaN,NaN);return e==null?i:i.addAll(e)}function mu(e,t,n,i,r,s){this._x=e,this._y=t,this._x0=n,this._y0=i,this._x1=r,this._y1=s,this._root=void 0}function wg(e){var t={data:e.data},n=t;while(e=e.next)n=n.next={data:e.data};return t}var Qt=Ys.prototype=mu.prototype;Qt.copy=function(){var e=new mu(this._x,this._y,this._x0,this._y0,this._x1,this._y1),t=this._root,n,i;if(!t)return e;if(!t.length)return e._root=wg(t),e;n=[{source:t,target:e._root=[,,,,]}];while(t=n.pop())for(var r=0;r<4;++r)if(i=t.source[r])if(i.length)n.push({source:i,target:t.target[r]=[,,,,]});else t.target[r]=wg(i);return e};Qt.add=iu;Qt.addAll=xg;Qt.cover=ru;Qt.data=su;Qt.extent=ou;Qt.find=au;Qt.remove=lu;Qt.removeAll=bg;Qt.root=cu;Qt.size=hu;Qt.visit=uu;Qt.visitAfter=fu;Qt.x=du;Qt.y=pu;function gu(e){let t=+this._x.call(null,e),n=+this._y.call(null,e),i=+this._z.call(null,e);return Tg(this.cover(t,n,i),t,n,i,e)}function Tg(e,t,n,i,r){if(isNaN(t)||isNaN(n)||isNaN(i))return e;var s,o=e._root,a={data:r},{_x0:l,_y0:c,_z0:h,_x1:f,_y1:u,_z1:p}=e,g,y,m,d,b,S,_,x,w,E,v;if(!o)return e._root=a,e;while(o.length){if(_=t>=(g=(l+f)/2))l=g;else f=g;if(x=n>=(y=(c+u)/2))c=y;else u=y;if(w=i>=(m=(h+p)/2))h=m;else p=m;if(s=o,!(o=o[E=w<<2|x<<1|_]))return s[E]=a,e}if(d=+e._x.call(null,o.data),b=+e._y.call(null,o.data),S=+e._z.call(null,o.data),t===d&&n===b&&i===S)return a.next=o,s?s[E]=a:e._root=a,e;do{if(s=s?s[E]=[,,,,,,,,]:e._root=[,,,,,,,,],_=t>=(g=(l+f)/2))l=g;else f=g;if(x=n>=(y=(c+u)/2))c=y;else u=y;if(w=i>=(m=(h+p)/2))h=m;else p=m}while((E=w<<2|x<<1|_)===(v=(S>=m)<<2|(b>=y)<<1|d>=g));return s[v]=o,s[E]=a,e}function Eg(e){if(!Array.isArray(e))e=Array.from(e);let t=e.length,n=new Float64Array(t),i=new Float64Array(t),r=new Float64Array(t),s=1/0,o=1/0,a=1/0,l=-1/0,c=-1/0,h=-1/0;for(let f=0,u,p,g,y;f<t;++f){if(isNaN(p=+this._x.call(null,u=e[f]))||isNaN(g=+this._y.call(null,u))||isNaN(y=+this._z.call(null,u)))continue;if(n[f]=p,i[f]=g,r[f]=y,p<s)s=p;if(p>l)l=p;if(g<o)o=g;if(g>c)c=g;if(y<a)a=y;if(y>h)h=y}if(s>l||o>c||a>h)return this;this.cover(s,o,a).cover(l,c,h);for(let f=0;f<t;++f)Tg(this,n[f],i[f],r[f],e[f]);return this}function _u(e,t,n){if(isNaN(e=+e)||isNaN(t=+t)||isNaN(n=+n))return this;var i=this._x0,r=this._y0,s=this._z0,o=this._x1,a=this._y1,l=this._z1;if(isNaN(i))o=(i=Math.floor(e))+1,a=(r=Math.floor(t))+1,l=(s=Math.floor(n))+1;else{var c=o-i||1,h=this._root,f,u;while(i>e||e>=o||r>t||t>=a||s>n||n>=l)switch(u=(n<s)<<2|(t<r)<<1|e<i,f=[,,,,,,,,],f[u]=h,h=f,c*=2,u){case 0:o=i+c,a=r+c,l=s+c;break;case 1:i=o-c,a=r+c,l=s+c;break;case 2:o=i+c,r=a-c,l=s+c;break;case 3:i=o-c,r=a-c,l=s+c;break;case 4:o=i+c,a=r+c,s=l-c;break;case 5:i=o-c,a=r+c,s=l-c;break;case 6:o=i+c,r=a-c,s=l-c;break;case 7:i=o-c,r=a-c,s=l-c;break}if(this._root&&this._root.length)this._root=h}return this._x0=i,this._y0=r,this._z0=s,this._x1=o,this._y1=a,this._z1=l,this}function vu(){var e=[];return this.visit(function(t){if(!t.length)do e.push(t.data);while(t=t.next)}),e}function yu(e){return arguments.length?this.cover(+e[0][0],+e[0][1],+e[0][2]).cover(+e[1][0],+e[1][1],+e[1][2]):isNaN(this._x0)?void 0:[[this._x0,this._y0,this._z0],[this._x1,this._y1,this._z1]]}function Qe(e,t,n,i,r,s,o){this.node=e,this.x0=t,this.y0=n,this.z0=i,this.x1=r,this.y1=s,this.z1=o}function xu(e,t,n,i){var r,s=this._x0,o=this._y0,a=this._z0,l,c,h,f,u,p,g=this._x1,y=this._y1,m=this._z1,d=[],b=this._root,S,_;if(b)d.push(new Qe(b,s,o,a,g,y,m));if(i==null)i=1/0;else s=e-i,o=t-i,a=n-i,g=e+i,y=t+i,m=n+i,i*=i;while(S=d.pop()){if(!(b=S.node)||(l=S.x0)>g||(c=S.y0)>y||(h=S.z0)>m||(f=S.x1)<s||(u=S.y1)<o||(p=S.z1)<a)continue;if(b.length){var x=(l+f)/2,w=(c+u)/2,E=(h+p)/2;if(d.push(new Qe(b[7],x,w,E,f,u,p),new Qe(b[6],l,w,E,x,u,p),new Qe(b[5],x,c,E,f,w,p),new Qe(b[4],l,c,E,x,w,p),new Qe(b[3],x,w,h,f,u,E),new Qe(b[2],l,w,h,x,u,E),new Qe(b[1],x,c,h,f,w,E),new Qe(b[0],l,c,h,x,w,E)),_=(n>=E)<<2|(t>=w)<<1|e>=x)S=d[d.length-1],d[d.length-1]=d[d.length-1-_],d[d.length-1-_]=S}else{var v=e-+this._x.call(null,b.data),A=t-+this._y.call(null,b.data),N=n-+this._z.call(null,b.data),P=v*v+A*A+N*N;if(P<i){var D=Math.sqrt(i=P);s=e-D,o=t-D,a=n-D,g=e+D,y=t+D,m=n+D,r=b.data}}}return r}var cw=(e,t,n,i,r,s)=>Math.sqrt((e-i)**2+(t-r)**2+(n-s)**2);function Ag(e,t,n,i){let r=[],s=e-i,o=t-i,a=n-i,l=e+i,c=t+i,h=n+i;return this.visit((f,u,p,g,y,m,d)=>{if(!f.length)do{let b=f.data;if(cw(e,t,n,this._x(b),this._y(b),this._z(b))<=i)r.push(b)}while(f=f.next);return u>l||p>c||g>h||y<s||m<o||d<a}),r}function bu(e){if(isNaN(u=+this._x.call(null,e))||isNaN(p=+this._y.call(null,e))||isNaN(g=+this._z.call(null,e)))return this;var t,n=this._root,i,r,s,o=this._x0,a=this._y0,l=this._z0,c=this._x1,h=this._y1,f=this._z1,u,p,g,y,m,d,b,S,_,x,w;if(!n)return this;if(n.length)while(!0){if(b=u>=(y=(o+c)/2))o=y;else c=y;if(S=p>=(m=(a+h)/2))a=m;else h=m;if(_=g>=(d=(l+f)/2))l=d;else f=d;if(t=n,!(n=n[x=_<<2|S<<1|b]))return this;if(!n.length)break;if(t[x+1&7]||t[x+2&7]||t[x+3&7]||t[x+4&7]||t[x+5&7]||t[x+6&7]||t[x+7&7])i=t,w=x}while(n.data!==e)if(r=n,!(n=n.next))return this;if(s=n.next)delete n.next;if(r)return s?r.next=s:delete r.next,this;if(!t)return this._root=s,this;if(s?t[x]=s:delete t[x],(n=t[0]||t[1]||t[2]||t[3]||t[4]||t[5]||t[6]||t[7])&&n===(t[7]||t[6]||t[5]||t[4]||t[3]||t[2]||t[1]||t[0])&&!n.length)if(i)i[w]=n;else this._root=n;return this}function Cg(e){for(var t=0,n=e.length;t<n;++t)this.remove(e[t]);return this}function Su(){return this._root}function Mu(){var e=0;return this.visit(function(t){if(!t.length)do++e;while(t=t.next)}),e}function wu(e){var t=[],n,i=this._root,r,s,o,a,l,c,h;if(i)t.push(new Qe(i,this._x0,this._y0,this._z0,this._x1,this._y1,this._z1));while(n=t.pop())if(!e(i=n.node,s=n.x0,o=n.y0,a=n.z0,l=n.x1,c=n.y1,h=n.z1)&&i.length){var f=(s+l)/2,u=(o+c)/2,p=(a+h)/2;if(r=i[7])t.push(new Qe(r,f,u,p,l,c,h));if(r=i[6])t.push(new Qe(r,s,u,p,f,c,h));if(r=i[5])t.push(new Qe(r,f,o,p,l,u,h));if(r=i[4])t.push(new Qe(r,s,o,p,f,u,h));if(r=i[3])t.push(new Qe(r,f,u,a,l,c,p));if(r=i[2])t.push(new Qe(r,s,u,a,f,c,p));if(r=i[1])t.push(new Qe(r,f,o,a,l,u,p));if(r=i[0])t.push(new Qe(r,s,o,a,f,u,p))}return this}function Tu(e){var t=[],n=[],i;if(this._root)t.push(new Qe(this._root,this._x0,this._y0,this._z0,this._x1,this._y1,this._z1));while(i=t.pop()){var r=i.node;if(r.length){var s,o=i.x0,a=i.y0,l=i.z0,c=i.x1,h=i.y1,f=i.z1,u=(o+c)/2,p=(a+h)/2,g=(l+f)/2;if(s=r[0])t.push(new Qe(s,o,a,l,u,p,g));if(s=r[1])t.push(new Qe(s,u,a,l,c,p,g));if(s=r[2])t.push(new Qe(s,o,p,l,u,h,g));if(s=r[3])t.push(new Qe(s,u,p,l,c,h,g));if(s=r[4])t.push(new Qe(s,o,a,g,u,p,f));if(s=r[5])t.push(new Qe(s,u,a,g,c,p,f));if(s=r[6])t.push(new Qe(s,o,p,g,u,h,f));if(s=r[7])t.push(new Qe(s,u,p,g,c,h,f))}n.push(i)}while(i=n.pop())e(i.node,i.x0,i.y0,i.z0,i.x1,i.y1,i.z1);return this}function Rg(e){return e[0]}function Eu(e){return arguments.length?(this._x=e,this):this._x}function Pg(e){return e[1]}function Au(e){return arguments.length?(this._y=e,this):this._y}function Ig(e){return e[2]}function Cu(e){return arguments.length?(this._z=e,this):this._z}function $s(e,t,n,i){var r=new Ru(t==null?Rg:t,n==null?Pg:n,i==null?Ig:i,NaN,NaN,NaN,NaN,NaN,NaN);return e==null?r:r.addAll(e)}function Ru(e,t,n,i,r,s,o,a,l){this._x=e,this._y=t,this._z=n,this._x0=i,this._y0=r,this._z0=s,this._x1=o,this._y1=a,this._z1=l,this._root=void 0}function Lg(e){var t={data:e.data},n=t;while(e=e.next)n=n.next={data:e.data};return t}var Gt=$s.prototype=Ru.prototype;Gt.copy=function(){var e=new Ru(this._x,this._y,this._z,this._x0,this._y0,this._z0,this._x1,this._y1,this._z1),t=this._root,n,i;if(!t)return e;if(!t.length)return e._root=Lg(t),e;n=[{source:t,target:e._root=[,,,,,,,,]}];while(t=n.pop())for(var r=0;r<8;++r)if(i=t.source[r])if(i.length)n.push({source:i,target:t.target[r]=[,,,,,,,,]});else t.target[r]=Lg(i);return e};Gt.add=gu;Gt.addAll=Eg;Gt.cover=_u;Gt.data=vu;Gt.extent=yu;Gt.find=xu;Gt.findAllWithinRadius=Ag;Gt.remove=bu;Gt.removeAll=Cg;Gt.root=Su;Gt.size=Mu;Gt.visit=wu;Gt.visitAfter=Tu;Gt.x=Eu;Gt.y=Au;Gt.z=Cu;var hw={value:()=>{}};function Ng(){for(var e=0,t=arguments.length,n={},i;e<t;++e){if(!(i=arguments[e]+"")||i in n||/[\s.]/.test(i))throw Error("illegal type: "+i);n[i]=[]}return new Ua(n)}function Ua(e){this._=e}function uw(e,t){return e.trim().split(/^|\s+/).map(function(n){var i="",r=n.indexOf(".");if(r>=0)i=n.slice(r+1),n=n.slice(0,r);if(n&&!t.hasOwnProperty(n))throw Error("unknown type: "+n);return{type:n,name:i}})}Ua.prototype=Ng.prototype={constructor:Ua,on:function(e,t){var n=this._,i=uw(e+"",n),r,s=-1,o=i.length;if(arguments.length<2){while(++s<o)if((r=(e=i[s]).type)&&(r=fw(n[r],e.name)))return r;return}if(t!=null&&typeof t!=="function")throw Error("invalid callback: "+t);while(++s<o)if(r=(e=i[s]).type)n[r]=Dg(n[r],e.name,t);else if(t==null)for(r in n)n[r]=Dg(n[r],e.name,null);return this},copy:function(){var e={},t=this._;for(var n in t)e[n]=t[n].slice();return new Ua(e)},call:function(e,t){if((r=arguments.length-2)>0)for(var n=Array(r),i=0,r,s;i<r;++i)n[i]=arguments[i+2];if(!this._.hasOwnProperty(e))throw Error("unknown type: "+e);for(s=this._[e],i=0,r=s.length;i<r;++i)s[i].value.apply(t,n)},apply:function(e,t,n){if(!this._.hasOwnProperty(e))throw Error("unknown type: "+e);for(var i=this._[e],r=0,s=i.length;r<s;++r)i[r].value.apply(t,n)}};function fw(e,t){for(var n=0,i=e.length,r;n<i;++n)if((r=e[n]).name===t)return r.value}function Dg(e,t,n){for(var i=0,r=e.length;i<r;++i)if(e[i].name===t){e[i]=hw,e=e.slice(0,i).concat(e.slice(i+1));break}if(n!=null)e.push({name:t,value:n});return e}var Pu=Ng;var jr=0,Js=0,Zs=0,Ug=1000,Fa,Ks,Ba=0,er=0,ka=0,Qs=typeof performance==="object"&&performance.now?performance:Date,Fg=typeof window==="object"&&window.requestAnimationFrame?window.requestAnimationFrame.bind(window):function(e){setTimeout(e,17)};function Du(){return er||(Fg(dw),er=Qs.now()+ka)}function dw(){er=0}function Iu(){this._call=this._time=this._next=null}Iu.prototype=za.prototype={constructor:Iu,restart:function(e,t,n){if(typeof e!=="function")throw TypeError("callback is not a function");if(n=(n==null?Du():+n)+(t==null?0:+t),!this._next&&Ks!==this){if(Ks)Ks._next=this;else Fa=this;Ks=this}this._call=e,this._time=n,Lu()},stop:function(){if(this._call)this._call=null,this._time=1/0,Lu()}};function za(e,t,n){var i=new Iu;return i.restart(e,t,n),i}function Bg(){Du(),++jr;var e=Fa,t;while(e){if((t=er-e._time)>=0)e._call.call(void 0,t);e=e._next}--jr}function Og(){er=(Ba=Qs.now())+ka,jr=Js=0;try{Bg()}finally{jr=0,mw(),er=0}}function pw(){var e=Qs.now(),t=e-Ba;if(t>Ug)ka-=t,Ba=e}function mw(){var e,t=Fa,n,i=1/0;while(t)if(t._call){if(i>t._time)i=t._time;e=t,t=t._next}else n=t._next,t._next=null,t=e?e._next=n:Fa=n;Ks=e,Lu(i)}function Lu(e){if(jr)return;if(Js)Js=clearTimeout(Js);var t=e-er;if(t>24){if(e<1/0)Js=setTimeout(Og,e-Qs.now()-ka);if(Zs)Zs=clearInterval(Zs)}else{if(!Zs)Ba=Qs.now(),Zs=setInterval(pw,Ug);jr=1,Fg(Og)}}function Nu(){let e=1;return()=>(e=(1664525*e+1013904223)%4294967296)/4294967296}var kg=3;function Ga(e){return e.x}function Ou(e){return e.y}function zg(e){return e.z}var gw=10,_w=Math.PI*(3-Math.sqrt(5)),vw=Math.PI*20/(9+Math.sqrt(221));function Ha(e,t){t=t||2;var n=Math.min(kg,Math.max(1,Math.round(t))),i,r=1,s=0.001,o=1-Math.pow(s,0.0033333333333333335),a=0,l=0.6,c=new Map,h=za(p),f=Pu("tick","end"),u=Nu();if(e==null)e=[];function p(){if(g(),f.call("tick",i),r<s)h.stop(),f.call("end",i)}function g(d){var b,S=e.length,_;if(d===void 0)d=1;for(var x=0;x<d;++x){r+=(a-r)*o,c.forEach(function(w){w(r)});for(b=0;b<S;++b){if(_=e[b],_.fx==null)_.x+=_.vx*=l;else _.x=_.fx,_.vx=0;if(n>1)if(_.fy==null)_.y+=_.vy*=l;else _.y=_.fy,_.vy=0;if(n>2)if(_.fz==null)_.z+=_.vz*=l;else _.z=_.fz,_.vz=0}}return i}function y(){for(var d=0,b=e.length,S;d<b;++d){if(S=e[d],S.index=d,S.fx!=null)S.x=S.fx;if(S.fy!=null)S.y=S.fy;if(S.fz!=null)S.z=S.fz;if(isNaN(S.x)||n>1&&isNaN(S.y)||n>2&&isNaN(S.z)){var _=gw*(n>2?Math.cbrt(0.5+d):n>1?Math.sqrt(0.5+d):d),x=d*_w,w=d*vw;if(n===1)S.x=_;else if(n===2)S.x=_*Math.cos(x),S.y=_*Math.sin(x);else S.x=_*Math.sin(x)*Math.cos(w),S.y=_*Math.cos(x),S.z=_*Math.sin(x)*Math.sin(w)}if(isNaN(S.vx)||n>1&&isNaN(S.vy)||n>2&&isNaN(S.vz)){if(S.vx=0,n>1)S.vy=0;if(n>2)S.vz=0}}}function m(d){if(d.initialize)d.initialize(e,u,n);return d}return y(),i={tick:g,restart:function(){return h.restart(p),i},stop:function(){return h.stop(),i},numDimensions:function(d){return arguments.length?(n=Math.min(kg,Math.max(1,Math.round(d))),c.forEach(m),i):n},nodes:function(d){return arguments.length?(e=d,y(),c.forEach(m),i):e},alpha:function(d){return arguments.length?(r=+d,i):r},alphaMin:function(d){return arguments.length?(s=+d,i):s},alphaDecay:function(d){return arguments.length?(o=+d,i):+o},alphaTarget:function(d){return arguments.length?(a=+d,i):a},velocityDecay:function(d){return arguments.length?(l=1-d,i):1-l},randomSource:function(d){return arguments.length?(u=d,c.forEach(m),i):u},force:function(d,b){return arguments.length>1?(b==null?c.delete(d):c.set(d,m(b)),i):c.get(d)},find:function(){var d=Array.prototype.slice.call(arguments),b=d.shift()||0,S=(n>1?d.shift():null)||0,_=(n>2?d.shift():null)||0,x=d.shift()||1/0,w=0,E=e.length,v,A,N,P,D,W;x*=x;for(w=0;w<E;++w)if(D=e[w],v=b-D.x,A=S-(D.y||0),N=_-(D.z||0),P=v*v+A*A+N*N,P<x)W=D,x=P;return W},on:function(d,b){return arguments.length>1?(f.on(d,b),i):f.on(d)}}}function Va(){var e,t,n,i,r,s=pn(-30),o,a=1,l=1/0,c=0.81;function h(g){var y,m=e.length,d=(t===1?js(e,Ga):t===2?Ys(e,Ga,Ou):t===3?$s(e,Ga,Ou,zg):null).visitAfter(u);for(r=g,y=0;y<m;++y)n=e[y],d.visit(p)}function f(){if(!e)return;var g,y=e.length,m;o=Array(y);for(g=0;g<y;++g)m=e[g],o[m.index]=+s(m,g,e)}function u(g){var y=0,m,d,b=0,S,_,x,w,E=g.length;if(E){for(S=_=x=w=0;w<E;++w)if((m=g[w])&&(d=Math.abs(m.value)))y+=m.value,b+=d,S+=d*(m.x||0),_+=d*(m.y||0),x+=d*(m.z||0);if(y*=Math.sqrt(4/E),g.x=S/b,t>1)g.y=_/b;if(t>2)g.z=x/b}else{if(m=g,m.x=m.data.x,t>1)m.y=m.data.y;if(t>2)m.z=m.data.z;do y+=o[m.data.index];while(m=m.next)}g.value=y}function p(g,y,m,d,b){if(!g.value)return!0;var S=[m,d,b][t-1],_=g.x-n.x,x=t>1?g.y-n.y:0,w=t>2?g.z-n.z:0,E=S-y,v=_*_+x*x+w*w;if(E*E/c<v){if(v<l){if(_===0)_=Mn(i),v+=_*_;if(t>1&&x===0)x=Mn(i),v+=x*x;if(t>2&&w===0)w=Mn(i),v+=w*w;if(v<a)v=Math.sqrt(a*v);if(n.vx+=_*g.value*r/v,t>1)n.vy+=x*g.value*r/v;if(t>2)n.vz+=w*g.value*r/v}return!0}else if(g.length||v>=l)return;if(g.data!==n||g.next){if(_===0)_=Mn(i),v+=_*_;if(t>1&&x===0)x=Mn(i),v+=x*x;if(t>2&&w===0)w=Mn(i),v+=w*w;if(v<a)v=Math.sqrt(a*v)}do if(g.data!==n){if(E=o[g.data.index]*r/v,n.vx+=_*E,t>1)n.vy+=x*E;if(t>2)n.vz+=w*E}while(g=g.next)}return h.initialize=function(g,...y){e=g,i=y.find((m)=>typeof m==="function")||Math.random,t=y.find((m)=>[1,2,3].includes(m))||2,f()},h.strength=function(g){return arguments.length?(s=typeof g==="function"?g:pn(+g),f(),h):s},h.distanceMin=function(g){return arguments.length?(a=g*g,h):Math.sqrt(a)},h.distanceMax=function(g){return arguments.length?(l=g*g,h):Math.sqrt(l)},h.theta=function(g){return arguments.length?(c=g*g,h):Math.sqrt(c)},h}function Wa(e,t,n,i){var r,s,o=pn(0.1),a,l;if(typeof e!=="function")e=pn(+e);if(t==null)t=0;if(n==null)n=0;if(i==null)i=0;function c(f){for(var u=0,p=r.length;u<p;++u){var g=r[u],y=g.x-t||0.000001,m=(g.y||0)-n||0.000001,d=(g.z||0)-i||0.000001,b=Math.sqrt(y*y+m*m+d*d),S=(l[u]-b)*a[u]*f/b;if(g.vx+=y*S,s>1)g.vy+=m*S;if(s>2)g.vz+=d*S}}function h(){if(!r)return;var f,u=r.length;a=Array(u),l=Array(u);for(f=0;f<u;++f)l[f]=+e(r[f],f,r),a[f]=isNaN(l[f])?0:+o(r[f],f,r)}return c.initialize=function(f,...u){r=f,s=u.find((p)=>[1,2,3].includes(p))||2,h()},c.strength=function(f){return arguments.length?(o=typeof f==="function"?f:pn(+f),h(),c):o},c.radius=function(f){return arguments.length?(e=typeof f==="function"?f:pn(+f),h(),c):e},c.x=function(f){return arguments.length?(t=+f,c):t},c.y=function(f){return arguments.length?(n=+f,c):n},c.z=function(f){return arguments.length?(i=+f,c):i},c}function Uu(e){xw(e);let t=yw(e);return e.on=t.on,e.off=t.off,e.fire=t.fire,e}function yw(e){let t=Object.create(null);return{on:function(n,i,r){if(typeof i!=="function")throw Error("callback is expected to be a function");let s=t[n];if(!s)s=t[n]=[];return s.push({callback:i,ctx:r}),e},off:function(n,i){if(typeof n>"u")return t=Object.create(null),e;if(t[n])if(typeof i!=="function")delete t[n];else{let o=t[n];for(let a=0;a<o.length;++a)if(o[a].callback===i)o.splice(a,1)}return e},fire:function(n){let i=t[n];if(!i)return e;let r;if(arguments.length>1)r=Array.prototype.slice.call(arguments,1);for(let s=0;s<i.length;++s){let o=i[s];o.callback.apply(o.ctx,r)}return e}}}function xw(e){if(!e)throw Error("Eventify cannot use falsy object as events subject");let t=["on","fire","off"];for(let n=0;n<t.length;++n)if(e.hasOwnProperty(t[n]))throw Error("Subject cannot be eventified, since it already has property '"+t[n]+"'")}var Vg=bw;function bw(e){if(e=e||{},"uniqueLinkId"in e)console.warn("ngraph.graph: Starting from version 0.14 `uniqueLinkId` is deprecated.\nUse `multigraph` option instead\n",`
`,`Note: there is also change in default behavior: From now on each graph
is considered to be not a multigraph by default (each edge is unique).`),e.multigraph=e.uniqueLinkId;if(e.multigraph===void 0)e.multigraph=!1;if(typeof Map!=="function")throw Error("ngraph.graph requires `Map` to be defined. Please polyfill it before using ngraph");var t=new Map,n=new Map,i={},r=0,s=e.multigraph?_:S,o=[],a=z,l=z,c=z,h=z,f={version:20,addNode:y,addLink:b,removeLink:v,removeNode:d,getNode:m,getNodeCount:x,getLinkCount:w,getEdgeCount:w,getLinksCount:w,getNodesCount:x,getLinks:E,forEachNode:Q,forEachLinkedNode:R,forEachLink:W,beginUpdate:c,endUpdate:h,clear:D,hasLink:N,hasNode:m,getLink:N,getLinkById:P};return Uu(f),u(),f;function u(){var G=f.on;f.on=ee;function ee(){return f.beginUpdate=c=te,f.endUpdate=h=Y,a=p,l=g,f.on=G,G.apply(f,arguments)}}function p(G,ee){o.push({link:G,changeType:ee})}function g(G,ee){o.push({node:G,changeType:ee})}function y(G,ee){if(G===void 0)throw Error("Invalid node identifier");c();var oe=m(G);if(!oe)oe=new Sw(G,ee),l(oe,"add");else oe.data=ee,l(oe,"update");return t.set(G,oe),h(),oe}function m(G){return t.get(G)}function d(G){var ee=m(G);if(!ee)return!1;c();var oe=ee.links;if(oe)oe.forEach(A),ee.links=null;return t.delete(G),l(ee,"remove"),h(),!0}function b(G,ee,oe){c();var Ue=m(G)||y(G),Re=m(ee)||y(ee),X=s(G,ee,oe),se=n.has(X.id);if(n.set(X.id,X),Gg(Ue,X),G!==ee)Gg(Re,X);return a(X,se?"update":"add"),h(),X}function S(G,ee,oe){var Ue=Xa(G,ee),Re=n.get(Ue);if(Re)return Re.data=oe,Re;return new Hg(G,ee,oe,Ue)}function _(G,ee,oe){var Ue=Xa(G,ee),Re=i.hasOwnProperty(Ue);if(Re||N(G,ee)){if(!Re)i[Ue]=0;var X="@"+ ++i[Ue];Ue=Xa(G+X,ee+X)}return new Hg(G,ee,oe,Ue)}function x(){return t.size}function w(){return n.size}function E(G){var ee=m(G);return ee?ee.links:null}function v(G,ee){if(ee!==void 0)G=N(G,ee);return A(G)}function A(G){if(!G)return!1;if(!n.get(G.id))return!1;c(),n.delete(G.id);var ee=m(G.fromId),oe=m(G.toId);if(ee)ee.links.delete(G);if(oe)oe.links.delete(G);return a(G,"remove"),h(),!0}function N(G,ee){if(G===void 0||ee===void 0)return;return n.get(Xa(G,ee))}function P(G){if(G===void 0)return;return n.get(G)}function D(){c(),Q(function(G){d(G.id)}),h()}function W(G){if(typeof G==="function"){var ee=n.values(),oe=ee.next();while(!oe.done){if(G(oe.value))return!0;oe=ee.next()}}}function R(G,ee,oe){var Ue=m(G);if(Ue&&Ue.links&&typeof ee==="function")if(oe)return k(Ue.links,G,ee);else return I(Ue.links,G,ee)}function I(G,ee,oe){var Ue,Re=G.values(),X=Re.next();while(!X.done){var se=X.value,le=se.fromId===ee?se.toId:se.fromId;if(Ue=oe(t.get(le),se),Ue)return!0;X=Re.next()}}function k(G,ee,oe){var Ue,Re=G.values(),X=Re.next();while(!X.done){var se=X.value;if(se.fromId===ee){if(Ue=oe(t.get(se.toId),se),Ue)return!0}X=Re.next()}}function z(){}function te(){r+=1}function Y(){if(r-=1,r===0&&o.length>0)f.fire("changed",o),o.length=0}function Q(G){if(typeof G!=="function")throw Error("Function is expected to iterate over graph nodes. You passed "+G);var ee=t.values(),oe=ee.next();while(!oe.done){if(G(oe.value))return!0;oe=ee.next()}}}function Sw(e,t){this.id=e,this.links=null,this.data=t}function Gg(e,t){if(e.links)e.links.add(t);else e.links=new Set([t])}function Hg(e,t,n,i){this.fromId=e,this.toId=t,this.data=n,this.id=i}function Xa(e,t){return e.toString()+"\uD83D\uDC49 "+t.toString()}var K_=cv(S_(),1);function e1(e){var t=typeof e;return e!=null&&(t=="object"||t=="function")}var to=e1;var t1=typeof global=="object"&&global&&global.Object===Object&&global,M_=t1;var n1=typeof self=="object"&&self&&self.Object===Object&&self,i1=M_||n1||Function("return this")(),ja=i1;var r1=function(){return ja.Date.now()},Ya=r1;var s1=/\s/;function o1(e){var t=e.length;while(t--&&s1.test(e.charAt(t)));return t}var w_=o1;var a1=/^\s+/;function l1(e){return e?e.slice(0,w_(e)+1).replace(a1,""):e}var T_=l1;var c1=ja.Symbol,Yr=c1;var E_=Object.prototype,{hasOwnProperty:h1,toString:u1}=E_,no=Yr?Yr.toStringTag:void 0;function f1(e){var t=h1.call(e,no),n=e[no];try{e[no]=void 0;var i=!0}catch(s){}var r=u1.call(e);if(i)if(t)e[no]=n;else delete e[no];return r}var A_=f1;var d1=Object.prototype,p1=d1.toString;function m1(e){return p1.call(e)}var C_=m1;var g1="[object Null]",_1="[object Undefined]",R_=Yr?Yr.toStringTag:void 0;function v1(e){if(e==null)return e===void 0?_1:g1;return R_&&R_ in Object(e)?A_(e):C_(e)}var P_=v1;function y1(e){return e!=null&&typeof e=="object"}var I_=y1;var x1="[object Symbol]";function b1(e){return typeof e=="symbol"||I_(e)&&P_(e)==x1}var L_=b1;var D_=NaN,S1=/^[-+]0x[0-9a-f]+$/i,M1=/^0b[01]+$/i,w1=/^0o[0-7]+$/i,T1=parseInt;function E1(e){if(typeof e=="number")return e;if(L_(e))return D_;if(to(e)){var t=typeof e.valueOf=="function"?e.valueOf():e;e=to(t)?t+"":t}if(typeof e!="string")return e===0?e:+e;e=T_(e);var n=M1.test(e);return n||w1.test(e)?T1(e.slice(2),n?2:8):S1.test(e)?D_:+e}var Yu=E1;var A1="Expected a function",{max:C1,min:R1}=Math;function P1(e,t,n){var i,r,s,o,a,l,c=0,h=!1,f=!1,u=!0;if(typeof e!="function")throw TypeError(A1);if(t=Yu(t)||0,to(n))h=!!n.leading,f="maxWait"in n,s=f?C1(Yu(n.maxWait)||0,t):s,u="trailing"in n?!!n.trailing:u;function p(w){var E=i,v=r;return i=r=void 0,c=w,o=e.apply(v,E),o}function g(w){return c=w,a=setTimeout(d,t),h?p(w):o}function y(w){var E=w-l,v=w-c,A=t-E;return f?R1(A,s-v):A}function m(w){var E=w-l,v=w-c;return l===void 0||E>=t||E<0||f&&v>=s}function d(){var w=Ya();if(m(w))return b(w);a=setTimeout(d,y(w))}function b(w){if(a=void 0,u&&i)return p(w);return i=r=void 0,o}function S(){if(a!==void 0)clearTimeout(a);c=0,i=l=r=a=void 0}function _(){return a===void 0?o:b(Ya())}function x(){var w=Ya(),E=m(w);if(i=arguments,r=this,l=w,E){if(a===void 0)return g(l);if(f)return clearTimeout(a),a=setTimeout(d,t),p(l)}if(a===void 0)a=setTimeout(d,t);return o}return x.cancel=S,x.flush=_,x}var N_=P1;function O_(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function I1(e){if(Array.isArray(e))return e}function L1(e,t){if(!(e instanceof t))throw TypeError("Cannot call a class as a function")}function D1(e,t,n){return Object.defineProperty(e,"prototype",{writable:!1}),e}function N1(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0);else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(h){c=!0,r=h}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function O1(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function U1(e,t){return I1(e)||N1(e,t)||F1(e,t)||O1()}function F1(e,t){if(e){if(typeof e=="string")return O_(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?O_(e,t):void 0}}var B1=D1(function e(t,n){var i=n.default,r=i===void 0?null:i,s=n.triggerUpdate,o=s===void 0?!0:s,a=n.onChange,l=a===void 0?function(c,h){}:a;L1(this,e),this.name=t,this.defaultVal=r,this.triggerUpdate=o,this.onChange=l});function wi(e){var t=e.stateInit,n=t===void 0?function(){return{}}:t,i=e.props,r=i===void 0?{}:i,s=e.methods,o=s===void 0?{}:s,a=e.aliases,l=a===void 0?{}:a,c=e.init,h=c===void 0?function(){}:c,f=e.update,u=f===void 0?function(){}:f,p=Object.keys(r).map(function(g){return new B1(g,r[g])});return function g(){for(var y=arguments.length,m=Array(y),d=0;d<y;d++)m[d]=arguments[d];var b=!!(this instanceof g?this.constructor:void 0),S=b?m.shift():void 0,_=m[0],x=_===void 0?{}:_,w=Object.assign({},n instanceof Function?n(x):n,{initialised:!1}),E={};function v(P){return A(P,x),N(),v}var A=function(D,W){h.call(v,D,w,W),w.initialised=!0},N=N_(function(){if(!w.initialised)return;u.call(v,w,E),E={}},1);return p.forEach(function(P){v[P.name]=D(P);function D(W){var{name:R,triggerUpdate:I}=W,k=I===void 0?!1:I,z=W.onChange,te=z===void 0?function(G,ee){}:z,Y=W.defaultVal,Q=Y===void 0?null:Y;return function(G){var ee=w[R];if(!arguments.length)return ee;var oe=G===void 0?Q:G;if(w[R]=oe,te.call(v,oe,w,ee),!E.hasOwnProperty(R)&&(E[R]=ee),k)N();return v}}}),Object.keys(o).forEach(function(P){v[P]=function(){var D;for(var W=arguments.length,R=Array(W),I=0;I<W;I++)R[I]=arguments[I];return(D=o[P]).call.apply(D,[v,w].concat(R))}}),Object.entries(l).forEach(function(P){var D=U1(P,2),W=D[0],R=D[1];return v[W]=v[R]}),v.resetProps=function(){return p.forEach(function(P){v[P.name](P.defaultVal)}),v},v.resetProps(),w._rerender=N,b&&S&&v(S),v}}var ze=function(e){return typeof e==="function"?e:typeof e==="string"?function(t){return t[e]}:function(t){return e}};function $a(e,t){let n;if(t===void 0){for(let i of e)if(i!=null&&(n<i||n===void 0&&i>=i))n=i}else{let i=-1;for(let r of e)if((r=t(r,++i,e))!=null&&(n<r||n===void 0&&r>=r))n=r}return n}function Za(e,t){let n;if(t===void 0){for(let i of e)if(i!=null&&(n>i||n===void 0&&i>=i))n=i}else{let i=-1;for(let r of e)if((r=t(r,++i,e))!=null&&(n>r||n===void 0&&r>=r))n=r}return n}class io extends Map{constructor(e,t=G1){super();if(Object.defineProperties(this,{_intern:{value:new Map},_key:{value:t}}),e!=null)for(let[n,i]of e)this.set(n,i)}get(e){return super.get(U_(this,e))}has(e){return super.has(U_(this,e))}set(e,t){return super.set(k1(this,e),t)}delete(e){return super.delete(z1(this,e))}}function U_({_intern:e,_key:t},n){let i=t(n);return e.has(i)?e.get(i):n}function k1({_intern:e,_key:t},n){let i=t(n);if(e.has(i))return e.get(i);return e.set(i,n),n}function z1({_intern:e,_key:t},n){let i=t(n);if(e.has(i))n=e.get(i),e.delete(i);return n}function G1(e){return e!==null&&typeof e==="object"?e.valueOf():e}function Ku(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function H1(e){if(Array.isArray(e))return e}function V1(e){if(Array.isArray(e))return Ku(e)}function F_(e,t,n){if(typeof e=="function"?e===t:e.has(t))return arguments.length<3?t:n;throw TypeError("Private element is not present on this object")}function W1(e,t){if(t.has(e))throw TypeError("Cannot initialize the same private elements twice on an object")}function X1(e,t){if(!(e instanceof t))throw TypeError("Cannot call a class as a function")}function $t(e,t){return e.get(F_(e,t))}function $r(e,t,n){W1(e,t),t.set(e,n)}function Ja(e,t,n){return e.set(F_(e,t),n),n}function q1(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,tT(i.key),i)}}function j1(e,t,n){return t&&q1(e.prototype,t),Object.defineProperty(e,"prototype",{writable:!1}),e}function Y1(e){if(typeof Symbol<"u"&&e[Symbol.iterator]!=null||e["@@iterator"]!=null)return Array.from(e)}function $1(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0);else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(h){c=!0,r=h}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function Z1(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function J1(){throw TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function K1(e,t){return H1(e)||$1(e,t)||B_(e,t)||Z1()}function Q1(e){return V1(e)||Y1(e)||B_(e)||J1()}function eT(e,t){if(typeof e!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var i=n.call(e,t);if(typeof i!="object")return i;throw TypeError("@@toPrimitive must return a primitive value.")}return String(e)}function tT(e){var t=eT(e,"string");return typeof t=="symbol"?t:t+""}function B_(e,t){if(e){if(typeof e=="string")return Ku(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?Ku(e,t):void 0}}var Zr=new WeakMap,ro=new WeakMap,Jr=new WeakMap,$u=new WeakMap,Zu=new WeakMap,Ju=new WeakMap,k_=function(){function e(){X1(this,e),$r(this,Zr,new Map),$r(this,ro,new Map),$r(this,Jr,function(t){return t}),$r(this,$u,function(){return{}}),$r(this,Zu,function(){}),$r(this,Ju,function(){})}return j1(e,[{key:"getObj",value:function(n){return $t(Zr,this).get($t(Jr,this).call(this,n))}},{key:"getData",value:function(n){return $t(ro,this).get(n)}},{key:"entries",value:function(){return Q1($t(ro,this).entries()).map(function(n){var i=K1(n,2),r=i[0],s=i[1];return[s,r]})}},{key:"id",value:function(n){return Ja(Jr,this,ze(n)),this}},{key:"onCreateObj",value:function(n){return Ja($u,this,n),this}},{key:"onUpdateObj",value:function(n){return Ja(Zu,this,n),this}},{key:"onRemoveObj",value:function(n){return Ja(Ju,this,n),this}},{key:"digest",value:function(n){var i=this;n.filter(function(s){return!$t(Zr,i).has($t(Jr,i).call(i,s))}).forEach(function(s){var o=$t($u,i).call(i,s);$t(Zr,i).set($t(Jr,i).call(i,s),o),$t(ro,i).set(o,s)});var r=new Map(n.map(function(s){return[$t(Jr,i).call(i,s),s]}));return $t(Zr,this).forEach(function(s,o){if(!r.has(o))$t(Ju,i).call(i,s,o),$t(Zr,i).delete(o),$t(ro,i).delete(s);else $t(Zu,i).call(i,s,r.get(o))}),this}},{key:"clear",value:function(){return this.digest([]),this}}])}();function z_(e,t){switch(arguments.length){case 0:break;case 1:this.range(e);break;default:this.range(t).domain(e);break}return this}var Qu=Symbol("implicit");function so(){var e=new io,t=[],n=[],i=Qu;function r(s){let o=e.get(s);if(o===void 0){if(i!==Qu)return i;e.set(s,o=t.push(s)-1)}return n[o%n.length]}return r.domain=function(s){if(!arguments.length)return t.slice();t=[],e=new io;for(let o of s){if(e.has(o))continue;e.set(o,t.push(o)-1)}return r},r.range=function(s){return arguments.length?(n=Array.from(s),r):n.slice()},r.unknown=function(s){return arguments.length?(i=s,r):i},r.copy=function(){return so(t,n).unknown(i)},z_.apply(r,arguments),r}function ef(e){var t=e.length/6|0,n=Array(t),i=0;while(i<t)n[i]="#"+e.slice(i*6,++i*6);return n}var tf=ef("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928");function Ka(e){return Ka=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(t){return typeof t}:function(t){return t&&typeof Symbol=="function"&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},Ka(e)}var nT=/^\s+/,iT=/\s+$/;function Te(e,t){if(e=e?e:"",t=t||{},e instanceof Te)return e;if(!(this instanceof Te))return new Te(e,t);var n=rT(e);if(this._originalInput=e,this._r=n.r,this._g=n.g,this._b=n.b,this._a=n.a,this._roundA=Math.round(100*this._a)/100,this._format=t.format||n.format,this._gradientType=t.gradientType,this._r<1)this._r=Math.round(this._r);if(this._g<1)this._g=Math.round(this._g);if(this._b<1)this._b=Math.round(this._b);this._ok=n.ok}Te.prototype={isDark:function(){return this.getBrightness()<128},isLight:function(){return!this.isDark()},isValid:function(){return this._ok},getOriginalInput:function(){return this._originalInput},getFormat:function(){return this._format},getAlpha:function(){return this._a},getBrightness:function(){var t=this.toRgb();return(t.r*299+t.g*587+t.b*114)/1000},getLuminance:function(){var t=this.toRgb(),n,i,r,s,o,a;if(n=t.r/255,i=t.g/255,r=t.b/255,n<=0.03928)s=n/12.92;else s=Math.pow((n+0.055)/1.055,2.4);if(i<=0.03928)o=i/12.92;else o=Math.pow((i+0.055)/1.055,2.4);if(r<=0.03928)a=r/12.92;else a=Math.pow((r+0.055)/1.055,2.4);return 0.2126*s+0.7152*o+0.0722*a},setAlpha:function(t){return this._a=j_(t),this._roundA=Math.round(100*this._a)/100,this},toHsv:function(){var t=H_(this._r,this._g,this._b);return{h:t.h*360,s:t.s,v:t.v,a:this._a}},toHsvString:function(){var t=H_(this._r,this._g,this._b),n=Math.round(t.h*360),i=Math.round(t.s*100),r=Math.round(t.v*100);return this._a==1?"hsv("+n+", "+i+"%, "+r+"%)":"hsva("+n+", "+i+"%, "+r+"%, "+this._roundA+")"},toHsl:function(){var t=G_(this._r,this._g,this._b);return{h:t.h*360,s:t.s,l:t.l,a:this._a}},toHslString:function(){var t=G_(this._r,this._g,this._b),n=Math.round(t.h*360),i=Math.round(t.s*100),r=Math.round(t.l*100);return this._a==1?"hsl("+n+", "+i+"%, "+r+"%)":"hsla("+n+", "+i+"%, "+r+"%, "+this._roundA+")"},toHex:function(t){return V_(this._r,this._g,this._b,t)},toHexString:function(t){return"#"+this.toHex(t)},toHex8:function(t){return lT(this._r,this._g,this._b,this._a,t)},toHex8String:function(t){return"#"+this.toHex8(t)},toRgb:function(){return{r:Math.round(this._r),g:Math.round(this._g),b:Math.round(this._b),a:this._a}},toRgbString:function(){return this._a==1?"rgb("+Math.round(this._r)+", "+Math.round(this._g)+", "+Math.round(this._b)+")":"rgba("+Math.round(this._r)+", "+Math.round(this._g)+", "+Math.round(this._b)+", "+this._roundA+")"},toPercentageRgb:function(){return{r:Math.round(_t(this._r,255)*100)+"%",g:Math.round(_t(this._g,255)*100)+"%",b:Math.round(_t(this._b,255)*100)+"%",a:this._a}},toPercentageRgbString:function(){return this._a==1?"rgb("+Math.round(_t(this._r,255)*100)+"%, "+Math.round(_t(this._g,255)*100)+"%, "+Math.round(_t(this._b,255)*100)+"%)":"rgba("+Math.round(_t(this._r,255)*100)+"%, "+Math.round(_t(this._g,255)*100)+"%, "+Math.round(_t(this._b,255)*100)+"%, "+this._roundA+")"},toName:function(){if(this._a===0)return"transparent";if(this._a<1)return!1;return xT[V_(this._r,this._g,this._b,!0)]||!1},toFilter:function(t){var n="#"+W_(this._r,this._g,this._b,this._a),i=n,r=this._gradientType?"GradientType = 1, ":"";if(t){var s=Te(t);i="#"+W_(s._r,s._g,s._b,s._a)}return"progid:DXImageTransform.Microsoft.gradient("+r+"startColorstr="+n+",endColorstr="+i+")"},toString:function(t){var n=!!t;t=t||this._format;var i=!1,r=this._a<1&&this._a>=0,s=!n&&r&&(t==="hex"||t==="hex6"||t==="hex3"||t==="hex4"||t==="hex8"||t==="name");if(s){if(t==="name"&&this._a===0)return this.toName();return this.toRgbString()}if(t==="rgb")i=this.toRgbString();if(t==="prgb")i=this.toPercentageRgbString();if(t==="hex"||t==="hex6")i=this.toHexString();if(t==="hex3")i=this.toHexString(!0);if(t==="hex4")i=this.toHex8String(!0);if(t==="hex8")i=this.toHex8String();if(t==="name")i=this.toName();if(t==="hsl")i=this.toHslString();if(t==="hsv")i=this.toHsvString();return i||this.toHexString()},clone:function(){return Te(this.toString())},_applyModification:function(t,n){var i=t.apply(null,[this].concat([].slice.call(n)));return this._r=i._r,this._g=i._g,this._b=i._b,this.setAlpha(i._a),this},lighten:function(){return this._applyModification(fT,arguments)},brighten:function(){return this._applyModification(dT,arguments)},darken:function(){return this._applyModification(pT,arguments)},desaturate:function(){return this._applyModification(cT,arguments)},saturate:function(){return this._applyModification(hT,arguments)},greyscale:function(){return this._applyModification(uT,arguments)},spin:function(){return this._applyModification(mT,arguments)},_applyCombination:function(t,n){return t.apply(null,[this].concat([].slice.call(n)))},analogous:function(){return this._applyCombination(vT,arguments)},complement:function(){return this._applyCombination(gT,arguments)},monochromatic:function(){return this._applyCombination(yT,arguments)},splitcomplement:function(){return this._applyCombination(_T,arguments)},triad:function(){return this._applyCombination(X_,[3])},tetrad:function(){return this._applyCombination(X_,[4])}};Te.fromRatio=function(e,t){if(Ka(e)=="object"){var n={};for(var i in e)if(e.hasOwnProperty(i))if(i==="a")n[i]=e[i];else n[i]=oo(e[i]);e=n}return Te(e,t)};function rT(e){var t={r:0,g:0,b:0},n=1,i=null,r=null,s=null,o=!1,a=!1;if(typeof e=="string")e=wT(e);if(Ka(e)=="object"){if(li(e.r)&&li(e.g)&&li(e.b))t=sT(e.r,e.g,e.b),o=!0,a=String(e.r).substr(-1)==="%"?"prgb":"rgb";else if(li(e.h)&&li(e.s)&&li(e.v))i=oo(e.s),r=oo(e.v),t=aT(e.h,i,r),o=!0,a="hsv";else if(li(e.h)&&li(e.s)&&li(e.l))i=oo(e.s),s=oo(e.l),t=oT(e.h,i,s),o=!0,a="hsl";if(e.hasOwnProperty("a"))n=e.a}return n=j_(n),{ok:o,format:e.format||a,r:Math.min(255,Math.max(t.r,0)),g:Math.min(255,Math.max(t.g,0)),b:Math.min(255,Math.max(t.b,0)),a:n}}function sT(e,t,n){return{r:_t(e,255)*255,g:_t(t,255)*255,b:_t(n,255)*255}}function G_(e,t,n){e=_t(e,255),t=_t(t,255),n=_t(n,255);var i=Math.max(e,t,n),r=Math.min(e,t,n),s,o,a=(i+r)/2;if(i==r)s=o=0;else{var l=i-r;switch(o=a>0.5?l/(2-i-r):l/(i+r),i){case e:s=(t-n)/l+(t<n?6:0);break;case t:s=(n-e)/l+2;break;case n:s=(e-t)/l+4;break}s/=6}return{h:s,s:o,l:a}}function oT(e,t,n){var i,r,s;e=_t(e,360),t=_t(t,100),n=_t(n,100);function o(c,h,f){if(f<0)f+=1;if(f>1)f-=1;if(f<0.16666666666666666)return c+(h-c)*6*f;if(f<0.5)return h;if(f<0.6666666666666666)return c+(h-c)*(0.6666666666666666-f)*6;return c}if(t===0)i=r=s=n;else{var a=n<0.5?n*(1+t):n+t-n*t,l=2*n-a;i=o(l,a,e+0.3333333333333333),r=o(l,a,e),s=o(l,a,e-0.3333333333333333)}return{r:i*255,g:r*255,b:s*255}}function H_(e,t,n){e=_t(e,255),t=_t(t,255),n=_t(n,255);var i=Math.max(e,t,n),r=Math.min(e,t,n),s,o,a=i,l=i-r;if(o=i===0?0:l/i,i==r)s=0;else{switch(i){case e:s=(t-n)/l+(t<n?6:0);break;case t:s=(n-e)/l+2;break;case n:s=(e-t)/l+4;break}s/=6}return{h:s,s:o,v:a}}function aT(e,t,n){e=_t(e,360)*6,t=_t(t,100),n=_t(n,100);var i=Math.floor(e),r=e-i,s=n*(1-t),o=n*(1-r*t),a=n*(1-(1-r)*t),l=i%6,c=[n,o,s,s,a,n][l],h=[a,n,n,o,s,s][l],f=[s,s,a,n,n,o][l];return{r:c*255,g:h*255,b:f*255}}function V_(e,t,n,i){var r=[Nn(Math.round(e).toString(16)),Nn(Math.round(t).toString(16)),Nn(Math.round(n).toString(16))];if(i&&r[0].charAt(0)==r[0].charAt(1)&&r[1].charAt(0)==r[1].charAt(1)&&r[2].charAt(0)==r[2].charAt(1))return r[0].charAt(0)+r[1].charAt(0)+r[2].charAt(0);return r.join("")}function lT(e,t,n,i,r){var s=[Nn(Math.round(e).toString(16)),Nn(Math.round(t).toString(16)),Nn(Math.round(n).toString(16)),Nn(Y_(i))];if(r&&s[0].charAt(0)==s[0].charAt(1)&&s[1].charAt(0)==s[1].charAt(1)&&s[2].charAt(0)==s[2].charAt(1)&&s[3].charAt(0)==s[3].charAt(1))return s[0].charAt(0)+s[1].charAt(0)+s[2].charAt(0)+s[3].charAt(0);return s.join("")}function W_(e,t,n,i){var r=[Nn(Y_(i)),Nn(Math.round(e).toString(16)),Nn(Math.round(t).toString(16)),Nn(Math.round(n).toString(16))];return r.join("")}Te.equals=function(e,t){if(!e||!t)return!1;return Te(e).toRgbString()==Te(t).toRgbString()};Te.random=function(){return Te.fromRatio({r:Math.random(),g:Math.random(),b:Math.random()})};function cT(e,t){t=t===0?0:t||10;var n=Te(e).toHsl();return n.s-=t/100,n.s=Qa(n.s),Te(n)}function hT(e,t){t=t===0?0:t||10;var n=Te(e).toHsl();return n.s+=t/100,n.s=Qa(n.s),Te(n)}function uT(e){return Te(e).desaturate(100)}function fT(e,t){t=t===0?0:t||10;var n=Te(e).toHsl();return n.l+=t/100,n.l=Qa(n.l),Te(n)}function dT(e,t){t=t===0?0:t||10;var n=Te(e).toRgb();return n.r=Math.max(0,Math.min(255,n.r-Math.round(255*-(t/100)))),n.g=Math.max(0,Math.min(255,n.g-Math.round(255*-(t/100)))),n.b=Math.max(0,Math.min(255,n.b-Math.round(255*-(t/100)))),Te(n)}function pT(e,t){t=t===0?0:t||10;var n=Te(e).toHsl();return n.l-=t/100,n.l=Qa(n.l),Te(n)}function mT(e,t){var n=Te(e).toHsl(),i=(n.h+t)%360;return n.h=i<0?360+i:i,Te(n)}function gT(e){var t=Te(e).toHsl();return t.h=(t.h+180)%360,Te(t)}function X_(e,t){if(isNaN(t)||t<=0)throw Error("Argument to polyad must be a positive number");var n=Te(e).toHsl(),i=[Te(e)],r=360/t;for(var s=1;s<t;s++)i.push(Te({h:(n.h+s*r)%360,s:n.s,l:n.l}));return i}function _T(e){var t=Te(e).toHsl(),n=t.h;return[Te(e),Te({h:(n+72)%360,s:t.s,l:t.l}),Te({h:(n+216)%360,s:t.s,l:t.l})]}function vT(e,t,n){t=t||6,n=n||30;var i=Te(e).toHsl(),r=360/n,s=[Te(e)];for(i.h=(i.h-(r*t>>1)+720)%360;--t;)i.h=(i.h+r)%360,s.push(Te(i));return s}function yT(e,t){t=t||6;var n=Te(e).toHsv(),{h:i,s:r,v:s}=n,o=[],a=1/t;while(t--)o.push(Te({h:i,s:r,v:s})),s=(s+a)%1;return o}Te.mix=function(e,t,n){n=n===0?0:n||50;var i=Te(e).toRgb(),r=Te(t).toRgb(),s=n/100,o={r:(r.r-i.r)*s+i.r,g:(r.g-i.g)*s+i.g,b:(r.b-i.b)*s+i.b,a:(r.a-i.a)*s+i.a};return Te(o)};Te.readability=function(e,t){var n=Te(e),i=Te(t);return(Math.max(n.getLuminance(),i.getLuminance())+0.05)/(Math.min(n.getLuminance(),i.getLuminance())+0.05)};Te.isReadable=function(e,t,n){var i=Te.readability(e,t),r,s;switch(s=!1,r=TT(n),r.level+r.size){case"AAsmall":case"AAAlarge":s=i>=4.5;break;case"AAlarge":s=i>=3;break;case"AAAsmall":s=i>=7;break}return s};Te.mostReadable=function(e,t,n){var i=null,r=0,s,o,a,l;n=n||{},o=n.includeFallbackColors,a=n.level,l=n.size;for(var c=0;c<t.length;c++)if(s=Te.readability(e,t[c]),s>r)r=s,i=Te(t[c]);if(Te.isReadable(e,i,{level:a,size:l})||!o)return i;else return n.includeFallbackColors=!1,Te.mostReadable(e,["#fff","#000"],n)};var nf=Te.names={aliceblue:"f0f8ff",antiquewhite:"faebd7",aqua:"0ff",aquamarine:"7fffd4",azure:"f0ffff",beige:"f5f5dc",bisque:"ffe4c4",black:"000",blanchedalmond:"ffebcd",blue:"00f",blueviolet:"8a2be2",brown:"a52a2a",burlywood:"deb887",burntsienna:"ea7e5d",cadetblue:"5f9ea0",chartreuse:"7fff00",chocolate:"d2691e",coral:"ff7f50",cornflowerblue:"6495ed",cornsilk:"fff8dc",crimson:"dc143c",cyan:"0ff",darkblue:"00008b",darkcyan:"008b8b",darkgoldenrod:"b8860b",darkgray:"a9a9a9",darkgreen:"006400",darkgrey:"a9a9a9",darkkhaki:"bdb76b",darkmagenta:"8b008b",darkolivegreen:"556b2f",darkorange:"ff8c00",darkorchid:"9932cc",darkred:"8b0000",darksalmon:"e9967a",darkseagreen:"8fbc8f",darkslateblue:"483d8b",darkslategray:"2f4f4f",darkslategrey:"2f4f4f",darkturquoise:"00ced1",darkviolet:"9400d3",deeppink:"ff1493",deepskyblue:"00bfff",dimgray:"696969",dimgrey:"696969",dodgerblue:"1e90ff",firebrick:"b22222",floralwhite:"fffaf0",forestgreen:"228b22",fuchsia:"f0f",gainsboro:"dcdcdc",ghostwhite:"f8f8ff",gold:"ffd700",goldenrod:"daa520",gray:"808080",green:"008000",greenyellow:"adff2f",grey:"808080",honeydew:"f0fff0",hotpink:"ff69b4",indianred:"cd5c5c",indigo:"4b0082",ivory:"fffff0",khaki:"f0e68c",lavender:"e6e6fa",lavenderblush:"fff0f5",lawngreen:"7cfc00",lemonchiffon:"fffacd",lightblue:"add8e6",lightcoral:"f08080",lightcyan:"e0ffff",lightgoldenrodyellow:"fafad2",lightgray:"d3d3d3",lightgreen:"90ee90",lightgrey:"d3d3d3",lightpink:"ffb6c1",lightsalmon:"ffa07a",lightseagreen:"20b2aa",lightskyblue:"87cefa",lightslategray:"789",lightslategrey:"789",lightsteelblue:"b0c4de",lightyellow:"ffffe0",lime:"0f0",limegreen:"32cd32",linen:"faf0e6",magenta:"f0f",maroon:"800000",mediumaquamarine:"66cdaa",mediumblue:"0000cd",mediumorchid:"ba55d3",mediumpurple:"9370db",mediumseagreen:"3cb371",mediumslateblue:"7b68ee",mediumspringgreen:"00fa9a",mediumturquoise:"48d1cc",mediumvioletred:"c71585",midnightblue:"191970",mintcream:"f5fffa",mistyrose:"ffe4e1",moccasin:"ffe4b5",navajowhite:"ffdead",navy:"000080",oldlace:"fdf5e6",olive:"808000",olivedrab:"6b8e23",orange:"ffa500",orangered:"ff4500",orchid:"da70d6",palegoldenrod:"eee8aa",palegreen:"98fb98",paleturquoise:"afeeee",palevioletred:"db7093",papayawhip:"ffefd5",peachpuff:"ffdab9",peru:"cd853f",pink:"ffc0cb",plum:"dda0dd",powderblue:"b0e0e6",purple:"800080",rebeccapurple:"663399",red:"f00",rosybrown:"bc8f8f",royalblue:"4169e1",saddlebrown:"8b4513",salmon:"fa8072",sandybrown:"f4a460",seagreen:"2e8b57",seashell:"fff5ee",sienna:"a0522d",silver:"c0c0c0",skyblue:"87ceeb",slateblue:"6a5acd",slategray:"708090",slategrey:"708090",snow:"fffafa",springgreen:"00ff7f",steelblue:"4682b4",tan:"d2b48c",teal:"008080",thistle:"d8bfd8",tomato:"ff6347",turquoise:"40e0d0",violet:"ee82ee",wheat:"f5deb3",white:"fff",whitesmoke:"f5f5f5",yellow:"ff0",yellowgreen:"9acd32"},xT=Te.hexNames=bT(nf);function bT(e){var t={};for(var n in e)if(e.hasOwnProperty(n))t[e[n]]=n;return t}function j_(e){if(e=parseFloat(e),isNaN(e)||e<0||e>1)e=1;return e}function _t(e,t){if(ST(e))e="100%";var n=MT(e);if(e=Math.min(t,Math.max(0,parseFloat(e))),n)e=parseInt(e*t,10)/100;if(Math.abs(e-t)<0.000001)return 1;return e%t/parseFloat(t)}function Qa(e){return Math.min(1,Math.max(0,e))}function gn(e){return parseInt(e,16)}function ST(e){return typeof e=="string"&&e.indexOf(".")!=-1&&parseFloat(e)===1}function MT(e){return typeof e==="string"&&e.indexOf("%")!=-1}function Nn(e){return e.length==1?"0"+e:""+e}function oo(e){if(e<=1)e=e*100+"%";return e}function Y_(e){return Math.round(parseFloat(e)*255).toString(16)}function q_(e){return gn(e)/255}var Dn=function(){var e="[-\\+]?\\d+%?",t="[-\\+]?\\d*\\.\\d+%?",n="(?:"+t+")|(?:"+e+")",i="[\\s|\\(]+("+n+")[,|\\s]+("+n+")[,|\\s]+("+n+")\\s*\\)?",r="[\\s|\\(]+("+n+")[,|\\s]+("+n+")[,|\\s]+("+n+")[,|\\s]+("+n+")\\s*\\)?";return{CSS_UNIT:new RegExp(n),rgb:new RegExp("rgb"+i),rgba:new RegExp("rgba"+r),hsl:new RegExp("hsl"+i),hsla:new RegExp("hsla"+r),hsv:new RegExp("hsv"+i),hsva:new RegExp("hsva"+r),hex3:/^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,hex6:/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,hex4:/^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,hex8:/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/}}();function li(e){return!!Dn.CSS_UNIT.exec(e)}function wT(e){e=e.replace(nT,"").replace(iT,"").toLowerCase();var t=!1;if(nf[e])e=nf[e],t=!0;else if(e=="transparent")return{r:0,g:0,b:0,a:0,format:"name"};var n;if(n=Dn.rgb.exec(e))return{r:n[1],g:n[2],b:n[3]};if(n=Dn.rgba.exec(e))return{r:n[1],g:n[2],b:n[3],a:n[4]};if(n=Dn.hsl.exec(e))return{h:n[1],s:n[2],l:n[3]};if(n=Dn.hsla.exec(e))return{h:n[1],s:n[2],l:n[3],a:n[4]};if(n=Dn.hsv.exec(e))return{h:n[1],s:n[2],v:n[3]};if(n=Dn.hsva.exec(e))return{h:n[1],s:n[2],v:n[3],a:n[4]};if(n=Dn.hex8.exec(e))return{r:gn(n[1]),g:gn(n[2]),b:gn(n[3]),a:q_(n[4]),format:t?"name":"hex8"};if(n=Dn.hex6.exec(e))return{r:gn(n[1]),g:gn(n[2]),b:gn(n[3]),format:t?"name":"hex"};if(n=Dn.hex4.exec(e))return{r:gn(n[1]+""+n[1]),g:gn(n[2]+""+n[2]),b:gn(n[3]+""+n[3]),a:q_(n[4]+""+n[4]),format:t?"name":"hex8"};if(n=Dn.hex3.exec(e))return{r:gn(n[1]+""+n[1]),g:gn(n[2]+""+n[2]),b:gn(n[3]+""+n[3]),format:t?"name":"hex"};return!1}function TT(e){var t,n;if(e=e||{level:"AA",size:"small"},t=(e.level||"AA").toUpperCase(),n=(e.size||"small").toLowerCase(),t!=="AA"&&t!=="AAA")t="AA";if(n!=="small"&&n!=="large")n="small";return{level:t,size:n}}var Q_=(e)=>{if(e instanceof Array)e.forEach(Q_);else{if(e.map)e.map.dispose();e.dispose()}},of=(e)=>{if(e.geometry)e.geometry.dispose();if(e.material)Q_(e.material);if(e.texture)e.texture.dispose();if(e.children)e.children.forEach(of)},$_=(e)=>{while(e.children.length){let t=e.children[0];e.remove(t),of(t)}};class Kr extends k_{constructor(e,{dataBindAttr:t="__data",objBindAttr:n="__threeObj"}={}){super();this.scene=e,this.#t=t,this.#e=n,this.onRemoveObj(()=>{})}onCreateObj(e){return super.onCreateObj((t)=>{let n=e(t);return t[this.#e]=n,n[this.#t]=t,this.scene.add(n),n}),this}onRemoveObj(e){return super.onRemoveObj((t,n)=>{let i=super.getData(t);e(t,n),this.scene.remove(t),of(t),delete i[this.#e]}),this}scene;#t;#e}var ao=(e)=>isNaN(e)?parseInt(Te(e).toHex(),16):e,rf=(e)=>isNaN(e)?Te(e).getAlpha():1,ET=so(tf);function Z_(e,t,n){if(!t||typeof n!=="string")return;e.filter((i)=>!i[n]).forEach((i)=>{i[n]=ET(t(i))})}function AT({nodes:e,links:t},n,{nodeFilter:i=()=>!0,onLoopError:r=(s)=>{throw`Invalid DAG structure! Found cycle in node path: ${s.join(" -> ")}.`}}={}){let s={};e.forEach((c)=>s[n(c)]={data:c,out:[],depth:-1,skip:!i(c)}),t.forEach(({source:c,target:h})=>{let f=y(c),u=y(h);if(!s.hasOwnProperty(f))throw`Missing source node with id: ${f}`;if(!s.hasOwnProperty(u))throw`Missing target node with id: ${u}`;let p=s[f],g=s[u];p.out.push(g);function y(m){return typeof m==="object"?n(m):m}});let o=[];return l(Object.values(s)),Object.assign({},...Object.entries(s).filter(([,c])=>!c.skip).map(([c,h])=>({[c]:h.depth})));function l(c,h=[],f=0){for(let u=0,p=c.length;u<p;u++){let g=c[u];if(h.indexOf(g)!==-1){let y=[...h.slice(h.indexOf(g)),g].map((m)=>n(m.data));if(!o.some((m)=>m.length===y.length&&m.every((d,b)=>d===y[b])))o.push(y),r(y);continue}if(f>g.depth)g.depth=f,l(g.out,[...h,g],f+(g.skip?0:1))}}}var Ne=window.THREE?window.THREE:{Group:Qn,Mesh:zt,MeshLambertMaterial:ba,Color:Fe,BufferGeometry:It,BufferAttribute:on,Matrix4:Ke,Vector3:L,SphereGeometry:ji,CylinderGeometry:kr,TubeGeometry:ks,ConeGeometry:Us,Line:ga,LineBasicMaterial:Os,QuadraticBezierCurve3:zr,CubicBezierCurve3:Fs,Box3:In},J_={graph:Vg,forcelayout:K_.default},CT=2,sf=new Ne.BufferGeometry().setAttribute?"setAttribute":"addAttribute",el=new Ne.BufferGeometry().applyMatrix4?"applyMatrix4":"applyMatrix",RT=wi({props:{jsonUrl:{onChange:function(e,t){if(e&&!t.fetchingJson)t.fetchingJson=!0,t.onLoading(),fetch(e).then((n)=>n.json()).then((n)=>{t.fetchingJson=!1,t.onFinishLoading(n),this.graphData(n)})},triggerUpdate:!1},graphData:{default:{nodes:[],links:[]},onChange(e,t){t.engineRunning=!1}},numDimensions:{default:3,onChange(e,t){let n=t.d3ForceLayout.force("charge");if(n)n.strength(e>2?-60:-30);if(e<3)i(t.graphData.nodes,"z");if(e<2)i(t.graphData.nodes,"y");function i(r,s){r.forEach((o)=>{delete o[s],delete o[`v${s}`]})}}},dagMode:{onChange(e,t){!e&&t.forceEngine==="d3"&&(t.graphData.nodes||[]).forEach((n)=>n.fx=n.fy=n.fz=void 0)}},dagLevelDistance:{},dagNodeFilter:{default:(e)=>!0},onDagError:{triggerUpdate:!1},nodeRelSize:{default:4},nodeId:{default:"id"},nodeVal:{default:"val"},nodeResolution:{default:8},nodeColor:{default:"color"},nodeAutoColorBy:{},nodeOpacity:{default:0.75},nodeVisibility:{default:!0},nodeThreeObject:{},nodeThreeObjectExtend:{default:!1},nodePositionUpdate:{triggerUpdate:!1},linkSource:{default:"source"},linkTarget:{default:"target"},linkVisibility:{default:!0},linkColor:{default:"color"},linkAutoColorBy:{},linkOpacity:{default:0.2},linkWidth:{},linkResolution:{default:6},linkCurvature:{default:0,triggerUpdate:!1},linkCurveRotation:{default:0,triggerUpdate:!1},linkMaterial:{},linkThreeObject:{},linkThreeObjectExtend:{default:!1},linkPositionUpdate:{triggerUpdate:!1},linkDirectionalArrowLength:{default:0},linkDirectionalArrowColor:{},linkDirectionalArrowRelPos:{default:0.5,triggerUpdate:!1},linkDirectionalArrowResolution:{default:8},linkDirectionalParticles:{default:0},linkDirectionalParticleSpeed:{default:0.01,triggerUpdate:!1},linkDirectionalParticleOffset:{default:0,triggerUpdate:!1},linkDirectionalParticleWidth:{default:0.5},linkDirectionalParticleColor:{},linkDirectionalParticleResolution:{default:4},linkDirectionalParticleThreeObject:{},forceEngine:{default:"d3"},d3AlphaMin:{default:0},d3AlphaDecay:{default:0.0228,triggerUpdate:!1,onChange(e,t){t.d3ForceLayout.alphaDecay(e)}},d3AlphaTarget:{default:0,triggerUpdate:!1,onChange(e,t){t.d3ForceLayout.alphaTarget(e)}},d3VelocityDecay:{default:0.4,triggerUpdate:!1,onChange(e,t){t.d3ForceLayout.velocityDecay(e)}},ngraphPhysics:{default:{timeStep:20,gravity:-1.2,theta:0.8,springLength:30,springCoefficient:0.0008,dragCoefficient:0.02}},warmupTicks:{default:0,triggerUpdate:!1},cooldownTicks:{default:1/0,triggerUpdate:!1},cooldownTime:{default:15000,triggerUpdate:!1},onLoading:{default:()=>{},triggerUpdate:!1},onFinishLoading:{default:()=>{},triggerUpdate:!1},onUpdate:{default:()=>{},triggerUpdate:!1},onFinishUpdate:{default:()=>{},triggerUpdate:!1},onEngineTick:{default:()=>{},triggerUpdate:!1},onEngineStop:{default:()=>{},triggerUpdate:!1}},methods:{refresh:function(e){return e._flushObjects=!0,e._rerender(),this},d3Force:function(e,t,n){if(n===void 0)return e.d3ForceLayout.force(t);return e.d3ForceLayout.force(t,n),this},d3ReheatSimulation:function(e){return e.d3ForceLayout.alpha(1),this.resetCountdown(),this},resetCountdown:function(e){return e.cntTicks=0,e.startTickTime=new Date,e.engineRunning=!0,this},tickFrame:function(e){let t=e.forceEngine!=="ngraph";if(e.engineRunning&&e.layout)n();return i(),r(),this;function n(){if(++e.cntTicks>e.cooldownTicks||new Date-e.startTickTime>e.cooldownTime||t&&e.d3AlphaMin>0&&e.d3ForceLayout.alpha()<e.d3AlphaMin)e.engineRunning=!1,e.onEngineStop();else e.layout[t?"tick":"step"](),e.onEngineTick();let s=ze(e.nodeThreeObjectExtend);e.nodeDataMapper.entries().forEach(([f,u])=>{if(!u)return;let p=t?f:e.layout.getNodePosition(f[e.nodeId]),g=s(f);if(!e.nodePositionUpdate||!e.nodePositionUpdate(g?u.children[0]:u,{x:p.x,y:p.y,z:p.z},f)||g)u.position.x=p.x,u.position.y=p.y||0,u.position.z=p.z||0});let o=ze(e.linkWidth),a=ze(e.linkCurvature),l=ze(e.linkCurveRotation),c=ze(e.linkThreeObjectExtend);e.linkDataMapper.entries().forEach(([f,u])=>{if(!u)return;let p=t?f:e.layout.getLinkPosition(e.layout.graph.getLink(f.source,f.target).id),g=p[t?"source":"from"],y=p[t?"target":"to"];if(!g||!y||!g.hasOwnProperty("x")||!y.hasOwnProperty("x"))return;h(f);let m=c(f);if(e.linkPositionUpdate&&e.linkPositionUpdate(m?u.children[1]:u,{start:{x:g.x,y:g.y,z:g.z},end:{x:y.x,y:y.y,z:y.z}},f)&&!m)return;let d=30,b=f.__curve,S=u.children.length?u.children[0]:u;if(S.type==="Line"){if(!b){let _=S.geometry.getAttribute("position");if(!_||!_.array||_.array.length!==6)S.geometry[sf]("position",_=new Ne.BufferAttribute(new Float32Array(6),3));_.array[0]=g.x,_.array[1]=g.y||0,_.array[2]=g.z||0,_.array[3]=y.x,_.array[4]=y.y||0,_.array[5]=y.z||0,_.needsUpdate=!0}else{let _=b.getPoints(d);if(S.geometry.getAttribute("position").array.length!==_.length*3)S.geometry[sf]("position",new Ne.BufferAttribute(new Float32Array(_.length*3),3));S.geometry.setFromPoints(_)}S.geometry.computeBoundingSphere()}else if(S.type==="Mesh")if(!b){if(!S.geometry.type.match(/^Cylinder(Buffer)?Geometry$/)){let v=Math.ceil(o(f)*10)/10/2,A=new Ne.CylinderGeometry(v,v,1,e.linkResolution,1,!1);A[el](new Ne.Matrix4().makeTranslation(0,0.5,0)),A[el](new Ne.Matrix4().makeRotationX(Math.PI/2)),S.geometry.dispose(),S.geometry=A}let _=new Ne.Vector3(g.x,g.y||0,g.z||0),x=new Ne.Vector3(y.x,y.y||0,y.z||0),w=_.distanceTo(x);S.position.x=_.x,S.position.y=_.y,S.position.z=_.z,S.scale.z=w,S.parent.localToWorld(x),S.lookAt(x)}else{if(!S.geometry.type.match(/^Tube(Buffer)?Geometry$/))S.position.set(0,0,0),S.rotation.set(0,0,0),S.scale.set(1,1,1);let x=Math.ceil(o(f)*10)/10/2,w=new Ne.TubeGeometry(b,d,x,e.linkResolution,!1);S.geometry.dispose(),S.geometry=w}});function h(f){let u=t?f:e.layout.getLinkPosition(e.layout.graph.getLink(f.source,f.target).id),p=u[t?"source":"from"],g=u[t?"target":"to"];if(!p||!g||!p.hasOwnProperty("x")||!g.hasOwnProperty("x"))return;let y=a(f);if(!y)f.__curve=null;else{let m=new Ne.Vector3(p.x,p.y||0,p.z||0),d=new Ne.Vector3(g.x,g.y||0,g.z||0),b=m.distanceTo(d),S,_=l(f);if(b>0){let x=g.x-p.x,w=g.y-p.y||0,E=new Ne.Vector3().subVectors(d,m),v=E.clone().multiplyScalar(y).cross(x!==0||w!==0?new Ne.Vector3(0,0,1):new Ne.Vector3(0,1,0)).applyAxisAngle(E.normalize(),_).add(new Ne.Vector3().addVectors(m,d).divideScalar(2));S=new Ne.QuadraticBezierCurve3(m,v,d)}else{let x=y*70,w=-_,E=w+Math.PI/2;S=new Ne.CubicBezierCurve3(m,new Ne.Vector3(x*Math.cos(E),x*Math.sin(E),0).add(m),new Ne.Vector3(x*Math.cos(w),x*Math.sin(w),0).add(m),d)}f.__curve=S}}}function i(){let s=ze(e.linkDirectionalArrowRelPos),o=ze(e.linkDirectionalArrowLength),a=ze(e.nodeVal);e.arrowDataMapper.entries().forEach(([l,c])=>{if(!c)return;let h=t?l:e.layout.getLinkPosition(e.layout.graph.getLink(l.source,l.target).id),f=h[t?"source":"from"],u=h[t?"target":"to"];if(!f||!u||!f.hasOwnProperty("x")||!u.hasOwnProperty("x"))return;let p=Math.cbrt(Math.max(0,a(f)||1))*e.nodeRelSize,g=Math.cbrt(Math.max(0,a(u)||1))*e.nodeRelSize,y=o(l),m=s(l),d=l.__curve?(E)=>l.__curve.getPoint(E):(E)=>{let v=(A,N,P,D)=>N[A]+(P[A]-N[A])*D||0;return{x:v("x",f,u,E),y:v("y",f,u,E),z:v("z",f,u,E)}},b=l.__curve?l.__curve.getLength():Math.sqrt(["x","y","z"].map((E)=>Math.pow((u[E]||0)-(f[E]||0),2)).reduce((E,v)=>E+v,0)),S=p+y+(b-p-g-y)*m,_=d(S/b),x=d((S-y)/b);["x","y","z"].forEach((E)=>c.position[E]=x[E]);let w=new Ne.Vector3(...["x","y","z"].map((E)=>_[E]));c.parent.localToWorld(w),c.lookAt(w)})}function r(){let s=ze(e.linkDirectionalParticleSpeed),o=ze(e.linkDirectionalParticleOffset);e.graphData.links.forEach((a)=>{let l=e.particlesDataMapper.getObj(a),c=l&&l.children,h=a.__singleHopPhotonsObj&&a.__singleHopPhotonsObj.children;if((!h||!h.length)&&(!c||!c.length))return;let f=t?a:e.layout.getLinkPosition(e.layout.graph.getLink(a.source,a.target).id),u=f[t?"source":"from"],p=f[t?"target":"to"];if(!u||!p||!u.hasOwnProperty("x")||!p.hasOwnProperty("x"))return;let g=s(a),y=Math.abs(o(a)),m=a.__curve?(b)=>a.__curve.getPoint(b):(b)=>{let S=(_,x,w,E)=>x[_]+(w[_]-x[_])*E||0;return{x:S("x",u,p,b),y:S("y",u,p,b),z:S("z",u,p,b)}};[...c||[],...h||[]].forEach((b,S)=>{let _=b.parent.__linkThreeObjType==="singleHopPhotons";if(!b.hasOwnProperty("__progressRatio"))b.__progressRatio=_?g<0?1:0:(S+y)/c.length;if(b.__progressRatio+=g,b.__progressRatio>=1||b.__progressRatio<0)if(!_)b.__progressRatio=b.__progressRatio%1,b.__progressRatio<0&&b.__progressRatio++;else{b.parent.remove(b),$_(b);return}let x=b.__progressRatio,w=m(x);b.geometry.type!=="SphereGeometry"&&b.lookAt(w.x,w.y,w.z),["x","y","z"].forEach((E)=>b.position[E]=w[E])})})}},emitParticle:function(e,t){if(t&&e.graphData.links.includes(t)){if(!t.__singleHopPhotonsObj){let i=new Ne.Group;i.__linkThreeObjType="singleHopPhotons",t.__singleHopPhotonsObj=i,e.graphScene.add(i)}let n=ze(e.linkDirectionalParticleThreeObject)(t);if(n&&e.linkDirectionalParticleThreeObject===n)n=n.clone();if(!n){let i=ze(e.linkDirectionalParticleWidth),r=Math.ceil(i(t)*10)/10/2,s=e.linkDirectionalParticleResolution,o=new Ne.SphereGeometry(r,s,s),a=ze(e.linkColor),c=ze(e.linkDirectionalParticleColor)(t)||a(t)||"#f0f0f0",h=new Ne.Color(ao(c)),f=e.linkOpacity*3,u=new Ne.MeshLambertMaterial({color:h,transparent:!0,opacity:f});n=new Ne.Mesh(o,u)}t.__singleHopPhotonsObj.add(n)}return this},getGraphBbox:function(e,t=()=>!0){if(!e.initialised)return null;let n=function i(r){let s=[];if(r.geometry){r.geometry.computeBoundingBox();let o=new Ne.Box3;o.copy(r.geometry.boundingBox).applyMatrix4(r.matrixWorld),s.push(o)}return s.concat(...(r.children||[]).filter((o)=>!o.hasOwnProperty("__graphObjType")||o.__graphObjType==="node"&&t(o.__data)).map(i))}(e.graphScene);if(!n.length)return null;return Object.assign(...["x","y","z"].map((i)=>({[i]:[Za(n,(r)=>r.min[i]),$a(n,(r)=>r.max[i])]})))}},stateInit:()=>({d3ForceLayout:Ha().force("link",Oa()).force("charge",Va()).force("center",Na()).force("dagRadial",null).stop(),engineRunning:!1}),init(e,t){t.graphScene=e,t.nodeDataMapper=new Kr(e,{objBindAttr:"__threeObj"}),t.linkDataMapper=new Kr(e,{objBindAttr:"__lineObj"}),t.arrowDataMapper=new Kr(e,{objBindAttr:"__arrowObj"}),t.particlesDataMapper=new Kr(e,{objBindAttr:"__photonsObj"})},update(e,t){let n=(i)=>i.some((r)=>t.hasOwnProperty(r));if(e.engineRunning=!1,typeof e.onUpdate==="function"&&e.onUpdate(),e.nodeAutoColorBy!==null&&n(["nodeAutoColorBy","graphData","nodeColor"]))Z_(e.graphData.nodes,ze(e.nodeAutoColorBy),e.nodeColor);if(e.linkAutoColorBy!==null&&n(["linkAutoColorBy","graphData","linkColor"]))Z_(e.graphData.links,ze(e.linkAutoColorBy),e.linkColor);if(e._flushObjects||n(["graphData","nodeThreeObject","nodeThreeObjectExtend","nodeVal","nodeColor","nodeVisibility","nodeRelSize","nodeResolution","nodeOpacity"])){let i=ze(e.nodeThreeObject),r=ze(e.nodeThreeObjectExtend),s=ze(e.nodeVal),o=ze(e.nodeColor),a=ze(e.nodeVisibility),l={},c={};if(e._flushObjects||n(["nodeThreeObject","nodeThreeObjectExtend"]))e.nodeDataMapper.clear();e.nodeDataMapper.onCreateObj((h)=>{let f=i(h),u=r(h);if(f&&e.nodeThreeObject===f)f=f.clone();let p;if(f&&!u)p=f;else if(p=new Ne.Mesh,p.__graphDefaultObj=!0,f&&u)p.add(f);return p.__graphObjType="node",p}).onUpdateObj((h,f)=>{if(h.__graphDefaultObj){let u=s(f)||1,p=Math.cbrt(u)*e.nodeRelSize,g=e.nodeResolution;if(!h.geometry.type.match(/^Sphere(Buffer)?Geometry$/)||h.geometry.parameters.radius!==p||h.geometry.parameters.widthSegments!==g){if(!l.hasOwnProperty(u))l[u]=new Ne.SphereGeometry(p,g,g);h.geometry.dispose(),h.geometry=l[u]}let y=o(f),m=new Ne.Color(ao(y||"#ffffaa")),d=e.nodeOpacity*rf(y);if(h.material.type!=="MeshLambertMaterial"||!h.material.color.equals(m)||h.material.opacity!==d){if(!c.hasOwnProperty(y))c[y]=new Ne.MeshLambertMaterial({color:m,transparent:!0,opacity:d});h.material.dispose(),h.material=c[y]}}}).digest(e.graphData.nodes.filter(a))}if(e._flushObjects||n(["graphData","linkThreeObject","linkThreeObjectExtend","linkMaterial","linkColor","linkWidth","linkVisibility","linkResolution","linkOpacity","linkDirectionalArrowLength","linkDirectionalArrowColor","linkDirectionalArrowResolution","linkDirectionalParticles","linkDirectionalParticleWidth","linkDirectionalParticleColor","linkDirectionalParticleResolution","linkDirectionalParticleThreeObject"])){let i=ze(e.linkThreeObject),r=ze(e.linkThreeObjectExtend),s=ze(e.linkMaterial),o=ze(e.linkVisibility),a=ze(e.linkColor),l=ze(e.linkWidth),c={},h={},f={},u=e.graphData.links.filter(o);if(e._flushObjects||n(["linkThreeObject","linkThreeObjectExtend","linkWidth"]))e.linkDataMapper.clear();if(e.linkDataMapper.onRemoveObj((p)=>{let g=p.__data&&p.__data.__singleHopPhotonsObj;if(g)g.parent.remove(g),$_(g),delete p.__data.__singleHopPhotonsObj}).onCreateObj((p)=>{let g=i(p),y=r(p);if(g&&e.linkThreeObject===g)g=g.clone();let m;if(!g||y)if(!!l(p))m=new Ne.Mesh;else{let S=new Ne.BufferGeometry;S[sf]("position",new Ne.BufferAttribute(new Float32Array(6),3)),m=new Ne.Line(S)}let d;if(!g)d=m,d.__graphDefaultObj=!0;else if(!y)d=g;else d=new Ne.Group,d.__graphDefaultObj=!0,d.add(m),d.add(g);return d.renderOrder=10,d.__graphObjType="link",d}).onUpdateObj((p,g)=>{if(p.__graphDefaultObj){let y=p.children.length?p.children[0]:p,m=Math.ceil(l(g)*10)/10,d=!!m;if(d){let S=m/2,_=e.linkResolution;if(!y.geometry.type.match(/^Cylinder(Buffer)?Geometry$/)||y.geometry.parameters.radiusTop!==S||y.geometry.parameters.radialSegments!==_){if(!c.hasOwnProperty(m)){let x=new Ne.CylinderGeometry(S,S,1,_,1,!1);x[el](new Ne.Matrix4().makeTranslation(0,0.5,0)),x[el](new Ne.Matrix4().makeRotationX(Math.PI/2)),c[m]=x}y.geometry.dispose(),y.geometry=c[m]}}let b=s(g);if(b)y.material=b;else{let S=a(g),_=new Ne.Color(ao(S||"#f0f0f0")),x=e.linkOpacity*rf(S),w=d?"MeshLambertMaterial":"LineBasicMaterial";if(y.material.type!==w||!y.material.color.equals(_)||y.material.opacity!==x){let E=d?h:f;if(!E.hasOwnProperty(S))E[S]=new Ne[w]({color:_,transparent:x<1,opacity:x,depthWrite:x>=1});y.material.dispose(),y.material=E[S]}}}}).digest(u),e.linkDirectionalArrowLength||t.hasOwnProperty("linkDirectionalArrowLength")){let p=ze(e.linkDirectionalArrowLength),g=ze(e.linkDirectionalArrowColor);e.arrowDataMapper.onCreateObj(()=>{let y=new Ne.Mesh(void 0,new Ne.MeshLambertMaterial({transparent:!0}));return y.__linkThreeObjType="arrow",y}).onUpdateObj((y,m)=>{let d=p(m),b=e.linkDirectionalArrowResolution;if(!y.geometry.type.match(/^Cone(Buffer)?Geometry$/)||y.geometry.parameters.height!==d||y.geometry.parameters.radialSegments!==b){let _=new Ne.ConeGeometry(d*0.25,d,b);_.translate(0,d/2,0),_.rotateX(Math.PI/2),y.geometry.dispose(),y.geometry=_}let S=g(m)||a(m)||"#f0f0f0";y.material.color=new Ne.Color(ao(S)),y.material.opacity=e.linkOpacity*3*rf(S)}).digest(u.filter(p))}if(e.linkDirectionalParticles||t.hasOwnProperty("linkDirectionalParticles")){let p=ze(e.linkDirectionalParticles),g=ze(e.linkDirectionalParticleWidth),y=ze(e.linkDirectionalParticleColor),m=ze(e.linkDirectionalParticleThreeObject),d={},b={};e.particlesDataMapper.onCreateObj(()=>{let S=new Ne.Group;return S.__linkThreeObjType="photons",S.__photonDataMapper=new Kr(S),S}).onUpdateObj((S,_)=>{let x=!!S.children.length&&S.children[0],w=m(_),E,v;if(w)E=w.geometry,v=w.material;else{let N=Math.ceil(g(_)*10)/10/2,P=e.linkDirectionalParticleResolution;if(x&&x.geometry.parameters.radius===N&&x.geometry.parameters.widthSegments===P)E=x.geometry;else{if(!b.hasOwnProperty(N))b[N]=new Ne.SphereGeometry(N,P,P);E=b[N]}let D=y(_)||a(_)||"#f0f0f0",W=new Ne.Color(ao(D)),R=e.linkOpacity*3;if(x&&x.material.color.equals(W)&&x.material.opacity===R)v=x.material;else{if(!d.hasOwnProperty(D))d[D]=new Ne.MeshLambertMaterial({color:W,transparent:!0,opacity:R});v=d[D]}}if(x)x.geometry!==E&&x.geometry.dispose(),x.material!==v&&x.material.dispose();let A=Math.round(Math.abs(p(_)));S.__photonDataMapper.id((N)=>N.idx).onCreateObj(()=>new Ne.Mesh(E,v)).onUpdateObj((N)=>{N.geometry=E,N.material=v}).digest([...Array(A)].map((N,P)=>({idx:P})))}).digest(u.filter(p))}}if(e._flushObjects=!1,n(["graphData","nodeId","linkSource","linkTarget","numDimensions","forceEngine","dagMode","dagNodeFilter","dagLevelDistance"])){e.engineRunning=!1,e.graphData.links.forEach((s)=>{s.source=s[e.linkSource],s.target=s[e.linkTarget]});let i=e.forceEngine!=="ngraph",r;if(i){(r=e.d3ForceLayout).stop().alpha(1).numDimensions(e.numDimensions).nodes(e.graphData.nodes);let s=e.d3ForceLayout.force("link");if(s)s.id((c)=>c[e.nodeId]).links(e.graphData.links);let o=e.dagMode&&AT(e.graphData,(c)=>c[e.nodeId],{nodeFilter:e.dagNodeFilter,onLoopError:e.onDagError||void 0}),a=Math.max(...Object.values(o||[])),l=e.dagLevelDistance||e.graphData.nodes.length/(a||1)*CT*(["radialin","radialout"].indexOf(e.dagMode)!==-1?0.7:1);if(["lr","rl","td","bu","zin","zout"].includes(t.dagMode)){let c=["lr","rl"].includes(t.dagMode)?"fx":["td","bu"].includes(t.dagMode)?"fy":"fz";e.graphData.nodes.filter(e.dagNodeFilter).forEach((h)=>delete h[c])}if(["lr","rl","td","bu","zin","zout"].includes(e.dagMode)){let c=["rl","td","zout"].includes(e.dagMode),h=(u)=>(o[u[e.nodeId]]-a/2)*l*(c?-1:1),f=["lr","rl"].includes(e.dagMode)?"fx":["td","bu"].includes(e.dagMode)?"fy":"fz";e.graphData.nodes.filter(e.dagNodeFilter).forEach((u)=>u[f]=h(u))}e.d3ForceLayout.force("dagRadial",["radialin","radialout"].indexOf(e.dagMode)!==-1?Wa((c)=>{let h=o[c[e.nodeId]]||-1;return(e.dagMode==="radialin"?a-h:h)*l}).strength((c)=>e.dagNodeFilter(c)?1:0):null)}else{let s=J_.graph();e.graphData.nodes.forEach((o)=>{s.addNode(o[e.nodeId])}),e.graphData.links.forEach((o)=>{s.addLink(o.source,o.target)}),r=J_.forcelayout(s,{dimensions:e.numDimensions,...e.ngraphPhysics}),r.graph=s}for(let s=0;s<e.warmupTicks&&!(i&&e.d3AlphaMin>0&&e.d3ForceLayout.alpha()<e.d3AlphaMin);s++)r[i?"tick":"step"]();e.layout=r,this.resetCountdown()}e.engineRunning=!0,e.onFinishUpdate()}});function PT(e,t=Object,n=!1){class i extends t{constructor(...s){super(...s);this.__kapsuleInstance=new e(...[...n?[this]:[],...s])}}let r=e();return r._destructor?.(),Object.keys(r).forEach((s)=>i.prototype[s]=function(...o){let a=this.__kapsuleInstance[s](...o);return a===this.__kapsuleInstance?this:a}),i}var IT=window.THREE?window.THREE:{Group:Qn},af=PT(RT,IT.Group,!0);var lf={type:"change"},uf={type:"start"},ff={type:"end"},tl=0.000001,et={NONE:-1,ROTATE:0,ZOOM:1,PAN:2,TOUCH_ROTATE:3,TOUCH_ZOOM_PAN:4},nl=new re,Ti=new re,LT=new L,il=new L,cf=new L,Ei=new kt,rl=new L,sl=new L,hf=new L,ol=new L;class df extends Gn{constructor(e,t=null){super(e,t);if(this.screen={left:0,top:0,width:0,height:0},this.rotateSpeed=1,this.zoomSpeed=1.2,this.panSpeed=0.3,this.rollSpeed=1,this.noRotate=!1,this.noZoom=!1,this.noPan=!1,this.multiTouchRoll=!1,this.staticMoving=!1,this.dynamicDampingFactor=0.2,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.keys=["KeyA","KeyS","KeyD"],this.mouseButtons={LEFT:St.ROTATE,MIDDLE:St.DOLLY,RIGHT:St.PAN},this.target=new L,this.state=et.NONE,this.keyState=et.NONE,this._lastPosition=new L,this._lastUp=new L,this._lastZoom=1,this._touchZoomDistanceStart=0,this._touchZoomDistanceEnd=0,this._touchRollAngle=0,this._touchRollPointerIds="",this._lastAngle=0,this._lastRollAngle=0,this._eye=new L,this._movePrev=new re,this._moveCurr=new re,this._lastAxis=new L,this._zoomStart=new re,this._zoomEnd=new re,this._panStart=new re,this._panEnd=new re,this._pointers=[],this._pointerPositions={},this._onPointerMove=NT.bind(this),this._onPointerDown=DT.bind(this),this._onPointerUp=OT.bind(this),this._onPointerCancel=UT.bind(this),this._onContextMenu=VT.bind(this),this._onMouseWheel=HT.bind(this),this._onKeyDown=BT.bind(this),this._onKeyUp=FT.bind(this),this._onTouchStart=WT.bind(this),this._onTouchMove=XT.bind(this),this._onTouchEnd=qT.bind(this),this._onMouseDown=kT.bind(this),this._onMouseMove=zT.bind(this),this._onMouseUp=GT.bind(this),this._target0=this.target.clone(),this._position0=this.object.position.clone(),this._up0=this.object.up.clone(),this._zoom0=this.object.zoom,t!==null)this.connect(t),this.handleResize();this.update()}connect(e){super.connect(e),window.addEventListener("keydown",this._onKeyDown),window.addEventListener("keyup",this._onKeyUp),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerCancel),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="none"}disconnect(){window.removeEventListener("keydown",this._onKeyDown),window.removeEventListener("keyup",this._onKeyUp),this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerCancel),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction=""}dispose(){this.disconnect()}handleResize(){let e=this.domElement.getBoundingClientRect(),t=this.domElement.ownerDocument.documentElement;this.screen.left=e.left+window.pageXOffset-t.clientLeft,this.screen.top=e.top+window.pageYOffset-t.clientTop,this.screen.width=e.width,this.screen.height=e.height}update(){if(this._eye.subVectors(this.object.position,this.target),!this.noRotate){if(this._rotateCamera(),this.multiTouchRoll===!0)this._rollCamera()}if(!this.noZoom)this._zoomCamera();if(!this.noPan)this._panCamera();if(this.object.position.addVectors(this.target,this._eye),this.object.isPerspectiveCamera){this._checkDistances(),this.object.lookAt(this.target);let e=this._lastPosition.distanceToSquared(this.object.position)>tl,t=this._lastUp.distanceToSquared(this.object.up)>tl;if(e||t)this.dispatchEvent(lf),this._lastPosition.copy(this.object.position),this._lastUp.copy(this.object.up)}else if(this.object.isOrthographicCamera){this.object.lookAt(this.target);let e=this._lastPosition.distanceToSquared(this.object.position)>tl,t=this._lastUp.distanceToSquared(this.object.up)>tl,n=this._lastZoom!==this.object.zoom;if(e||t||n)this.dispatchEvent(lf),this._lastPosition.copy(this.object.position),this._lastUp.copy(this.object.up),this._lastZoom=this.object.zoom}else console.warn("THREE.TrackballControls: Unsupported camera type.")}reset(){this.state=et.NONE,this.keyState=et.NONE,this.target.copy(this._target0),this.object.position.copy(this._position0),this.object.up.copy(this._up0),this.object.zoom=this._zoom0,this.object.updateProjectionMatrix(),this._eye.subVectors(this.object.position,this.target),this.object.lookAt(this.target),this.dispatchEvent(lf),this._lastPosition.copy(this.object.position),this._lastUp.copy(this.object.up),this._lastZoom=this.object.zoom}_panCamera(){if(Ti.copy(this._panEnd).sub(this._panStart),Ti.lengthSq()){if(this.object.isOrthographicCamera){let e=(this.object.right-this.object.left)/this.object.zoom/this.domElement.clientWidth,t=(this.object.top-this.object.bottom)/this.object.zoom/this.domElement.clientWidth;Ti.x*=e,Ti.y*=t}if(Ti.multiplyScalar(this._eye.length()*this.panSpeed),il.copy(this._eye).cross(this.object.up).setLength(Ti.x),il.add(LT.copy(this.object.up).setLength(Ti.y)),this.object.position.add(il),this.target.add(il),this.staticMoving)this._panStart.copy(this._panEnd);else this._panStart.add(Ti.subVectors(this._panEnd,this._panStart).multiplyScalar(this.dynamicDampingFactor))}}_rotateCamera(){ol.set(this._moveCurr.x-this._movePrev.x,this._moveCurr.y-this._movePrev.y,0);let e=ol.length();if(e)this._eye.copy(this.object.position).sub(this.target),rl.copy(this._eye).normalize(),sl.copy(this.object.up).normalize(),hf.crossVectors(sl,rl).normalize(),sl.setLength(this._moveCurr.y-this._movePrev.y),hf.setLength(this._moveCurr.x-this._movePrev.x),ol.copy(sl.add(hf)),cf.crossVectors(ol,this._eye).normalize(),e*=this.rotateSpeed,Ei.setFromAxisAngle(cf,e),this._eye.applyQuaternion(Ei),this.object.up.applyQuaternion(Ei),this._lastAxis.copy(cf),this._lastAngle=e;else if(!this.staticMoving&&this._lastAngle)this._lastAngle*=Math.sqrt(1-this.dynamicDampingFactor),this._eye.copy(this.object.position).sub(this.target),Ei.setFromAxisAngle(this._lastAxis,this._lastAngle),this._eye.applyQuaternion(Ei),this.object.up.applyQuaternion(Ei);this._movePrev.copy(this._moveCurr)}_rollCamera(){let e=this._getTouchRollAngle();if(e)this._lastRollAngle=e*this.rollSpeed;else if(!this.staticMoving&&this._lastRollAngle)this._lastRollAngle*=Math.sqrt(1-this.dynamicDampingFactor);else return;rl.copy(this._eye).normalize(),Ei.setFromAxisAngle(rl,this._lastRollAngle),this.object.up.applyQuaternion(Ei)}_getTouchRollAngle(){let e=this._pointers[0],t=this._pointers[1];if(t===void 0||e.pointerType!=="touch"||t.pointerType!=="touch")return this._touchRollPointerIds="",0;let n=`${e.pointerId},${t.pointerId}`,i=this._pointerPositions[e.pointerId],r=this._pointerPositions[t.pointerId],s=Math.atan2(r.y-i.y,r.x-i.x);if(n!==this._touchRollPointerIds)return this._touchRollPointerIds=n,this._touchRollAngle=s,0;let o=s-this._touchRollAngle;if(this._touchRollAngle=s,o>Math.PI)o-=2*Math.PI;else if(o<-Math.PI)o+=2*Math.PI;return o}_zoomCamera(){let e;if(this.state===et.TOUCH_ZOOM_PAN)if(e=this._touchZoomDistanceStart/this._touchZoomDistanceEnd,this._touchZoomDistanceStart=this._touchZoomDistanceEnd,this.object.isPerspectiveCamera)this._eye.multiplyScalar(e);else if(this.object.isOrthographicCamera){if(this.object.zoom=Ur.clamp(this.object.zoom/e,this.minZoom,this.maxZoom),this._lastZoom!==this.object.zoom)this.object.updateProjectionMatrix()}else console.warn("THREE.TrackballControls: Unsupported camera type");else{if(e=1+(this._zoomEnd.y-this._zoomStart.y)*this.zoomSpeed,e!==1&&e>0)if(this.object.isPerspectiveCamera)this._eye.multiplyScalar(e);else if(this.object.isOrthographicCamera){if(this.object.zoom=Ur.clamp(this.object.zoom/e,this.minZoom,this.maxZoom),this._lastZoom!==this.object.zoom)this.object.updateProjectionMatrix()}else console.warn("THREE.TrackballControls: Unsupported camera type");if(this.staticMoving)this._zoomStart.copy(this._zoomEnd);else this._zoomStart.y+=(this._zoomEnd.y-this._zoomStart.y)*this.dynamicDampingFactor}}_getMouseOnScreen(e,t){return nl.set((e-this.screen.left)/this.screen.width,(t-this.screen.top)/this.screen.height),nl}_getMouseOnCircle(e,t){return nl.set((e-this.screen.width*0.5-this.screen.left)/(this.screen.width*0.5),(this.screen.height+2*(this.screen.top-t))/this.screen.width),nl}_addPointer(e){this._pointers.push(e)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t].pointerId==e.pointerId){this._pointers.splice(t,1);return}}_trackPointer(e){let t=this._pointerPositions[e.pointerId];if(t===void 0)t=new re,this._pointerPositions[e.pointerId]=t;t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0].pointerId?this._pointers[1]:this._pointers[0];return this._pointerPositions[t.pointerId]}_checkDistances(){if(!this.noZoom||!this.noPan){if(this._eye.lengthSq()>this.maxDistance*this.maxDistance)this.object.position.addVectors(this.target,this._eye.setLength(this.maxDistance)),this._zoomStart.copy(this._zoomEnd);if(this._eye.lengthSq()<this.minDistance*this.minDistance)this.object.position.addVectors(this.target,this._eye.setLength(this.minDistance)),this._zoomStart.copy(this._zoomEnd)}}}function DT(e){if(this.enabled===!1)return;if(this._pointers.length===0)this.domElement.setPointerCapture(e.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp);if(this._addPointer(e),e.pointerType==="touch")this._onTouchStart(e);else this._onMouseDown(e)}function NT(e){if(this.enabled===!1)return;if(e.pointerType==="touch")this._onTouchMove(e);else this._onMouseMove(e)}function OT(e){if(this.enabled===!1)return;if(e.pointerType==="touch")this._onTouchEnd(e);else this._onMouseUp();if(this._removePointer(e),this._pointers.length===0)this.domElement.releasePointerCapture(e.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp)}function UT(e){this._removePointer(e)}function FT(){if(this.enabled===!1)return;this.keyState=et.NONE,window.addEventListener("keydown",this._onKeyDown)}function BT(e){if(this.enabled===!1)return;if(window.removeEventListener("keydown",this._onKeyDown),this.keyState!==et.NONE)return;else if(e.code===this.keys[et.ROTATE]&&!this.noRotate)this.keyState=et.ROTATE;else if(e.code===this.keys[et.ZOOM]&&!this.noZoom)this.keyState=et.ZOOM;else if(e.code===this.keys[et.PAN]&&!this.noPan)this.keyState=et.PAN}function kT(e){let t;switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case St.DOLLY:this.state=et.ZOOM;break;case St.ROTATE:this.state=et.ROTATE;break;case St.PAN:this.state=et.PAN;break;default:this.state=et.NONE}let n=this.keyState!==et.NONE?this.keyState:this.state;if(n===et.ROTATE&&!this.noRotate)this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY)),this._movePrev.copy(this._moveCurr);else if(n===et.ZOOM&&!this.noZoom)this._zoomStart.copy(this._getMouseOnScreen(e.pageX,e.pageY)),this._zoomEnd.copy(this._zoomStart);else if(n===et.PAN&&!this.noPan)this._panStart.copy(this._getMouseOnScreen(e.pageX,e.pageY)),this._panEnd.copy(this._panStart);this.dispatchEvent(uf)}function zT(e){let t=this.keyState!==et.NONE?this.keyState:this.state;if(t===et.ROTATE&&!this.noRotate)this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY));else if(t===et.ZOOM&&!this.noZoom)this._zoomEnd.copy(this._getMouseOnScreen(e.pageX,e.pageY));else if(t===et.PAN&&!this.noPan)this._panEnd.copy(this._getMouseOnScreen(e.pageX,e.pageY))}function GT(){this.state=et.NONE,this.dispatchEvent(ff)}function HT(e){if(this.enabled===!1)return;if(this.noZoom===!0)return;switch(e.preventDefault(),e.deltaMode){case 2:this._zoomStart.y-=e.deltaY*0.025;break;case 1:this._zoomStart.y-=e.deltaY*0.01;break;default:this._zoomStart.y-=e.deltaY*0.00025;break}this.dispatchEvent(uf),this.dispatchEvent(ff)}function VT(e){if(this.enabled===!1)return;e.preventDefault()}function WT(e){switch(this._trackPointer(e),this._pointers.length){case 1:this.state=et.TOUCH_ROTATE,this._moveCurr.copy(this._getMouseOnCircle(this._pointers[0].pageX,this._pointers[0].pageY)),this._movePrev.copy(this._moveCurr);break;default:this.state=et.TOUCH_ZOOM_PAN;let t=this._pointers[0].pageX-this._pointers[1].pageX,n=this._pointers[0].pageY-this._pointers[1].pageY;this._touchZoomDistanceEnd=this._touchZoomDistanceStart=Math.sqrt(t*t+n*n);let i=(this._pointers[0].pageX+this._pointers[1].pageX)/2,r=(this._pointers[0].pageY+this._pointers[1].pageY)/2;this._panStart.copy(this._getMouseOnScreen(i,r)),this._panEnd.copy(this._panStart);break}this.dispatchEvent(uf)}function XT(e){switch(this._trackPointer(e),this._pointers.length){case 1:this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY));break;default:let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y;this._touchZoomDistanceEnd=Math.sqrt(n*n+i*i);let r=(e.pageX+t.x)/2,s=(e.pageY+t.y)/2;this._panEnd.copy(this._getMouseOnScreen(r,s));break}}function qT(e){switch(this._pointers.length){case 0:this.state=et.NONE;break;case 1:this.state=et.TOUCH_ROTATE,this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY)),this._movePrev.copy(this._moveCurr);break;case 2:this.state=et.TOUCH_ZOOM_PAN;for(let t=0;t<this._pointers.length;t++)if(this._pointers[t].pointerId!==e.pointerId){let n=this._pointerPositions[this._pointers[t].pointerId];this._moveCurr.copy(this._getMouseOnCircle(n.x,n.y)),this._movePrev.copy(this._moveCurr);break}break}this.dispatchEvent(ff)}var e0={type:"change"},mf={type:"start"},n0={type:"end"},al=new Xi,t0=new sn,jT=Math.cos(70*Ur.DEG2RAD),Ot=new L,cn=2*Math.PI,lt={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},pf=0.000001;class gf extends Gn{constructor(e,t=null){super(e,t);if(this.state=lt.NONE,this.target=new L,this.cursor=new L,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=0.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:St.ROTATE,MIDDLE:St.DOLLY,RIGHT:St.PAN},this.touches={ONE:xn.ROTATE,TWO:xn.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new L,this._lastQuaternion=new kt,this._lastTargetPosition=new L,this._quat=new kt().setFromUnitVectors(e.up,new L(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Hs,this._sphericalDelta=new Hs,this._scale=1,this._panOffset=new L,this._rotateStart=new re,this._rotateEnd=new re,this._rotateDelta=new re,this._panStart=new re,this._panEnd=new re,this._panDelta=new re,this._dollyStart=new re,this._dollyEnd=new re,this._dollyDelta=new re,this._dollyDirection=new L,this._mouse=new re,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=$T.bind(this),this._onPointerDown=YT.bind(this),this._onPointerUp=ZT.bind(this),this._onContextMenu=iE.bind(this),this._onMouseWheel=QT.bind(this),this._onKeyDown=eE.bind(this),this._onTouchStart=tE.bind(this),this._onTouchMove=nE.bind(this),this._onMouseDown=JT.bind(this),this._onMouseMove=KT.bind(this),this._interceptControlDown=rE.bind(this),this._interceptControlUp=sE.bind(this),this.domElement!==null)this.connect(this.domElement);this.update()}set cursorStyle(e){if(this._cursorStyle=e,e==="grab")this.domElement.style.cursor="grab";else this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=lt.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents();let e=this.domElement.getRootNode();e.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),e.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){if(this._domElementKeyEvents!==null)this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(e0),this.update(),this.state=lt.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;if(Ot.copy(t).sub(this.target),Ot.applyQuaternion(this._quat),this._spherical.setFromVector3(Ot),this.autoRotate&&this.state===lt.NONE)this._rotateLeft(this._getAutoRotationAngle(e));if(this.enableDamping)this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor;else this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi;let n=this.minAzimuthAngle,i=this.maxAzimuthAngle;if(isFinite(n)&&isFinite(i)){if(n<-Math.PI)n+=cn;else if(n>Math.PI)n-=cn;if(i<-Math.PI)i+=cn;else if(i>Math.PI)i-=cn;if(n<=i)this._spherical.theta=Math.max(n,Math.min(i,this._spherical.theta));else this._spherical.theta=this._spherical.theta>(n+i)/2?Math.max(n,this._spherical.theta):Math.min(i,this._spherical.theta)}if(this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0)this.target.addScaledVector(this._panOffset,this.dampingFactor);else this.target.add(this._panOffset);this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let s=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=s!=this._spherical.radius}if(Ot.setFromSpherical(this._spherical),Ot.applyQuaternion(this._quatInverse),t.copy(this.target).add(Ot),this.object.lookAt(this.target),this.enableDamping===!0)this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor);else this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0);if(this.zoomToCursor&&this._performCursorZoom){let s=null;if(this.object.isPerspectiveCamera){let o=Ot.length();s=this._clampDistance(o*this._scale);let a=o-s;this.object.position.addScaledVector(this._dollyDirection,a),this.object.updateMatrixWorld(),r=!!a}else if(this.object.isOrthographicCamera){let o=new L(this._mouse.x,this._mouse.y,0);o.unproject(this.object);let a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=a!==this.object.zoom;let l=new L(this._mouse.x,this._mouse.y,0);l.unproject(this.object),this.object.position.sub(l).add(o),this.object.updateMatrixWorld(),s=Ot.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;if(s!==null)if(this.screenSpacePanning)this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(s).add(this.object.position);else if(al.origin.copy(this.object.position),al.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(al.direction))<jT)this.object.lookAt(this.target);else t0.setFromNormalAndCoplanarPoint(this.object.up,this.target),al.intersectPlane(t0,this.target)}else if(this.object.isOrthographicCamera){let s=this.object.zoom;if(this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),s!==this.object.zoom)this.object.updateProjectionMatrix(),r=!0}if(this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>pf||8*(1-this._lastQuaternion.dot(this.object.quaternion))>pf||this._lastTargetPosition.distanceToSquared(this.target)>pf)return this.dispatchEvent(e0),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0;return!1}_getAutoRotationAngle(e){if(e!==null)return cn/60*this.autoRotateSpeed*e;else return cn/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*0.01);return Math.pow(0.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Ot.setFromMatrixColumn(t,0),Ot.multiplyScalar(-e),this._panOffset.add(Ot)}_panUp(e,t){if(this.screenSpacePanning===!0)Ot.setFromMatrixColumn(t,1);else Ot.setFromMatrixColumn(t,0),Ot.crossVectors(this.object.up,Ot);Ot.multiplyScalar(e),this._panOffset.add(Ot)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let i=this.object.position;Ot.copy(i).sub(this.target);let r=Ot.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/n.clientHeight,this.object.matrix),this._panUp(2*t*r/n.clientHeight,this.object.matrix)}else if(this.object.isOrthographicCamera)this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix);else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1}_dollyOut(e){if(this.object.isPerspectiveCamera||this.object.isOrthographicCamera)this._scale/=e;else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1}_dollyIn(e){if(this.object.isPerspectiveCamera||this.object.isOrthographicCamera)this._scale*=e;else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),i=e-n.left,r=t-n.top,{width:s,height:o}=n;this._mouse.x=i/s*2-1,this._mouse.y=-(r/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(cn*this._rotateDelta.x/t.clientHeight),this._rotateUp(cn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){if(this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0)this._dollyOut(this._getZoomScale(this._dollyDelta.y));else if(this._dollyDelta.y<0)this._dollyIn(this._getZoomScale(this._dollyDelta.y));this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){if(this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0)this._dollyIn(this._getZoomScale(e.deltaY));else if(e.deltaY>0)this._dollyOut(this._getZoomScale(e.deltaY));this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateUp(cn*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(0,this.keyPanSpeed);t=!0;break;case this.keys.BOTTOM:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateUp(-cn*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(0,-this.keyPanSpeed);t=!0;break;case this.keys.LEFT:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateLeft(cn*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(this.keyPanSpeed,0);t=!0;break;case this.keys.RIGHT:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateLeft(-cn*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(-this.keyPanSpeed,0);t=!0;break}if(t)e.preventDefault(),this.update()}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=0.5*(e.pageX+t.x),i=0.5*(e.pageY+t.y);this._rotateStart.set(n,i)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=0.5*(e.pageX+t.x),i=0.5*(e.pageY+t.y);this._panStart.set(n,i)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y,r=Math.sqrt(n*n+i*i);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){if(this.enableZoom)this._handleTouchStartDolly(e);if(this.enablePan)this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){if(this.enableZoom)this._handleTouchStartDolly(e);if(this.enableRotate)this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let n=this._getSecondPointerPosition(e),i=0.5*(e.pageX+n.x),r=0.5*(e.pageY+n.y);this._rotateEnd.set(i,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(cn*this._rotateDelta.x/t.clientHeight),this._rotateUp(cn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=0.5*(e.pageX+t.x),i=0.5*(e.pageY+t.y);this._panEnd.set(n,i)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y,r=Math.sqrt(n*n+i*i);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let s=(e.pageX+t.x)*0.5,o=(e.pageY+t.y)*0.5;this._updateZoomParameters(s,o)}_handleTouchMoveDollyPan(e){if(this.enableZoom)this._handleTouchMoveDolly(e);if(this.enablePan)this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){if(this.enableZoom)this._handleTouchMoveDolly(e);if(this.enableRotate)this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];if(t===void 0)t=new re,this._pointerPositions[e.pointerId]=t;t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}if(e.ctrlKey&&!this._controlActive)n.deltaY*=10;return n}}function YT(e){if(this.enabled===!1)return;if(this._pointers.length===0)this.domElement.setPointerCapture(e.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp);if(this._isTrackingPointer(e))return;if(this._addPointer(e),e.pointerType==="touch")this._onTouchStart(e);else this._onMouseDown(e);if(this._cursorStyle==="grab")this.domElement.style.cursor="grabbing"}function $T(e){if(this.enabled===!1)return;if(e.pointerType==="touch")this._onTouchMove(e);else this._onMouseMove(e)}function ZT(e){switch(this._removePointer(e),this._pointers.length){case 0:if(this.domElement.releasePointerCapture(e.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(n0),this.state=lt.NONE,this._cursorStyle==="grab")this.domElement.style.cursor="grab";break;case 1:let t=this._pointers[0],n=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:n.x,pageY:n.y});break}}function JT(e){let t;switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case St.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(e),this.state=lt.DOLLY;break;case St.ROTATE:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=lt.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=lt.ROTATE}break;case St.PAN:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=lt.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=lt.PAN}break;default:this.state=lt.NONE}if(this.state!==lt.NONE)this.dispatchEvent(mf)}function KT(e){switch(this.state){case lt.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(e);break;case lt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(e);break;case lt.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(e);break}}function QT(e){if(this.enabled===!1||this.enableZoom===!1||this.state!==lt.NONE)return;e.preventDefault(),this.dispatchEvent(mf),this._handleMouseWheel(this._customWheelEvent(e)),this.dispatchEvent(n0)}function eE(e){if(this.enabled===!1)return;this._handleKeyDown(e)}function tE(e){switch(this._trackPointer(e),this._pointers.length){case 1:switch(this.touches.ONE){case xn.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(e),this.state=lt.TOUCH_ROTATE;break;case xn.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(e),this.state=lt.TOUCH_PAN;break;default:this.state=lt.NONE}break;case 2:switch(this.touches.TWO){case xn.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(e),this.state=lt.TOUCH_DOLLY_PAN;break;case xn.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(e),this.state=lt.TOUCH_DOLLY_ROTATE;break;default:this.state=lt.NONE}break;default:this.state=lt.NONE}if(this.state!==lt.NONE)this.dispatchEvent(mf)}function nE(e){switch(this._trackPointer(e),this.state){case lt.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(e),this.update();break;case lt.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(e),this.update();break;case lt.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(e),this.update();break;case lt.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(e),this.update();break;default:this.state=lt.NONE}}function iE(e){if(this.enabled===!1)return;e.preventDefault()}function rE(e){if(e.key==="Control")this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0})}function sE(e){if(e.key==="Control")this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0})}var oE={type:"change"},i0=0.000001,r0=new kt;class _f extends Gn{constructor(e,t=null){super(e,t);if(this.movementSpeed=1,this.rollSpeed=0.005,this.dragToLook=!1,this.autoForward=!1,this._moveState={up:0,down:0,left:0,right:0,forward:0,back:0,pitchUp:0,pitchDown:0,yawLeft:0,yawRight:0,rollLeft:0,rollRight:0},this._moveVector=new L(0,0,0),this._rotationVector=new L(0,0,0),this._lastQuaternion=new kt,this._lastPosition=new L,this._status=0,this._onKeyDown=aE.bind(this),this._onKeyUp=lE.bind(this),this._onPointerMove=hE.bind(this),this._onPointerDown=cE.bind(this),this._onPointerUp=uE.bind(this),this._onPointerCancel=fE.bind(this),this._onContextMenu=dE.bind(this),t!==null)this.connect(t)}connect(e){super.connect(e),window.addEventListener("keydown",this._onKeyDown),window.addEventListener("keyup",this._onKeyUp),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointerup",this._onPointerUp),this.domElement.addEventListener("pointercancel",this._onPointerCancel),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="none"}disconnect(){window.removeEventListener("keydown",this._onKeyDown),window.removeEventListener("keyup",this._onKeyUp),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerCancel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction=""}dispose(){this.disconnect()}update(e){if(this.enabled===!1)return;let t=this.object,n=e*this.movementSpeed,i=e*this.rollSpeed;if(t.translateX(this._moveVector.x*n),t.translateY(this._moveVector.y*n),t.translateZ(this._moveVector.z*n),r0.set(this._rotationVector.x*i,this._rotationVector.y*i,this._rotationVector.z*i,1).normalize(),t.quaternion.multiply(r0),this._lastPosition.distanceToSquared(t.position)>i0||8*(1-this._lastQuaternion.dot(t.quaternion))>i0)this.dispatchEvent(oE),this._lastQuaternion.copy(t.quaternion),this._lastPosition.copy(t.position)}_updateMovementVector(){let e=this._moveState.forward||this.autoForward&&!this._moveState.back?1:0;this._moveVector.x=-this._moveState.left+this._moveState.right,this._moveVector.y=-this._moveState.down+this._moveState.up,this._moveVector.z=-e+this._moveState.back}_updateRotationVector(){this._rotationVector.x=-this._moveState.pitchDown+this._moveState.pitchUp,this._rotationVector.y=-this._moveState.yawRight+this._moveState.yawLeft,this._rotationVector.z=-this._moveState.rollRight+this._moveState.rollLeft}_getContainerDimensions(){if(this.domElement!=document)return{size:[this.domElement.offsetWidth,this.domElement.offsetHeight],offset:[this.domElement.offsetLeft,this.domElement.offsetTop]};else return{size:[window.innerWidth,window.innerHeight],offset:[0,0]}}}function aE(e){if(e.altKey||this.enabled===!1)return;switch(e.code){case"ShiftLeft":case"ShiftRight":this.movementSpeedMultiplier=0.1;break;case"KeyW":this._moveState.forward=1;break;case"KeyS":this._moveState.back=1;break;case"KeyA":this._moveState.left=1;break;case"KeyD":this._moveState.right=1;break;case"KeyR":this._moveState.up=1;break;case"KeyF":this._moveState.down=1;break;case"ArrowUp":this._moveState.pitchUp=1;break;case"ArrowDown":this._moveState.pitchDown=1;break;case"ArrowLeft":this._moveState.yawLeft=1;break;case"ArrowRight":this._moveState.yawRight=1;break;case"KeyQ":this._moveState.rollLeft=1;break;case"KeyE":this._moveState.rollRight=1;break}this._updateMovementVector(),this._updateRotationVector()}function lE(e){if(this.enabled===!1)return;switch(e.code){case"ShiftLeft":case"ShiftRight":this.movementSpeedMultiplier=1;break;case"KeyW":this._moveState.forward=0;break;case"KeyS":this._moveState.back=0;break;case"KeyA":this._moveState.left=0;break;case"KeyD":this._moveState.right=0;break;case"KeyR":this._moveState.up=0;break;case"KeyF":this._moveState.down=0;break;case"ArrowUp":this._moveState.pitchUp=0;break;case"ArrowDown":this._moveState.pitchDown=0;break;case"ArrowLeft":this._moveState.yawLeft=0;break;case"ArrowRight":this._moveState.yawRight=0;break;case"KeyQ":this._moveState.rollLeft=0;break;case"KeyE":this._moveState.rollRight=0;break}this._updateMovementVector(),this._updateRotationVector()}function cE(e){if(this.enabled===!1)return;if(this.dragToLook)this._status++;else{switch(e.button){case 0:this._moveState.forward=1;break;case 2:this._moveState.back=1;break}this._updateMovementVector()}}function hE(e){if(this.enabled===!1)return;if(!this.dragToLook||this._status>0){let t=this._getContainerDimensions(),n=t.size[0]/2,i=t.size[1]/2;this._moveState.yawLeft=-(e.pageX-t.offset[0]-n)/n,this._moveState.pitchDown=(e.pageY-t.offset[1]-i)/i,this._updateRotationVector()}}function uE(e){if(this.enabled===!1)return;if(this.dragToLook)this._status--,this._moveState.yawLeft=this._moveState.pitchDown=0;else{switch(e.button){case 0:this._moveState.forward=0;break;case 2:this._moveState.back=0;break}this._updateMovementVector()}this._updateRotationVector()}function fE(){if(this.enabled===!1)return;if(this.dragToLook)this._status=0,this._moveState.yawLeft=this._moveState.pitchDown=0;else this._moveState.forward=0,this._moveState.back=0,this._updateMovementVector();this._updateRotationVector()}function dE(e){if(this.enabled===!1)return;e.preventDefault()}var Qr={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};class wn{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}var pE=new Ki(-1,1,1,-1,0,1);class s0 extends It{constructor(){super();this.setAttribute("position",new mt([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new mt([0,2,0,0,2,0],2))}}var mE=new s0;class ir{constructor(e){this._mesh=new zt(mE,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,pE)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class vf extends wn{constructor(e,t="tDiffuse"){super();if(this.textureID=t,this.uniforms=null,this.material=null,e instanceof Tt)this.uniforms=e.uniforms,this.material=e;else if(e)this.uniforms=si.clone(e.uniforms),this.material=new Tt({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader});this._fsQuad=new ir(this.material)}render(e,t,n){if(this.uniforms[this.textureID])this.uniforms[this.textureID].value=n.texture;if(this._fsQuad.material=this.material,this.renderToScreen)e.setRenderTarget(null),this._fsQuad.render(e);else{if(e.setRenderTarget(t),this.clear)e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil);this._fsQuad.render(e)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class ll extends wn{constructor(e,t){super();this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let i=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let s,o;if(this.inverse)s=0,o=1;else s=1,o=0;if(r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(i.REPLACE,i.REPLACE,i.REPLACE),r.buffers.stencil.setFunc(i.ALWAYS,s,4294967295),r.buffers.stencil.setClear(o),r.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear)e.clear();if(e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear)e.clear();e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(i.EQUAL,1,4294967295),r.buffers.stencil.setOp(i.KEEP,i.KEEP,i.KEEP),r.buffers.stencil.setLocked(!0)}}class yf extends wn{constructor(){super();this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class cl{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new re);this._width=n.width,this._height=n.height,t=new Pt(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:qt}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new vf(Qr),this.copyPass.material.blending=bn,this.timer=new Gr}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);if(t!==-1)this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){if(this.timer.update(),e===void 0)e=this.timer.getDelta();let t=this.renderer.getRenderTarget(),n=!1;for(let i=0,r=this.passes.length;i<r;i++){let s=this.passes[i];if(s.enabled===!1)continue;if(s.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i),s.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),s.needsSwap){if(n){let o=this.renderer.getContext(),a=this.renderer.state.buffers.stencil;a.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),a.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}if(ll!==void 0){if(s instanceof ll)n=!0;else if(s instanceof yf)n=!1}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new re);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(n,i),this.renderTarget2.setSize(n,i);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(n,i)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class hl extends wn{constructor(e,t,n=null,i=null,r=null){super();this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=i,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new Fe}render(e,t,n){let i=e.autoClear;e.autoClear=!1;let r,s;if(this.overrideMaterial!==null)s=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial;if(this.clearColor!==null)e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha());if(this.clearAlpha!==null)r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha);if(this.clearDepth==!0)e.clearDepth();if(e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0)e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil);if(e.render(this.scene,this.camera),this.clearColor!==null)e.setClearColor(this._oldClearColor);if(this.clearAlpha!==null)e.setClearAlpha(r);if(this.overrideMaterial!==null)this.scene.overrideMaterial=s;e.autoClear=i}}function en(){return en=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var i in n)({}).hasOwnProperty.call(n,i)&&(e[i]=n[i])}return e},en.apply(null,arguments)}function o0(e){if(e===void 0)throw ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function Ai(e,t){return Ai=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(n,i){return n.__proto__=i,n},Ai(e,t)}function a0(e,t){e.prototype=Object.create(t.prototype),e.prototype.constructor=e,Ai(e,t)}function ul(e){return ul=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(t){return t.__proto__||Object.getPrototypeOf(t)},ul(e)}function l0(e){try{return Function.toString.call(e).indexOf("[native code]")!==-1}catch(t){return typeof e=="function"}}function xf(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],function(){}))}catch(t){}return(xf=function(){return!!e})()}function c0(e,t,n){if(xf())return Reflect.construct.apply(null,arguments);var i=[null];i.push.apply(i,t);var r=new(e.bind.apply(e,i));return n&&Ai(r,n.prototype),r}function fl(e){var t=typeof Map=="function"?new Map:void 0;return fl=function(i){if(i===null||!l0(i))return i;if(typeof i!="function")throw TypeError("Super expression must either be null or a function");if(t!==void 0){if(t.has(i))return t.get(i);t.set(i,r)}function r(){return c0(i,arguments,ul(this).constructor)}return r.prototype=Object.create(i.prototype,{constructor:{value:r,enumerable:!1,writable:!0,configurable:!0}}),Ai(r,i)},fl(e)}var gE={"1":`Passed invalid arguments to hsl, please pass multiple numbers e.g. hsl(360, 0.75, 0.4) or an object e.g. rgb({ hue: 255, saturation: 0.4, lightness: 0.75 }).

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
`};function _E(){for(var e=arguments.length,t=Array(e),n=0;n<e;n++)t[n]=arguments[n];var i=t[0],r=[],s;for(s=1;s<t.length;s+=1)r.push(t[s]);return r.forEach(function(o){i=i.replace(/%[a-z]/,o)}),i}var hn=function(e){a0(t,e);function t(n){var i;for(var r=arguments.length,s=Array(r>1?r-1:0),o=1;o<r;o++)s[o-1]=arguments[o];return i=e.call(this,_E.apply(void 0,[gE[n]].concat(s)))||this,o0(i)}return t}(fl(Error));function h0(e,t){return e.substr(-t.length)===t}var vE=/^([+-]?(?:\d+|\d*\.\d+))([a-z]*|%)$/;function u0(e){if(typeof e!=="string")return e;var t=e.match(vE);return t?parseFloat(e):e}var yE=function(t){return function(n,i){if(i===void 0)i="16px";var r=n,s=i;if(typeof n==="string"){if(!h0(n,"px"))throw new hn(69,t,n);r=u0(n)}if(typeof i==="string"){if(!h0(i,"px"))throw new hn(70,t,i);s=u0(i)}if(typeof r==="string")throw new hn(71,n,t);if(typeof s==="string")throw new hn(72,i,t);return""+r/s+t}},d0=yE,Az=d0("em");var Cz=d0("rem");function bf(e){return Math.round(e*255)}function xE(e,t,n){return bf(e)+","+bf(t)+","+bf(n)}function lo(e,t,n,i){if(i===void 0)i=xE;if(t===0)return i(n,n,n);var r=(e%360+360)%360/60,s=(1-Math.abs(2*n-1))*t,o=s*(1-Math.abs(r%2-1)),a=0,l=0,c=0;if(r>=0&&r<1)a=s,l=o;else if(r>=1&&r<2)a=o,l=s;else if(r>=2&&r<3)l=s,c=o;else if(r>=3&&r<4)l=o,c=s;else if(r>=4&&r<5)a=o,c=s;else if(r>=5&&r<6)a=s,c=o;var h=n-s/2,f=a+h,u=l+h,p=c+h;return i(f,u,p)}var f0={aliceblue:"f0f8ff",antiquewhite:"faebd7",aqua:"00ffff",aquamarine:"7fffd4",azure:"f0ffff",beige:"f5f5dc",bisque:"ffe4c4",black:"000",blanchedalmond:"ffebcd",blue:"0000ff",blueviolet:"8a2be2",brown:"a52a2a",burlywood:"deb887",cadetblue:"5f9ea0",chartreuse:"7fff00",chocolate:"d2691e",coral:"ff7f50",cornflowerblue:"6495ed",cornsilk:"fff8dc",crimson:"dc143c",cyan:"00ffff",darkblue:"00008b",darkcyan:"008b8b",darkgoldenrod:"b8860b",darkgray:"a9a9a9",darkgreen:"006400",darkgrey:"a9a9a9",darkkhaki:"bdb76b",darkmagenta:"8b008b",darkolivegreen:"556b2f",darkorange:"ff8c00",darkorchid:"9932cc",darkred:"8b0000",darksalmon:"e9967a",darkseagreen:"8fbc8f",darkslateblue:"483d8b",darkslategray:"2f4f4f",darkslategrey:"2f4f4f",darkturquoise:"00ced1",darkviolet:"9400d3",deeppink:"ff1493",deepskyblue:"00bfff",dimgray:"696969",dimgrey:"696969",dodgerblue:"1e90ff",firebrick:"b22222",floralwhite:"fffaf0",forestgreen:"228b22",fuchsia:"ff00ff",gainsboro:"dcdcdc",ghostwhite:"f8f8ff",gold:"ffd700",goldenrod:"daa520",gray:"808080",green:"008000",greenyellow:"adff2f",grey:"808080",honeydew:"f0fff0",hotpink:"ff69b4",indianred:"cd5c5c",indigo:"4b0082",ivory:"fffff0",khaki:"f0e68c",lavender:"e6e6fa",lavenderblush:"fff0f5",lawngreen:"7cfc00",lemonchiffon:"fffacd",lightblue:"add8e6",lightcoral:"f08080",lightcyan:"e0ffff",lightgoldenrodyellow:"fafad2",lightgray:"d3d3d3",lightgreen:"90ee90",lightgrey:"d3d3d3",lightpink:"ffb6c1",lightsalmon:"ffa07a",lightseagreen:"20b2aa",lightskyblue:"87cefa",lightslategray:"789",lightslategrey:"789",lightsteelblue:"b0c4de",lightyellow:"ffffe0",lime:"0f0",limegreen:"32cd32",linen:"faf0e6",magenta:"f0f",maroon:"800000",mediumaquamarine:"66cdaa",mediumblue:"0000cd",mediumorchid:"ba55d3",mediumpurple:"9370db",mediumseagreen:"3cb371",mediumslateblue:"7b68ee",mediumspringgreen:"00fa9a",mediumturquoise:"48d1cc",mediumvioletred:"c71585",midnightblue:"191970",mintcream:"f5fffa",mistyrose:"ffe4e1",moccasin:"ffe4b5",navajowhite:"ffdead",navy:"000080",oldlace:"fdf5e6",olive:"808000",olivedrab:"6b8e23",orange:"ffa500",orangered:"ff4500",orchid:"da70d6",palegoldenrod:"eee8aa",palegreen:"98fb98",paleturquoise:"afeeee",palevioletred:"db7093",papayawhip:"ffefd5",peachpuff:"ffdab9",peru:"cd853f",pink:"ffc0cb",plum:"dda0dd",powderblue:"b0e0e6",purple:"800080",rebeccapurple:"639",red:"f00",rosybrown:"bc8f8f",royalblue:"4169e1",saddlebrown:"8b4513",salmon:"fa8072",sandybrown:"f4a460",seagreen:"2e8b57",seashell:"fff5ee",sienna:"a0522d",silver:"c0c0c0",skyblue:"87ceeb",slateblue:"6a5acd",slategray:"708090",slategrey:"708090",snow:"fffafa",springgreen:"00ff7f",steelblue:"4682b4",tan:"d2b48c",teal:"008080",thistle:"d8bfd8",tomato:"ff6347",turquoise:"40e0d0",violet:"ee82ee",wheat:"f5deb3",white:"fff",whitesmoke:"f5f5f5",yellow:"ff0",yellowgreen:"9acd32"};function bE(e){if(typeof e!=="string")return e;var t=e.toLowerCase();return f0[t]?"#"+f0[t]:e}var SE=/^#[a-fA-F0-9]{6}$/,ME=/^#[a-fA-F0-9]{8}$/,wE=/^#[a-fA-F0-9]{3}$/,TE=/^#[a-fA-F0-9]{4}$/,Sf=/^rgb\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*\)$/i,EE=/^rgb(?:a)?\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i,AE=/^hsl\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*\)$/i,CE=/^hsl(?:a)?\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i;function Ci(e){if(typeof e!=="string")throw new hn(3);var t=bE(e);if(t.match(SE))return{red:parseInt(""+t[1]+t[2],16),green:parseInt(""+t[3]+t[4],16),blue:parseInt(""+t[5]+t[6],16)};if(t.match(ME)){var n=parseFloat((parseInt(""+t[7]+t[8],16)/255).toFixed(2));return{red:parseInt(""+t[1]+t[2],16),green:parseInt(""+t[3]+t[4],16),blue:parseInt(""+t[5]+t[6],16),alpha:n}}if(t.match(wE))return{red:parseInt(""+t[1]+t[1],16),green:parseInt(""+t[2]+t[2],16),blue:parseInt(""+t[3]+t[3],16)};if(t.match(TE)){var i=parseFloat((parseInt(""+t[4]+t[4],16)/255).toFixed(2));return{red:parseInt(""+t[1]+t[1],16),green:parseInt(""+t[2]+t[2],16),blue:parseInt(""+t[3]+t[3],16),alpha:i}}var r=Sf.exec(t);if(r)return{red:parseInt(""+r[1],10),green:parseInt(""+r[2],10),blue:parseInt(""+r[3],10)};var s=EE.exec(t.substring(0,50));if(s)return{red:parseInt(""+s[1],10),green:parseInt(""+s[2],10),blue:parseInt(""+s[3],10),alpha:parseFloat(""+s[4])>1?parseFloat(""+s[4])/100:parseFloat(""+s[4])};var o=AE.exec(t);if(o){var a=parseInt(""+o[1],10),l=parseInt(""+o[2],10)/100,c=parseInt(""+o[3],10)/100,h="rgb("+lo(a,l,c)+")",f=Sf.exec(h);if(!f)throw new hn(4,t,h);return{red:parseInt(""+f[1],10),green:parseInt(""+f[2],10),blue:parseInt(""+f[3],10)}}var u=CE.exec(t.substring(0,50));if(u){var p=parseInt(""+u[1],10),g=parseInt(""+u[2],10)/100,y=parseInt(""+u[3],10)/100,m="rgb("+lo(p,g,y)+")",d=Sf.exec(m);if(!d)throw new hn(4,t,m);return{red:parseInt(""+d[1],10),green:parseInt(""+d[2],10),blue:parseInt(""+d[3],10),alpha:parseFloat(""+u[4])>1?parseFloat(""+u[4])/100:parseFloat(""+u[4])}}throw new hn(5)}function RE(e){var t=e.red/255,n=e.green/255,i=e.blue/255,r=Math.max(t,n,i),s=Math.min(t,n,i),o=(r+s)/2;if(r===s)if(e.alpha!==void 0)return{hue:0,saturation:0,lightness:o,alpha:e.alpha};else return{hue:0,saturation:0,lightness:o};var a,l=r-s,c=o>0.5?l/(2-r-s):l/(r+s);switch(r){case t:a=(n-i)/l+(n<i?6:0);break;case n:a=(i-t)/l+2;break;default:a=(t-n)/l+4;break}if(a*=60,e.alpha!==void 0)return{hue:a,saturation:c,lightness:o,alpha:e.alpha};return{hue:a,saturation:c,lightness:o}}function Ri(e){return RE(Ci(e))}var PE=function(t){if(t.length===7&&t[1]===t[2]&&t[3]===t[4]&&t[5]===t[6])return"#"+t[1]+t[3]+t[5];return t},wf=PE;function rr(e){var t=e.toString(16);return t.length===1?"0"+t:t}function Mf(e){return rr(Math.round(e*255))}function IE(e,t,n){return wf("#"+Mf(e)+Mf(t)+Mf(n))}function dl(e,t,n){return lo(e,t,n,IE)}function LE(e,t,n){if(typeof e==="number"&&typeof t==="number"&&typeof n==="number")return dl(e,t,n);else if(typeof e==="object"&&t===void 0&&n===void 0)return dl(e.hue,e.saturation,e.lightness);throw new hn(1)}function DE(e,t,n,i){if(typeof e==="number"&&typeof t==="number"&&typeof n==="number"&&typeof i==="number")return i>=1?dl(e,t,n):"rgba("+lo(e,t,n)+","+i+")";else if(typeof e==="object"&&t===void 0&&n===void 0&&i===void 0)return e.alpha>=1?dl(e.hue,e.saturation,e.lightness):"rgba("+lo(e.hue,e.saturation,e.lightness)+","+e.alpha+")";throw new hn(2)}function Tf(e,t,n){if(typeof e==="number"&&typeof t==="number"&&typeof n==="number")return wf("#"+rr(e)+rr(t)+rr(n));else if(typeof e==="object"&&t===void 0&&n===void 0)return wf("#"+rr(e.red)+rr(e.green)+rr(e.blue));throw new hn(6)}function pl(e,t,n,i){if(typeof e==="string"&&typeof t==="number"){var r=Ci(e);return"rgba("+r.red+","+r.green+","+r.blue+","+t+")"}else if(typeof e==="number"&&typeof t==="number"&&typeof n==="number"&&typeof i==="number")return i>=1?Tf(e,t,n):"rgba("+e+","+t+","+n+","+i+")";else if(typeof e==="object"&&t===void 0&&n===void 0&&i===void 0)return e.alpha>=1?Tf(e.red,e.green,e.blue):"rgba("+e.red+","+e.green+","+e.blue+","+e.alpha+")";throw new hn(7)}var NE=function(t){return typeof t.red==="number"&&typeof t.green==="number"&&typeof t.blue==="number"&&(typeof t.alpha!=="number"||typeof t.alpha>"u")},OE=function(t){return typeof t.red==="number"&&typeof t.green==="number"&&typeof t.blue==="number"&&typeof t.alpha==="number"},UE=function(t){return typeof t.hue==="number"&&typeof t.saturation==="number"&&typeof t.lightness==="number"&&(typeof t.alpha!=="number"||typeof t.alpha>"u")},FE=function(t){return typeof t.hue==="number"&&typeof t.saturation==="number"&&typeof t.lightness==="number"&&typeof t.alpha==="number"};function Pi(e){if(typeof e!=="object")throw new hn(8);if(OE(e))return pl(e);if(NE(e))return Tf(e);if(FE(e))return DE(e);if(UE(e))return LE(e);throw new hn(8)}function p0(e,t,n){return function(){var r=n.concat(Array.prototype.slice.call(arguments));return r.length>=t?e.apply(this,r):p0(e,t,r)}}function _n(e){return p0(e,e.length,[])}function BE(e,t){if(t==="transparent")return t;var n=Ri(t);return Pi(en({},n,{hue:n.hue+parseFloat(e)}))}var Rz=_n(BE);function es(e,t,n){return Math.max(e,Math.min(t,n))}function kE(e,t){if(t==="transparent")return t;var n=Ri(t);return Pi(en({},n,{lightness:es(0,1,n.lightness-parseFloat(e))}))}var Pz=_n(kE);function zE(e,t){if(t==="transparent")return t;var n=Ri(t);return Pi(en({},n,{saturation:es(0,1,n.saturation-parseFloat(e))}))}var Iz=_n(zE);function GE(e,t){if(t==="transparent")return t;var n=Ri(t);return Pi(en({},n,{lightness:es(0,1,n.lightness+parseFloat(e))}))}var Lz=_n(GE);function HE(e,t,n){if(t==="transparent")return n;if(n==="transparent")return t;if(e===0)return n;var i=Ci(t),r=en({},i,{alpha:typeof i.alpha==="number"?i.alpha:1}),s=Ci(n),o=en({},s,{alpha:typeof s.alpha==="number"?s.alpha:1}),a=r.alpha-o.alpha,l=parseFloat(e)*2-1,c=l*a===-1?l:l+a,h=1+l*a,f=(c/h+1)/2,u=1-f,p={red:Math.floor(r.red*f+o.red*u),green:Math.floor(r.green*f+o.green*u),blue:Math.floor(r.blue*f+o.blue*u),alpha:r.alpha*parseFloat(e)+o.alpha*(1-parseFloat(e))};return pl(p)}var VE=_n(HE),m0=VE;function WE(e,t){if(t==="transparent")return t;var n=Ci(t),i=typeof n.alpha==="number"?n.alpha:1,r=en({},n,{alpha:es(0,1,(i*100+parseFloat(e)*100)/100)});return pl(r)}var XE=_n(WE),g0=XE;function qE(e,t){if(t==="transparent")return t;var n=Ri(t);return Pi(en({},n,{saturation:es(0,1,n.saturation+parseFloat(e))}))}var Dz=_n(qE);function jE(e,t){if(t==="transparent")return t;return Pi(en({},Ri(t),{hue:parseFloat(e)}))}var Nz=_n(jE);function YE(e,t){if(t==="transparent")return t;return Pi(en({},Ri(t),{lightness:parseFloat(e)}))}var Oz=_n(YE);function $E(e,t){if(t==="transparent")return t;return Pi(en({},Ri(t),{saturation:parseFloat(e)}))}var Uz=_n($E);function ZE(e,t){if(t==="transparent")return t;return m0(parseFloat(e),"rgb(0, 0, 0)",t)}var Fz=_n(ZE);function JE(e,t){if(t==="transparent")return t;return m0(parseFloat(e),"rgb(255, 255, 255)",t)}var Bz=_n(JE);function KE(e,t){if(t==="transparent")return t;var n=Ci(t),i=typeof n.alpha==="number"?n.alpha:1,r=en({},n,{alpha:es(0,1,+(i*100-parseFloat(e)*100).toFixed(2)/100)});return pl(r)}var kz=_n(KE);var Ii=Object.freeze({Linear:Object.freeze({None:function(e){return e},In:function(e){return e},Out:function(e){return e},InOut:function(e){return e}}),Quadratic:Object.freeze({In:function(e){return e*e},Out:function(e){return e*(2-e)},InOut:function(e){if((e*=2)<1)return 0.5*e*e;return-0.5*(--e*(e-2)-1)}}),Cubic:Object.freeze({In:function(e){return e*e*e},Out:function(e){return--e*e*e+1},InOut:function(e){if((e*=2)<1)return 0.5*e*e*e;return 0.5*((e-=2)*e*e+2)}}),Quartic:Object.freeze({In:function(e){return e*e*e*e},Out:function(e){return 1- --e*e*e*e},InOut:function(e){if((e*=2)<1)return 0.5*e*e*e*e;return-0.5*((e-=2)*e*e*e-2)}}),Quintic:Object.freeze({In:function(e){return e*e*e*e*e},Out:function(e){return--e*e*e*e*e+1},InOut:function(e){if((e*=2)<1)return 0.5*e*e*e*e*e;return 0.5*((e-=2)*e*e*e*e+2)}}),Sinusoidal:Object.freeze({In:function(e){return 1-Math.sin((1-e)*Math.PI/2)},Out:function(e){return Math.sin(e*Math.PI/2)},InOut:function(e){return 0.5*(1-Math.sin(Math.PI*(0.5-e)))}}),Exponential:Object.freeze({In:function(e){return e===0?0:Math.pow(1024,e-1)},Out:function(e){return e===1?1:1-Math.pow(2,-10*e)},InOut:function(e){if(e===0)return 0;if(e===1)return 1;if((e*=2)<1)return 0.5*Math.pow(1024,e-1);return 0.5*(-Math.pow(2,-10*(e-1))+2)}}),Circular:Object.freeze({In:function(e){return 1-Math.sqrt(1-e*e)},Out:function(e){return Math.sqrt(1- --e*e)},InOut:function(e){if((e*=2)<1)return-0.5*(Math.sqrt(1-e*e)-1);return 0.5*(Math.sqrt(1-(e-=2)*e)+1)}}),Elastic:Object.freeze({In:function(e){if(e===0)return 0;if(e===1)return 1;return-Math.pow(2,10*(e-1))*Math.sin((e-1.1)*5*Math.PI)},Out:function(e){if(e===0)return 0;if(e===1)return 1;return Math.pow(2,-10*e)*Math.sin((e-0.1)*5*Math.PI)+1},InOut:function(e){if(e===0)return 0;if(e===1)return 1;if(e*=2,e<1)return-0.5*Math.pow(2,10*(e-1))*Math.sin((e-1.1)*5*Math.PI);return 0.5*Math.pow(2,-10*(e-1))*Math.sin((e-1.1)*5*Math.PI)+1}}),Back:Object.freeze({In:function(e){var t=1.70158;return e===1?1:e*e*((t+1)*e-t)},Out:function(e){var t=1.70158;return e===0?0:--e*e*((t+1)*e+t)+1},InOut:function(e){var t=2.5949095;if((e*=2)<1)return 0.5*(e*e*((t+1)*e-t));return 0.5*((e-=2)*e*((t+1)*e+t)+2)}}),Bounce:Object.freeze({In:function(e){return 1-Ii.Bounce.Out(1-e)},Out:function(e){if(e<0.36363636363636365)return 7.5625*e*e;else if(e<0.7272727272727273)return 7.5625*(e-=0.5454545454545454)*e+0.75;else if(e<0.9090909090909091)return 7.5625*(e-=0.8181818181818182)*e+0.9375;else return 7.5625*(e-=0.9545454545454546)*e+0.984375},InOut:function(e){if(e<0.5)return Ii.Bounce.In(e*2)*0.5;return Ii.Bounce.Out(e*2-1)*0.5+0.5}}),generatePow:function(e){if(e===void 0)e=4;return e=e<Number.EPSILON?Number.EPSILON:e,e=e>1e4?1e4:e,{In:function(t){return Math.pow(t,e)},Out:function(t){return 1-Math.pow(1-t,e)},InOut:function(t){if(t<0.5)return Math.pow(t*2,e)/2;return(1-Math.pow(2-t*2,e))/2+0.5}}}}),co=function(){return performance.now()},Af=function(){function e(){var t=[];for(var n=0;n<arguments.length;n++)t[n]=arguments[n];this._tweens={},this._tweensAddedDuringUpdate={},this.add.apply(this,t)}return e.prototype.getAll=function(){var t=this;return Object.keys(this._tweens).map(function(n){return t._tweens[n]})},e.prototype.removeAll=function(){this._tweens={}},e.prototype.add=function(){var t,n=[];for(var i=0;i<arguments.length;i++)n[i]=arguments[i];for(var r=0,s=n;r<s.length;r++){var o=s[r];(t=o._group)===null||t===void 0||t.remove(o),o._group=this,this._tweens[o.getId()]=o,this._tweensAddedDuringUpdate[o.getId()]=o}},e.prototype.remove=function(){var t=[];for(var n=0;n<arguments.length;n++)t[n]=arguments[n];for(var i=0,r=t;i<r.length;i++){var s=r[i];s._group=void 0,delete this._tweens[s.getId()],delete this._tweensAddedDuringUpdate[s.getId()]}},e.prototype.allStopped=function(){return this.getAll().every(function(t){return!t.isPlaying()})},e.prototype.update=function(t,n){if(t===void 0)t=co();if(n===void 0)n=!0;var i=Object.keys(this._tweens);if(i.length===0)return;while(i.length>0){this._tweensAddedDuringUpdate={};for(var r=0;r<i.length;r++){var s=this._tweens[i[r]],o=!n;if(s&&s.update(t,o)===!1&&!n)this.remove(s)}i=Object.keys(this._tweensAddedDuringUpdate)}},e}(),ts={Linear:function(e,t){var n=e.length-1,i=n*t,r=Math.floor(i),s=ts.Utils.Linear;if(t<0)return s(e[0],e[1],i);if(t>1)return s(e[n],e[n-1],n-i);return s(e[r],e[r+1>n?n:r+1],i-r)},Bezier:function(e,t){var n=0,i=e.length-1,r=Math.pow,s=ts.Utils.Bernstein;for(var o=0;o<=i;o++)n+=r(1-t,i-o)*r(t,o)*e[o]*s(i,o);return n},CatmullRom:function(e,t){var n=e.length-1,i=n*t,r=Math.floor(i),s=ts.Utils.CatmullRom;if(e[0]===e[n]){if(t<0)r=Math.floor(i=n*(1+t));return s(e[(r-1+n)%n],e[r],e[(r+1)%n],e[(r+2)%n],i-r)}else{if(t<0)return e[0]-(s(e[0],e[0],e[1],e[1],-i)-e[0]);if(t>1)return e[n]-(s(e[n],e[n],e[n-1],e[n-1],i-n)-e[n]);return s(e[r?r-1:0],e[r],e[n<r+1?n:r+1],e[n<r+2?n:r+2],i-r)}},Utils:{Linear:function(e,t,n){return(t-e)*n+e},Bernstein:function(e,t){var n=ts.Utils.Factorial;return n(e)/n(t)/n(e-t)},Factorial:function(){var e=[1];return function(t){var n=1;if(e[t])return e[t];for(var i=t;i>1;i--)n*=i;return e[t]=n,n}}(),CatmullRom:function(e,t,n,i,r){var s=(n-e)*0.5,o=(i-t)*0.5,a=r*r,l=r*a;return(2*t-2*n+s+o)*l+(-3*t+3*n-2*s-o)*a+s*r+t}}},_0=function(){function e(){}return e.nextId=function(){return e._nextId++},e._nextId=0,e}(),Ef=new Af,Cf=function(){function e(t,n){if(this._isPaused=!1,this._pauseStart=0,this._valuesStart={},this._valuesEnd={},this._valuesStartRepeat={},this._duration=1000,this._isDynamic=!1,this._initialRepeat=0,this._repeat=0,this._yoyo=!1,this._isPlaying=!1,this._reversed=!1,this._delayTime=0,this._startTime=0,this._easingFunction=Ii.Linear.None,this._interpolationFunction=ts.Linear,this._chainedTweens=[],this._onStartCallbackFired=!1,this._onEveryStartCallbackFired=!1,this._id=_0.nextId(),this._isChainStopped=!1,this._propertiesAreSetUp=!1,this._goToEnd=!1,this._object=t,typeof n==="object")this._group=n,n.add(this);else if(n===!0)this._group=Ef,Ef.add(this)}return e.prototype.getId=function(){return this._id},e.prototype.isPlaying=function(){return this._isPlaying},e.prototype.isPaused=function(){return this._isPaused},e.prototype.getDuration=function(){return this._duration},e.prototype.to=function(t,n){if(n===void 0)n=1000;if(this._isPlaying)throw Error("Can not call Tween.to() while Tween is already started or paused. Stop the Tween first.");return this._valuesEnd=t,this._propertiesAreSetUp=!1,this._duration=n<0?0:n,this},e.prototype.duration=function(t){if(t===void 0)t=1000;return this._duration=t<0?0:t,this},e.prototype.dynamic=function(t){if(t===void 0)t=!1;return this._isDynamic=t,this},e.prototype.start=function(t,n){if(t===void 0)t=co();if(n===void 0)n=!1;if(this._isPlaying)return this;if(this._repeat=this._initialRepeat,this._reversed){this._reversed=!1;for(var i in this._valuesStartRepeat)this._swapEndStartRepeatValues(i),this._valuesStart[i]=this._valuesStartRepeat[i]}if(this._isPlaying=!0,this._isPaused=!1,this._onStartCallbackFired=!1,this._onEveryStartCallbackFired=!1,this._isChainStopped=!1,this._startTime=t,this._startTime+=this._delayTime,!this._propertiesAreSetUp||n){if(this._propertiesAreSetUp=!0,!this._isDynamic){var r={};for(var s in this._valuesEnd)r[s]=this._valuesEnd[s];this._valuesEnd=r}this._setupProperties(this._object,this._valuesStart,this._valuesEnd,this._valuesStartRepeat,n)}return this},e.prototype.startFromCurrentValues=function(t){return this.start(t,!0)},e.prototype._setupProperties=function(t,n,i,r,s){for(var o in i){var a=t[o],l=Array.isArray(a),c=l?"array":typeof a,h=!l&&Array.isArray(i[o]);if(c==="undefined"||c==="function")continue;if(h){var f=i[o];if(f.length===0)continue;var u=[a];for(var p=0,g=f.length;p<g;p+=1){var y=this._handleRelativeValue(a,f[p]);if(isNaN(y)){h=!1,console.warn("Found invalid interpolation list. Skipping.");break}u.push(y)}if(h)i[o]=u}if((c==="object"||l)&&a&&!h){n[o]=l?[]:{};var m=a;for(var d in m)n[o][d]=m[d];r[o]=l?[]:{};var f=i[o];if(!this._isDynamic){var b={};for(var d in f)b[d]=f[d];i[o]=f=b}this._setupProperties(m,n[o],f,r[o],s)}else{if(typeof n[o]>"u"||s)n[o]=a;if(!l)n[o]*=1;if(h)r[o]=i[o].slice().reverse();else r[o]=n[o]||0}}},e.prototype.stop=function(){if(!this._isChainStopped)this._isChainStopped=!0,this.stopChainedTweens();if(!this._isPlaying)return this;if(this._isPlaying=!1,this._isPaused=!1,this._onStopCallback)this._onStopCallback(this._object);return this},e.prototype.end=function(){return this._goToEnd=!0,this.update(this._startTime+this._duration),this},e.prototype.pause=function(t){if(t===void 0)t=co();if(this._isPaused||!this._isPlaying)return this;return this._isPaused=!0,this._pauseStart=t,this},e.prototype.resume=function(t){if(t===void 0)t=co();if(!this._isPaused||!this._isPlaying)return this;return this._isPaused=!1,this._startTime+=t-this._pauseStart,this._pauseStart=0,this},e.prototype.stopChainedTweens=function(){for(var t=0,n=this._chainedTweens.length;t<n;t++)this._chainedTweens[t].stop();return this},e.prototype.group=function(t){if(!t)return console.warn("tween.group() without args has been removed, use group.add(tween) instead."),this;return t.add(this),this},e.prototype.remove=function(){var t;return(t=this._group)===null||t===void 0||t.remove(this),this},e.prototype.delay=function(t){if(t===void 0)t=0;return this._delayTime=t,this},e.prototype.repeat=function(t){if(t===void 0)t=0;return this._initialRepeat=t,this._repeat=t,this},e.prototype.repeatDelay=function(t){return this._repeatDelayTime=t,this},e.prototype.yoyo=function(t){if(t===void 0)t=!1;return this._yoyo=t,this},e.prototype.easing=function(t){if(t===void 0)t=Ii.Linear.None;return this._easingFunction=t,this},e.prototype.interpolation=function(t){if(t===void 0)t=ts.Linear;return this._interpolationFunction=t,this},e.prototype.chain=function(){var t=[];for(var n=0;n<arguments.length;n++)t[n]=arguments[n];return this._chainedTweens=t,this},e.prototype.onStart=function(t){return this._onStartCallback=t,this},e.prototype.onEveryStart=function(t){return this._onEveryStartCallback=t,this},e.prototype.onUpdate=function(t){return this._onUpdateCallback=t,this},e.prototype.onRepeat=function(t){return this._onRepeatCallback=t,this},e.prototype.onComplete=function(t){return this._onCompleteCallback=t,this},e.prototype.onStop=function(t){return this._onStopCallback=t,this},e.prototype.update=function(t,n){var i=this,r;if(t===void 0)t=co();if(n===void 0)n=e.autoStartOnUpdate;if(this._isPaused)return!0;var s;if(!this._goToEnd&&!this._isPlaying)if(n)this.start(t,!0);else return!1;if(this._goToEnd=!1,t<this._startTime)return!0;if(this._onStartCallbackFired===!1){if(this._onStartCallback)this._onStartCallback(this._object);this._onStartCallbackFired=!0}if(this._onEveryStartCallbackFired===!1){if(this._onEveryStartCallback)this._onEveryStartCallback(this._object);this._onEveryStartCallbackFired=!0}var o=t-this._startTime,a=this._duration+((r=this._repeatDelayTime)!==null&&r!==void 0?r:this._delayTime),l=this._duration+this._repeat*a,c=function(){if(i._duration===0)return 1;if(o>l)return 1;var y=Math.trunc(o/a),m=o-y*a,d=Math.min(m/i._duration,1);if(d===0&&o===i._duration)return 1;return d},h=c(),f=this._easingFunction(h);if(this._updateProperties(this._object,this._valuesStart,this._valuesEnd,f),this._onUpdateCallback)this._onUpdateCallback(this._object,h);if(this._duration===0||o>=this._duration)if(this._repeat>0){var u=Math.min(Math.trunc((o-this._duration)/a)+1,this._repeat);if(isFinite(this._repeat))this._repeat-=u;for(s in this._valuesStartRepeat){if(!this._yoyo&&typeof this._valuesEnd[s]==="string")this._valuesStartRepeat[s]=this._valuesStartRepeat[s]+parseFloat(this._valuesEnd[s]);if(this._yoyo)this._swapEndStartRepeatValues(s);this._valuesStart[s]=this._valuesStartRepeat[s]}if(this._yoyo)this._reversed=!this._reversed;if(this._startTime+=a*u,this._onRepeatCallback)this._onRepeatCallback(this._object);return this._onEveryStartCallbackFired=!1,!0}else{if(this._onCompleteCallback)this._onCompleteCallback(this._object);for(var p=0,g=this._chainedTweens.length;p<g;p++)this._chainedTweens[p].start(this._startTime+this._duration,!1);return this._isPlaying=!1,!1}return!0},e.prototype._updateProperties=function(t,n,i,r){for(var s in i){if(n[s]===void 0)continue;var o=n[s]||0,a=i[s],l=Array.isArray(t[s]),c=Array.isArray(a),h=!l&&c;if(h)t[s]=this._interpolationFunction(a,r);else if(typeof a==="object"&&a)this._updateProperties(t[s],o,a,r);else if(a=this._handleRelativeValue(o,a),typeof a==="number")t[s]=o+(a-o)*r}},e.prototype._handleRelativeValue=function(t,n){if(typeof n!=="string")return n;if(n.charAt(0)==="+"||n.charAt(0)==="-")return t+parseFloat(n);return parseFloat(n)},e.prototype._swapEndStartRepeatValues=function(t){var n=this._valuesStartRepeat[t],i=this._valuesEnd[t];if(typeof i==="string")this._valuesStartRepeat[t]=this._valuesStartRepeat[t]+parseFloat(i);else this._valuesStartRepeat[t]=this._valuesEnd[t];this._valuesEnd[t]=n},e.autoStartOnUpdate=!1,e}();var Gz=_0.nextId,Xn=Ef,Hz=Xn.getAll.bind(Xn),Vz=Xn.removeAll.bind(Xn),Wz=Xn.add.bind(Xn),Xz=Xn.remove.bind(Xn),qz=Xn.update.bind(Xn);function Rf(e){let t;while(t=e.sourceEvent)e=t;return e}function ml(e,t){if(e=Rf(e),t===void 0)t=e.currentTarget;if(t){var n=t.ownerSVGElement||t;if(n.createSVGPoint){var i=n.createSVGPoint();return i.x=e.clientX,i.y=e.clientY,i=i.matrixTransform(t.getScreenCTM().inverse()),[i.x,i.y]}if(t.getBoundingClientRect){var r=t.getBoundingClientRect();return[e.clientX-r.left-t.clientLeft,e.clientY-r.top-t.clientTop]}}return[e.pageX,e.pageY]}function QE(){}function ho(e){return e==null?QE:function(){return this.querySelector(e)}}function Pf(e){if(typeof e!=="function")e=ho(e);for(var t=this._groups,n=t.length,i=Array(n),r=0;r<n;++r)for(var s=t[r],o=s.length,a=i[r]=Array(o),l,c,h=0;h<o;++h)if((l=s[h])&&(c=e.call(l,l.__data__,h,s))){if("__data__"in l)c.__data__=l.__data__;a[h]=c}return new xt(i,this._parents)}function If(e){return e==null?[]:Array.isArray(e)?e:Array.from(e)}function eA(){return[]}function Lf(e){return e==null?eA:function(){return this.querySelectorAll(e)}}function tA(e){return function(){return If(e.apply(this,arguments))}}function Df(e){if(typeof e==="function")e=tA(e);else e=Lf(e);for(var t=this._groups,n=t.length,i=[],r=[],s=0;s<n;++s)for(var o=t[s],a=o.length,l,c=0;c<a;++c)if(l=o[c])i.push(e.call(l,l.__data__,c,o)),r.push(l);return new xt(i,r)}function Nf(e){return function(){return this.matches(e)}}function gl(e){return function(t){return t.matches(e)}}var nA=Array.prototype.find;function iA(e){return function(){return nA.call(this.children,e)}}function rA(){return this.firstElementChild}function Of(e){return this.select(e==null?rA:iA(typeof e==="function"?e:gl(e)))}var sA=Array.prototype.filter;function oA(){return Array.from(this.children)}function aA(e){return function(){return sA.call(this.children,e)}}function Uf(e){return this.selectAll(e==null?oA:aA(typeof e==="function"?e:gl(e)))}function Ff(e){if(typeof e!=="function")e=Nf(e);for(var t=this._groups,n=t.length,i=Array(n),r=0;r<n;++r)for(var s=t[r],o=s.length,a=i[r]=[],l,c=0;c<o;++c)if((l=s[c])&&e.call(l,l.__data__,c,s))a.push(l);return new xt(i,this._parents)}function uo(e){return Array(e.length)}function Bf(){return new xt(this._enter||this._groups.map(uo),this._parents)}function fo(e,t){this.ownerDocument=e.ownerDocument,this.namespaceURI=e.namespaceURI,this._next=null,this._parent=e,this.__data__=t}fo.prototype={constructor:fo,appendChild:function(e){return this._parent.insertBefore(e,this._next)},insertBefore:function(e,t){return this._parent.insertBefore(e,t)},querySelector:function(e){return this._parent.querySelector(e)},querySelectorAll:function(e){return this._parent.querySelectorAll(e)}};function kf(e){return function(){return e}}function lA(e,t,n,i,r,s){var o=0,a,l=t.length,c=s.length;for(;o<c;++o)if(a=t[o])a.__data__=s[o],i[o]=a;else n[o]=new fo(e,s[o]);for(;o<l;++o)if(a=t[o])r[o]=a}function cA(e,t,n,i,r,s,o){var a,l,c=new Map,h=t.length,f=s.length,u=Array(h),p;for(a=0;a<h;++a)if(l=t[a])if(u[a]=p=o.call(l,l.__data__,a,t)+"",c.has(p))r[a]=l;else c.set(p,l);for(a=0;a<f;++a)if(p=o.call(e,s[a],a,s)+"",l=c.get(p))i[a]=l,l.__data__=s[a],c.delete(p);else n[a]=new fo(e,s[a]);for(a=0;a<h;++a)if((l=t[a])&&c.get(u[a])===l)r[a]=l}function hA(e){return e.__data__}function zf(e,t){if(!arguments.length)return Array.from(this,hA);var n=t?cA:lA,i=this._parents,r=this._groups;if(typeof e!=="function")e=kf(e);for(var s=r.length,o=Array(s),a=Array(s),l=Array(s),c=0;c<s;++c){var h=i[c],f=r[c],u=f.length,p=uA(e.call(h,h&&h.__data__,c,i)),g=p.length,y=a[c]=Array(g),m=o[c]=Array(g),d=l[c]=Array(u);n(h,f,y,m,d,p,t);for(var b=0,S=0,_,x;b<g;++b)if(_=y[b]){if(b>=S)S=b+1;while(!(x=m[S])&&++S<g);_._next=x||null}}return o=new xt(o,i),o._enter=a,o._exit=l,o}function uA(e){return typeof e==="object"&&"length"in e?e:Array.from(e)}function Gf(){return new xt(this._exit||this._groups.map(uo),this._parents)}function Hf(e,t,n){var i=this.enter(),r=this,s=this.exit();if(typeof e==="function"){if(i=e(i),i)i=i.selection()}else i=i.append(e+"");if(t!=null){if(r=t(r),r)r=r.selection()}if(n==null)s.remove();else n(s);return i&&r?i.merge(r).order():r}function Vf(e){var t=e.selection?e.selection():e;for(var n=this._groups,i=t._groups,r=n.length,s=i.length,o=Math.min(r,s),a=Array(r),l=0;l<o;++l)for(var c=n[l],h=i[l],f=c.length,u=a[l]=Array(f),p,g=0;g<f;++g)if(p=c[g]||h[g])u[g]=p;for(;l<r;++l)a[l]=n[l];return new xt(a,this._parents)}function Wf(){for(var e=this._groups,t=-1,n=e.length;++t<n;)for(var i=e[t],r=i.length-1,s=i[r],o;--r>=0;)if(o=i[r]){if(s&&o.compareDocumentPosition(s)^4)s.parentNode.insertBefore(o,s);s=o}return this}function Xf(e){if(!e)e=fA;function t(f,u){return f&&u?e(f.__data__,u.__data__):!f-!u}for(var n=this._groups,i=n.length,r=Array(i),s=0;s<i;++s){for(var o=n[s],a=o.length,l=r[s]=Array(a),c,h=0;h<a;++h)if(c=o[h])l[h]=c;l.sort(t)}return new xt(r,this._parents).order()}function fA(e,t){return e<t?-1:e>t?1:e>=t?0:NaN}function qf(){var e=arguments[0];return arguments[0]=this,e.apply(null,arguments),this}function jf(){return Array.from(this)}function Yf(){for(var e=this._groups,t=0,n=e.length;t<n;++t)for(var i=e[t],r=0,s=i.length;r<s;++r){var o=i[r];if(o)return o}return null}function $f(){let e=0;for(let t of this)++e;return e}function Zf(){return!this.node()}function Jf(e){for(var t=this._groups,n=0,i=t.length;n<i;++n)for(var r=t[n],s=0,o=r.length,a;s<o;++s)if(a=r[s])e.call(a,a.__data__,s,r);return this}var _l="http://www.w3.org/1999/xhtml",Kf={svg:"http://www.w3.org/2000/svg",xhtml:_l,xlink:"http://www.w3.org/1999/xlink",xml:"http://www.w3.org/XML/1998/namespace",xmlns:"http://www.w3.org/2000/xmlns/"};function po(e){var t=e+="",n=t.indexOf(":");if(n>=0&&(t=e.slice(0,n))!=="xmlns")e=e.slice(n+1);return Kf.hasOwnProperty(t)?{space:Kf[t],local:e}:e}function dA(e){return function(){this.removeAttribute(e)}}function pA(e){return function(){this.removeAttributeNS(e.space,e.local)}}function mA(e,t){return function(){this.setAttribute(e,t)}}function gA(e,t){return function(){this.setAttributeNS(e.space,e.local,t)}}function _A(e,t){return function(){var n=t.apply(this,arguments);if(n==null)this.removeAttribute(e);else this.setAttribute(e,n)}}function vA(e,t){return function(){var n=t.apply(this,arguments);if(n==null)this.removeAttributeNS(e.space,e.local);else this.setAttributeNS(e.space,e.local,n)}}function Qf(e,t){var n=po(e);if(arguments.length<2){var i=this.node();return n.local?i.getAttributeNS(n.space,n.local):i.getAttribute(n)}return this.each((t==null?n.local?pA:dA:typeof t==="function"?n.local?vA:_A:n.local?gA:mA)(n,t))}function mo(e){return e.ownerDocument&&e.ownerDocument.defaultView||e.document&&e||e.defaultView}function yA(e){return function(){this.style.removeProperty(e)}}function xA(e,t,n){return function(){this.style.setProperty(e,t,n)}}function bA(e,t,n){return function(){var i=t.apply(this,arguments);if(i==null)this.style.removeProperty(e);else this.style.setProperty(e,i,n)}}function ed(e,t,n){return arguments.length>1?this.each((t==null?yA:typeof t==="function"?bA:xA)(e,t,n==null?"":n)):SA(this.node(),e)}function SA(e,t){return e.style.getPropertyValue(t)||mo(e).getComputedStyle(e,null).getPropertyValue(t)}function MA(e){return function(){delete this[e]}}function wA(e,t){return function(){this[e]=t}}function TA(e,t){return function(){var n=t.apply(this,arguments);if(n==null)delete this[e];else this[e]=n}}function td(e,t){return arguments.length>1?this.each((t==null?MA:typeof t==="function"?TA:wA)(e,t)):this.node()[e]}function v0(e){return e.trim().split(/^|\s+/)}function nd(e){return e.classList||new y0(e)}function y0(e){this._node=e,this._names=v0(e.getAttribute("class")||"")}y0.prototype={add:function(e){var t=this._names.indexOf(e);if(t<0)this._names.push(e),this._node.setAttribute("class",this._names.join(" "))},remove:function(e){var t=this._names.indexOf(e);if(t>=0)this._names.splice(t,1),this._node.setAttribute("class",this._names.join(" "))},contains:function(e){return this._names.indexOf(e)>=0}};function x0(e,t){var n=nd(e),i=-1,r=t.length;while(++i<r)n.add(t[i])}function b0(e,t){var n=nd(e),i=-1,r=t.length;while(++i<r)n.remove(t[i])}function EA(e){return function(){x0(this,e)}}function AA(e){return function(){b0(this,e)}}function CA(e,t){return function(){(t.apply(this,arguments)?x0:b0)(this,e)}}function id(e,t){var n=v0(e+"");if(arguments.length<2){var i=nd(this.node()),r=-1,s=n.length;while(++r<s)if(!i.contains(n[r]))return!1;return!0}return this.each((typeof t==="function"?CA:t?EA:AA)(n,t))}function RA(){this.textContent=""}function PA(e){return function(){this.textContent=e}}function IA(e){return function(){var t=e.apply(this,arguments);this.textContent=t==null?"":t}}function rd(e){return arguments.length?this.each(e==null?RA:(typeof e==="function"?IA:PA)(e)):this.node().textContent}function LA(){this.innerHTML=""}function DA(e){return function(){this.innerHTML=e}}function NA(e){return function(){var t=e.apply(this,arguments);this.innerHTML=t==null?"":t}}function sd(e){return arguments.length?this.each(e==null?LA:(typeof e==="function"?NA:DA)(e)):this.node().innerHTML}function OA(){if(this.nextSibling)this.parentNode.appendChild(this)}function od(){return this.each(OA)}function UA(){if(this.previousSibling)this.parentNode.insertBefore(this,this.parentNode.firstChild)}function ad(){return this.each(UA)}function FA(e){return function(){var t=this.ownerDocument,n=this.namespaceURI;return n===_l&&t.documentElement.namespaceURI===_l?t.createElement(e):t.createElementNS(n,e)}}function BA(e){return function(){return this.ownerDocument.createElementNS(e.space,e.local)}}function go(e){var t=po(e);return(t.local?BA:FA)(t)}function ld(e){var t=typeof e==="function"?e:go(e);return this.select(function(){return this.appendChild(t.apply(this,arguments))})}function kA(){return null}function cd(e,t){var n=typeof e==="function"?e:go(e),i=t==null?kA:typeof t==="function"?t:ho(t);return this.select(function(){return this.insertBefore(n.apply(this,arguments),i.apply(this,arguments)||null)})}function zA(){var e=this.parentNode;if(e)e.removeChild(this)}function hd(){return this.each(zA)}function GA(){var e=this.cloneNode(!1),t=this.parentNode;return t?t.insertBefore(e,this.nextSibling):e}function HA(){var e=this.cloneNode(!0),t=this.parentNode;return t?t.insertBefore(e,this.nextSibling):e}function ud(e){return this.select(e?HA:GA)}function fd(e){return arguments.length?this.property("__data__",e):this.node().__data__}function VA(e){return function(t){e.call(this,t,this.__data__)}}function WA(e){return e.trim().split(/^|\s+/).map(function(t){var n="",i=t.indexOf(".");if(i>=0)n=t.slice(i+1),t=t.slice(0,i);return{type:t,name:n}})}function XA(e){return function(){var t=this.__on;if(!t)return;for(var n=0,i=-1,r=t.length,s;n<r;++n)if(s=t[n],(!e.type||s.type===e.type)&&s.name===e.name)this.removeEventListener(s.type,s.listener,s.options);else t[++i]=s;if(++i)t.length=i;else delete this.__on}}function qA(e,t,n){return function(){var i=this.__on,r,s=VA(t);if(i){for(var o=0,a=i.length;o<a;++o)if((r=i[o]).type===e.type&&r.name===e.name){this.removeEventListener(r.type,r.listener,r.options),this.addEventListener(r.type,r.listener=s,r.options=n),r.value=t;return}}if(this.addEventListener(e.type,s,n),r={type:e.type,name:e.name,value:t,listener:s,options:n},!i)this.__on=[r];else i.push(r)}}function dd(e,t,n){var i=WA(e+""),r,s=i.length,o;if(arguments.length<2){var a=this.node().__on;if(a){for(var l=0,c=a.length,h;l<c;++l)for(r=0,h=a[l];r<s;++r)if((o=i[r]).type===h.type&&o.name===h.name)return h.value}return}a=t?qA:XA;for(r=0;r<s;++r)this.each(a(i[r],t,n));return this}function S0(e,t,n){var i=mo(e),r=i.CustomEvent;if(typeof r==="function")r=new r(t,n);else if(r=i.document.createEvent("Event"),n)r.initEvent(t,n.bubbles,n.cancelable),r.detail=n.detail;else r.initEvent(t,!1,!1);e.dispatchEvent(r)}function jA(e,t){return function(){return S0(this,e,t)}}function YA(e,t){return function(){return S0(this,e,t.apply(this,arguments))}}function pd(e,t){return this.each((typeof t==="function"?YA:jA)(e,t))}function*md(){for(var e=this._groups,t=0,n=e.length;t<n;++t)for(var i=e[t],r=0,s=i.length,o;r<s;++r)if(o=i[r])yield o}var gd=[null];function xt(e,t){this._groups=e,this._parents=t}function $A(){return new xt([[document.documentElement]],gd)}function ZA(){return this}xt.prototype=$A.prototype={constructor:xt,select:Pf,selectAll:Df,selectChild:Of,selectChildren:Uf,filter:Ff,data:zf,enter:Bf,exit:Gf,join:Hf,merge:Vf,selection:ZA,order:Wf,sort:Xf,call:qf,nodes:jf,node:Yf,size:$f,empty:Zf,each:Jf,attr:Qf,style:ed,property:td,classed:id,text:rd,html:sd,raise:od,lower:ad,append:ld,insert:cd,remove:hd,clone:ud,datum:fd,on:dd,dispatch:pd,[Symbol.iterator]:md};function vl(e){return typeof e==="string"?new xt([[document.querySelector(e)]],[document.documentElement]):new xt([[e]],gd)}var yo,vt,A0,xd,Li,M0,C0,R0,_d,xl,_o,P0,bd,vd,yd,JA,Sl={},Ml=[],KA=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,Tl=Array.isArray;function qn(e,t){for(var n in t)e[n]=t[n];return e}function Sd(e){e&&e.parentNode&&e.parentNode.removeChild(e)}function QA(e,t,n){var i,r,s,o={};for(s in t)s=="key"?i=t[s]:s=="ref"?r=t[s]:o[s]=t[s];if(arguments.length>2&&(o.children=arguments.length>3?yo.call(arguments,2):n),typeof e=="function"&&e.defaultProps!=null)for(s in e.defaultProps)o[s]===void 0&&(o[s]=e.defaultProps[s]);return vo(e,o,i,r,null)}function vo(e,t,n,i,r){var s={type:e,props:t,key:n,ref:i,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:r==null?++A0:r,__i:-1,__u:0};return r==null&&vt.vnode!=null&&vt.vnode(s),s}function El(e){return e.children}function bl(e,t){this.props=e,this.context=t}function sr(e,t){if(t==null)return e.__?sr(e.__,e.__i+1):null;for(var n;t<e.__k.length;t++)if((n=e.__k[t])!=null&&n.__e!=null)return n.__e;return typeof e.type=="function"?sr(e):null}function eC(e){if(e.__P&&e.__d){var t=e.__v,n=t.__e,i=[],r=[],s=qn({},t);s.__v=t.__v+1,vt.vnode&&vt.vnode(s),Md(e.__P,s,t,e.__n,e.__P.namespaceURI,32&t.__u?[n]:null,i,n==null?sr(t):n,!!(32&t.__u),r),s.__v=t.__v,s.__.__k[s.__i]=s,O0(i,s,r),t.__e=t.__=null,s.__e!=n&&I0(s)}}function I0(e){if((e=e.__)!=null&&e.__c!=null)return e.__e=e.__c.base=null,e.__k.some(function(t){if(t!=null&&t.__e!=null)return e.__e=e.__c.base=t.__e}),I0(e)}function w0(e){(!e.__d&&(e.__d=!0)&&Li.push(e)&&!wl.__r++||M0!=vt.debounceRendering)&&((M0=vt.debounceRendering)||C0)(wl)}function wl(){try{for(var e,t=1;Li.length;)Li.length>t&&Li.sort(R0),e=Li.shift(),t=Li.length,eC(e)}finally{Li.length=wl.__r=0}}function L0(e,t,n,i,r,s,o,a,l,c,h){var f,u,p,g,y,m,d=i&&i.__k||Ml,b=t.length;for(l=tC(n,t,d,l,b),f=0;f<b;f++)(p=n.__k[f])!=null&&(u=p.__i!=-1&&d[p.__i]||Sl,p.__i=f,m=Md(e,p,u,r,s,o,a,l,c,h),g=p.__e,p.ref&&u.ref!=p.ref&&(u.ref&&wd(u.ref,null,p),h.push(p.ref,p.__c||g,p)),y==null&&g!=null&&(y=g),4&p.__u?(l=D0(p,l,e),u.__e&&(u.__e=null)):typeof p.type=="function"&&m!==void 0?l=m:g&&(l=g.nextSibling),p.__u&=-7);return n.__e=y,l}function tC(e,t,n,i,r){var s,o,a,l,c,h=n.length,f=h,u=0;for(e.__k=Array(r),s=0;s<r;s++)(o=t[s])!=null&&typeof o!="boolean"&&typeof o!="function"?(typeof o=="string"||typeof o=="number"||typeof o=="bigint"||o.constructor==String?o=e.__k[s]=vo(null,o,null,null,null):Tl(o)?o=e.__k[s]=vo(El,{children:o},null,null,null):o.constructor===void 0&&o.__b>0?o=e.__k[s]=vo(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):e.__k[s]=o,l=s+u,o.__=e,o.__b=e.__b+1,a=null,(c=o.__i=nC(o,n,l,f))!=-1&&(f--,(a=n[c])&&(a.__u|=2)),a==null||a.__v==null?(c==-1&&(r>h?u--:r<h&&u++),typeof o.type!="function"&&(o.__u|=4)):c!=l&&(c==l-1?u--:c==l+1?u++:(c>l?u--:u++,o.__u|=4))):e.__k[s]=null;if(f)for(s=0;s<h;s++)(a=n[s])!=null&&(2&a.__u)==0&&(a.__e==i&&(i=sr(a)),F0(a,a));return i}function D0(e,t,n){var i,r;if(typeof e.type=="function"){for(i=e.__k,r=0;i&&r<i.length;r++)i[r]&&(i[r].__=e,t=D0(i[r],t,n));return t}e.__e!=t&&(t&&e.type&&!t.parentNode&&(t=sr(e)),t=n.insertBefore(e.__e,t||null));do t=t&&t.nextSibling;while(t!=null&&t.nodeType==8);return t}function nC(e,t,n,i){var r,s,o,{key:a,type:l}=e,c=t[n],h=c!=null&&(2&c.__u)==0;if(c===null&&a==null||h&&a==c.key&&l==c.type)return n;if(i>(h?1:0)){for(r=n-1,s=n+1;r>=0||s<t.length;)if((c=t[o=r>=0?r--:s++])!=null&&(2&c.__u)==0&&a==c.key&&l==c.type)return o}return-1}function T0(e,t,n){t[0]=="-"?e.setProperty(t,n==null?"":n):e[t]=n==null?"":typeof n!="number"||KA.test(t)?n:n+"px"}function yl(e,t,n,i,r){var s,o;e:if(t=="style")if(typeof n=="string")e.style.cssText=n;else{if(typeof i=="string"&&(e.style.cssText=i=""),i)for(t in i)n&&t in n||T0(e.style,t,"");if(n)for(t in n)i&&n[t]==i[t]||T0(e.style,t,n[t])}else if(t[0]=="o"&&t[1]=="n")s=t!=(t=t.replace(P0,"$1")),o=t.toLowerCase(),t=o in e||t=="onFocusOut"||t=="onFocusIn"?o.slice(2):t.slice(2),e.l||(e.l={}),e.l[t+s]=n,n?i?n[_o]=i[_o]:(n[_o]=bd,e.addEventListener(t,s?yd:vd,s)):e.removeEventListener(t,s?yd:vd,s);else{if(r=="http://www.w3.org/2000/svg")t=t.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if(t!="width"&&t!="height"&&t!="href"&&t!="list"&&t!="form"&&t!="tabIndex"&&t!="download"&&t!="rowSpan"&&t!="colSpan"&&t!="role"&&t!="popover"&&t in e)try{e[t]=n==null?"":n;break e}catch(a){}typeof n=="function"||(n==null||n===!1&&t[4]!="-"?e.removeAttribute(t):e.setAttribute(t,t=="popover"&&n==1?"":n))}}function E0(e){return function(t){if(this.l){var n=this.l[t.type+e];if(t[xl]==null)t[xl]=bd++;else if(t[xl]<n[_o])return;return n(vt.event?vt.event(t):t)}}}function Md(e,t,n,i,r,s,o,a,l,c){var h,f,u,p,g,y,m,d,b,S,_,x,w,E,v,A,N=t.type;if(t.constructor!==void 0)return null;128&n.__u&&(l=!!(32&n.__u),s=[a=t.__e=n.__e]),(h=vt.__b)&&h(t);e:if(typeof N=="function"){f=o.length;try{if(b=t.props,S=N.prototype&&N.prototype.render,_=(h=N.contextType)&&i[h.__c],x=h?_?_.props.value:h.__:i,n.__c?d=(u=t.__c=n.__c).__=u.__E:(S?t.__c=u=new N(b,x):(t.__c=u=new bl(b,x),u.constructor=N,u.render=rC),_&&_.sub(u),u.state||(u.state={}),u.__n=i,p=u.__d=!0,u.__h=[],u._sb=[]),S&&u.__s==null&&(u.__s=u.state),S&&N.getDerivedStateFromProps!=null&&(u.__s==u.state&&(u.__s=qn({},u.__s)),qn(u.__s,N.getDerivedStateFromProps(b,u.__s))),g=u.props,y=u.state,u.__v=t,p)S&&N.getDerivedStateFromProps==null&&u.componentWillMount!=null&&u.componentWillMount(),S&&u.componentDidMount!=null&&u.__h.push(u.componentDidMount);else{if(S&&N.getDerivedStateFromProps==null&&b!==g&&u.componentWillReceiveProps!=null&&u.componentWillReceiveProps(b,x),t.__v==n.__v||!u.__e&&u.shouldComponentUpdate!=null&&u.shouldComponentUpdate(b,u.__s,x)===!1){t.__v!=n.__v&&(u.props=b,u.state=u.__s,u.__d=!1),t.__e=n.__e,t.__k=n.__k,t.__k.some(function(P){P&&(P.__=t)}),Ml.push.apply(u.__h,u._sb),u._sb=[],u.__h.length&&o.push(u),a=sr(n);break e}u.componentWillUpdate!=null&&u.componentWillUpdate(b,u.__s,x),S&&u.componentDidUpdate!=null&&u.__h.push(function(){u.componentDidUpdate(g,y,m)})}if(u.context=x,u.props=b,u.__P=e,u.__e=!1,w=vt.__r,E=0,S)u.state=u.__s,u.__d=!1,w&&w(t),h=u.render(u.props,u.state,u.context),Ml.push.apply(u.__h,u._sb),u._sb=[];else do u.__d=!1,w&&w(t),h=u.render(u.props,u.state,u.context),u.state=u.__s;while(u.__d&&++E<25);u.state=u.__s,u.getChildContext!=null&&(i=qn(qn({},i),u.getChildContext())),S&&!p&&u.getSnapshotBeforeUpdate!=null&&(m=u.getSnapshotBeforeUpdate(g,y)),v=h!=null&&h.type===El&&h.key==null?U0(h.props.children):h,a=L0(e,Tl(v)?v:[v],t,n,i,r,s,o,a,l,c),u.base=t.__e,t.__u&=-161,u.__h.length&&o.push(u),d&&(u.__E=u.__=null)}catch(P){if(o.length=f,t.__v=null,l||s!=null){if(P.then){for(t.__u|=l?160:128;a&&a.nodeType==8&&a.nextSibling;)a=a.nextSibling;s!=null&&(s[s.indexOf(a)]=null),t.__e=a}else if(s!=null)for(A=s.length;A--;)Sd(s[A])}else t.__e=n.__e;t.__k==null&&(t.__k=n.__k||[]),P.then||N0(t),vt.__e(P,t,n)}}else s==null&&t.__v==n.__v?(t.__k=n.__k,t.__e=n.__e):a=t.__e=iC(n.__e,t,n,i,r,s,o,l,c);return(h=vt.diffed)&&h(t),128&t.__u?void 0:a}function N0(e){e&&(e.__c&&(e.__c.__e=!0),e.__k&&e.__k.some(N0))}function O0(e,t,n){for(var i=0;i<n.length;i++)wd(n[i],n[++i],n[++i]);vt.__c&&vt.__c(t,e),e.some(function(r){try{e=r.__h,r.__h=[],e.some(function(s){s.call(r)})}catch(s){vt.__e(s,r.__v)}})}function U0(e){return typeof e!="object"||e==null||e.__b>0?e:Tl(e)?e.map(U0):e.constructor!==void 0?null:qn({},e)}function iC(e,t,n,i,r,s,o,a,l){var c,h,f,u,p,g,y,m=n.props||Sl,{props:d,type:b}=t;if(b=="svg"?r="http://www.w3.org/2000/svg":b=="math"?r="http://www.w3.org/1998/Math/MathML":r||(r="http://www.w3.org/1999/xhtml"),s!=null){for(c=0;c<s.length;c++)if((p=s[c])&&"setAttribute"in p==!!b&&(b?p.localName==b:p.nodeType==3)){e=p,s[c]=null;break}}if(e==null){if(b==null)return document.createTextNode(d);e=document.createElementNS(r,b,d.is&&d),a&&(vt.__m&&vt.__m(t,s),a=!1),s=null}if(b==null)m===d||a&&e.data==d||(e.data=d);else{if(s=b=="textarea"&&d.defaultValue!=null?null:s&&yo.call(e.childNodes),!a&&s!=null)for(m={},c=0;c<e.attributes.length;c++)m[(p=e.attributes[c]).name]=p.value;for(c in m)p=m[c],c=="dangerouslySetInnerHTML"?f=p:c=="children"||(c in d)||c=="value"&&("defaultValue"in d)||c=="checked"&&("defaultChecked"in d)||yl(e,c,null,p,r);for(c in d)p=d[c],c=="children"?u=p:c=="dangerouslySetInnerHTML"?h=p:c=="value"?g=p:c=="checked"?y=p:a&&typeof p!="function"||m[c]===p||yl(e,c,p,m[c],r);if(h)a||f&&(h.__html==f.__html||h.__html==e.innerHTML)||(e.innerHTML=h.__html),t.__k=[];else if(f&&(e.innerHTML=""),L0(t.type=="template"?e.content:e,Tl(u)?u:[u],t,n,i,b=="foreignObject"?"http://www.w3.org/1999/xhtml":r,s,o,s?s[0]:n.__k&&sr(n,0),a,l),s!=null)for(c=s.length;c--;)Sd(s[c]);a&&b!="textarea"||(c="value",b=="progress"&&g==null?e.removeAttribute("value"):g!=null&&(g!==e[c]||b=="progress"&&!g||b=="option"&&g!=m[c])&&yl(e,c,g,m[c],r),c="checked",y!=null&&y!=e[c]&&yl(e,c,y,m[c],r))}return e}function wd(e,t,n){try{if(typeof e=="function"){var i=typeof e.__u=="function";i&&e.__u(),i&&t==null||(e.__u=e(t))}else e.current=t}catch(r){vt.__e(r,n)}}function F0(e,t,n){var i,r;if(vt.unmount&&vt.unmount(e),(i=e.ref)&&(i.current&&i.current!=e.__e||wd(i,null,t)),(i=e.__c)!=null){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(s){vt.__e(s,t)}i.base=i.__P=i.__n=null}if(i=e.__k)for(r=0;r<i.length;r++)i[r]&&F0(i[r],t,n||typeof e.type!="function");n||Sd(e.__e),e.__c=e.__=e.__e=void 0}function rC(e,t,n){return this.constructor(e,n)}function B0(e,t,n){var i,r,s,o;t==document&&(t=document.documentElement),vt.__&&vt.__(e,t),r=(i=typeof n=="function")?null:n&&n.__k||t.__k,s=[],o=[],Md(t,e=(!i&&n||t).__k=QA(El,null,[e]),r||Sl,Sl,t.namespaceURI,!i&&n?[n]:r?null:t.firstChild?yo.call(t.childNodes):null,s,!i&&n?n:r?r.__e:t.firstChild,i,o),O0(s,e,o),e.props.children=null}function Td(e,t,n){var i,r,s,o,a=qn({},e.props);for(s in e.type&&e.type.defaultProps&&(o=e.type.defaultProps),t)s=="key"?i=t[s]:s=="ref"?r=t[s]:a[s]=t[s]===void 0&&o!=null?o[s]:t[s];return arguments.length>2&&(a.children=arguments.length>3?yo.call(arguments,2):n),vo(e.type,a,i||e.key,r||e.ref,null)}yo=Ml.slice,vt={__e:function(e,t,n,i){for(var r,s,o;t=t.__;)if((r=t.__c)&&!r.__)try{if((s=r.constructor)&&s.getDerivedStateFromError!=null&&(r.setState(s.getDerivedStateFromError(e)),o=r.__d),r.componentDidCatch!=null&&(r.componentDidCatch(e,i||{}),o=r.__d),o)return r.__E=r}catch(a){e=a}throw e}},A0=0,xd=function(e){return e!=null&&e.constructor===void 0},bl.prototype.setState=function(e,t){var n;n=this.__s!=null&&this.__s!=this.state?this.__s:this.__s=qn({},this.state),typeof e=="function"&&(e=e(qn({},n),this.props)),e&&qn(n,e),e!=null&&this.__v&&(t&&this._sb.push(t),w0(this))},bl.prototype.forceUpdate=function(e){this.__v&&(this.__e=!0,e&&this.__h.push(e),w0(this))},bl.prototype.render=El,Li=[],C0=typeof Promise=="function"?Promise.prototype.then.bind(Promise.resolve()):setTimeout,R0=function(e,t){return e.__v.__b-t.__v.__b},wl.__r=0,_d=Math.random().toString(8),xl="__d"+_d,_o="__a"+_d,P0=/(PointerCapture)$|Capture$/i,bd=0,vd=E0(!1),yd=E0(!0),JA=0;function k0(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function sC(e){if(Array.isArray(e))return e}function oC(e,t,n){return(t=fC(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function aC(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0);else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(h){c=!0,r=h}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function lC(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function z0(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);t&&(i=i.filter(function(r){return Object.getOwnPropertyDescriptor(e,r).enumerable})),n.push.apply(n,i)}return n}function cC(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]!=null?arguments[t]:{};t%2?z0(Object(n),!0).forEach(function(i){oC(e,i,n[i])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):z0(Object(n)).forEach(function(i){Object.defineProperty(e,i,Object.getOwnPropertyDescriptor(n,i))})}return e}function hC(e,t){return sC(e)||aC(e,t)||dC(e,t)||lC()}function uC(e,t){if(typeof e!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var i=n.call(e,t);if(typeof i!="object")return i;throw TypeError("@@toPrimitive must return a primitive value.")}return(t==="string"?String:Number)(e)}function fC(e){var t=uC(e,"string");return typeof t=="symbol"?t:t+""}function Al(e){return Al=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(t){return typeof t}:function(t){return t&&typeof Symbol=="function"&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},Al(e)}function dC(e,t){if(e){if(typeof e=="string")return k0(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?k0(e,t):void 0}}var Ed=function(t){if(Al(t)!=="object")return t;var n=Td(t);if(n.props){var i;if(n.props=cC({},n.props),n!==null&&n!==void 0&&(i=n.props)!==null&&i!==void 0&&i.children)n.props.children=Array.isArray(n.props.children)?n.props.children.map(Ed):Ed(n.props.children)}return n},pC=function(t){return xd(Td(t))},mC=function(t,n){delete n.__k,B0(Ed(t),n)};var G0=wi({props:{content:{default:!1},offsetX:{triggerUpdate:!1},offsetY:{triggerUpdate:!1}},init:function(t,n){var i=arguments.length>2&&arguments[2]!==void 0?arguments[2]:{},r=i.style,s=r===void 0?{}:r,o=!!t&&Al(t)==="object"&&!!t.node&&typeof t.node==="function",a=vl(o?t.node():t);a.style("position")==="static"&&a.style("position","relative"),n.tooltipEl=a.append("div").attr("class","float-tooltip-kap"),Object.entries(s).forEach(function(c){var h=hC(c,2),f=h[0],u=h[1];return n.tooltipEl.style(f,u)}),n.tooltipEl.style("left","-10000px").style("display","none");var l="tooltip-".concat(Math.round(Math.random()*1000000000000));n.mouseInside=!1,a.on("mousemove.".concat(l),function(c){n.mouseInside=!0;var h=ml(c),f=a.node(),{offsetWidth:u,offsetHeight:p}=f,g=[n.offsetX===null||n.offsetX===void 0?"-".concat(h[0]/u*100,"%"):typeof n.offsetX==="number"?"calc(-50% + ".concat(n.offsetX,"px)"):n.offsetX,n.offsetY===null||n.offsetY===void 0?p>130&&p-h[1]<100?"calc(-100% - 6px)":"21px":typeof n.offsetY==="number"?n.offsetY<0?"calc(-100% - ".concat(Math.abs(n.offsetY),"px)"):"".concat(n.offsetY,"px"):n.offsetY];n.tooltipEl.style("left",h[0]+"px").style("top",h[1]+"px").style("transform","translate(".concat(g.join(","),")")),n.content&&n.tooltipEl.style("display","inline")}),a.on("mouseover.".concat(l),function(){n.mouseInside=!0,n.content&&n.tooltipEl.style("display","inline")}),a.on("mouseout.".concat(l),function(){n.mouseInside=!1,n.tooltipEl.style("display","none")})},update:function(t){if(t.tooltipEl.style("display",!!t.content&&t.mouseInside?"inline":"none"),!t.content)t.tooltipEl.text("");else if(t.content instanceof HTMLElement)t.tooltipEl.text(""),t.tooltipEl.append(function(){return t.content});else if(typeof t.content==="string")t.tooltipEl.text(t.content);else if(pC(t.content))t.tooltipEl.text(""),mC(t.content,t.tooltipEl.node());else t.tooltipEl.style("display","none"),console.warn("Tooltip content is invalid, skipping.",t.content,t.content.toString())}});var gC=null;var H0=(e)=>{if(e instanceof Array)e.forEach(H0);else{if(e.map)e.map.dispose();e.dispose()}},V0=(e)=>{if(e.geometry)e.geometry.dispose();if(e.material)H0(e.material);if(e.texture)e.texture.dispose();if(e.children)e.children.forEach(V0)},_C=(e)=>{while(e.children.length){let t=e.children[0];e.remove(t),V0(t)}},$e=window.THREE?window.THREE:{WebGLRenderer:Gh,Scene:fa,PerspectiveCamera:Kt,Raycaster:Hr,SRGBColorSpace:Or,TextureLoader:Ma,Vector2:re,Vector3:L,Box3:In,Color:Fe,Mesh:zt,SphereGeometry:ji,MeshBasicMaterial:xi,BackSide:Xt,Timer:Gr},Ad=wi({props:{width:{default:window.innerWidth,onChange(e,t,n){isNaN(e)&&(t.width=n)}},height:{default:window.innerHeight,onChange(e,t,n){isNaN(e)&&(t.height=n)}},viewOffset:{default:[0,0]},backgroundColor:{default:"#000011"},backgroundImageUrl:{},onBackgroundImageLoaded:{},showNavInfo:{default:!0},skyRadius:{default:50000},objects:{default:[]},lights:{default:[]},enablePointerInteraction:{default:!0,onChange(e,t){t.hoverObj=null,t.tooltip&&t.tooltip.content(null)},triggerUpdate:!1},pointerRaycasterThrottleMs:{default:50,triggerUpdate:!1},lineHoverPrecision:{default:1,triggerUpdate:!1},pointsHoverPrecision:{default:1,triggerUpdate:!1},hoverOrderComparator:{triggerUpdate:!1},hoverFilter:{default:()=>!0,triggerUpdate:!1},tooltipContent:{triggerUpdate:!1},hoverDuringDrag:{default:!1,triggerUpdate:!1},clickAfterDrag:{default:!1,triggerUpdate:!1},onHover:{default:()=>{},triggerUpdate:!1},onClick:{default:()=>{},triggerUpdate:!1},onRightClick:{triggerUpdate:!1}},methods:{tick:function(e){if(e.initialised){e.controls.enabled&&e.controls.update&&e.controls.update(Math.min(1,e.timer.update().getDelta())),e.postProcessingComposer?e.postProcessingComposer.render():e.renderer.render(e.scene,e.camera),e.extraRenderers.forEach((n)=>n.render(e.scene,e.camera));let t=+new Date;if(e.enablePointerInteraction&&t-e.lastRaycasterCheck>=e.pointerRaycasterThrottleMs){e.lastRaycasterCheck=t;let n=null;if(e.hoverDuringDrag||!e.isPointerDragging){let i=this.intersectingObjects(e.pointerPos.x,e.pointerPos.y);e.hoverOrderComparator&&i.sort((s,o)=>e.hoverOrderComparator(s.object,o.object));let r=i.find((s)=>e.hoverFilter(s.object))||null;n=r?r.object:null,e.intersection=r||null}if(n!==e.hoverObj)e.onHover(n,e.hoverObj,e.intersection),e.tooltip.content(n?ze(e.tooltipContent)(n,e.intersection)||null:null),e.hoverObj=n}e.tweenGroup.update()}return this},getPointerPos:function(e){let{x:t,y:n}=e.pointerPos;return{x:t,y:n}},cameraPosition:function(e,t,n,i){let r=e.camera;if(t&&e.initialised){let l=t,c=n||{x:0,y:0,z:0};if(e.povPosTween?.end(),e.povTgtTween?.end(),!i)s(l),o(c);else{let h=Object.assign({},r.position),f=a();e.tweenGroup.add(e.povPosTween=new Cf(h).to(l,i).easing(Ii.Quadratic.Out).onUpdate(s).onComplete(function(){e.povPosTween=void 0,e.tweenGroup.remove(this)}).start()),e.tweenGroup.add(e.povTgtTween=new Cf(f).to(c,i/3).easing(Ii.Quadratic.Out).onUpdate(o).onComplete(function(){e.povTgtTween=void 0,e.tweenGroup.remove(this)}).start())}return this}return Object.assign({},r.position,{lookAt:a()});function s(l){let{x:c,y:h,z:f}=l;if(c!==void 0)r.position.x=c;if(h!==void 0)r.position.y=h;if(f!==void 0)r.position.z=f}function o(l){let c=new $e.Vector3(l.x,l.y,l.z);if(e.controls.enabled&&e.controls.target)e.controls.target=c;else r.lookAt(c)}function a(){return Object.assign(new $e.Vector3(0,0,-1000).applyQuaternion(r.quaternion).add(r.position))}},zoomToFit:function(e,t=0,n=10,i,r){return this.fitToBbox(this.getBbox(i),t,n,r)},fitToBbox:function(e,t,n=0,i=10,r=!1){let s=e.camera;if(t){s.updateMatrixWorld();let o=new $e.Vector3,a=new $e.Vector3,l=new $e.Vector3,c=new $e.Vector3;s.getWorldPosition(c),s.getWorldDirection(l),o.crossVectors(l,s.up).normalize(),a.crossVectors(o,l).normalize();let f=(1-i*2/e.height)*s.fov/2*(Math.PI/180),u=Math.atan(Math.tan(f)*s.aspect),p=new $e.Vector3((t.x[0]+t.x[1])/2,(t.y[0]+t.y[1])/2,(t.z[0]+t.z[1])/2),g=r?l.clone().multiplyScalar(c.distanceTo(p)).add(c):p,y=Math.max(0,...[new $e.Vector3(t.x[0],t.y[0],t.z[0]),new $e.Vector3(t.x[0],t.y[0],t.z[1]),new $e.Vector3(t.x[0],t.y[1],t.z[0]),new $e.Vector3(t.x[0],t.y[1],t.z[1]),new $e.Vector3(t.x[1],t.y[0],t.z[0]),new $e.Vector3(t.x[1],t.y[0],t.z[1]),new $e.Vector3(t.x[1],t.y[1],t.z[0]),new $e.Vector3(t.x[1],t.y[1],t.z[1])].map((b)=>{let S=b.clone().sub(g);return Math.max(Math.abs(S.dot(a))/Math.tan(f),Math.abs(S.dot(o))/Math.tan(u))-S.dot(l)})),m=l.clone().negate(),d={x:g.x+m.x*y,y:g.y+m.y*y,z:g.z+m.z*y};this.cameraPosition(d,g,n)}return this},getBbox:function(e,t=()=>!0){let n=new $e.Box3,i=e.objects.filter(t);if(!i.length)return null;return i.forEach((r)=>n.expandByObject(r)),Object.assign(...["x","y","z"].map((r)=>({[r]:[n.min[r],n.max[r]]})))},getScreenCoords:function(e,t,n,i){let r=new $e.Vector3(t,n,i);return r.project(this.camera()),{x:(r.x+1)*e.width/2,y:-(r.y-1)*e.height/2}},getSceneCoords:function(e,t,n,i=0){let r=new $e.Vector2(t/e.width*2-1,-(n/e.height)*2+1),s=new $e.Raycaster;return s.setFromCamera(r,e.camera),Object.assign({},s.ray.at(i,new $e.Vector3))},intersectingObjects:function(e,t,n){let i=new $e.Vector2(t/e.width*2-1,-(n/e.height)*2+1),r=new $e.Raycaster;return r.params.Line.threshold=e.lineHoverPrecision,r.params.Points.threshold=e.pointsHoverPrecision,r.setFromCamera(i,e.camera),r.intersectObjects(e.objects,!0)},renderer:(e)=>e.renderer,scene:(e)=>e.scene,camera:(e)=>e.camera,postProcessingComposer:(e)=>e.postProcessingComposer,controls:(e)=>e.controls,tbControls:(e)=>e.controls,_destructor:function(e){_C(e.scene),e.controls?.dispose(),e.renderer?.dispose(),e.postProcessingComposer?.dispose()}},stateInit:()=>({scene:new $e.Scene,camera:new $e.PerspectiveCamera,timer:new $e.Timer,tweenGroup:new Af,lastRaycasterCheck:0}),init(e,t,{controlType:n="trackball",useWebGPU:i=!1,rendererConfig:r={},extraRenderers:s=[],waitForLoadComplete:o=!0}={}){if(e.innerHTML="",e.appendChild(t.container=document.createElement("div")),t.container.className="scene-container",t.container.style.position="relative",t.container.appendChild(t.navInfo=document.createElement("div")),t.navInfo.className="scene-nav-info",t.navInfo.textContent={orbit:"Left-click: rotate, Mouse-wheel/middle-click: zoom, Right-click: pan",trackball:"Left-click: rotate, Mouse-wheel/middle-click: zoom, Right-click: pan",fly:"WASD: move, R|F: up | down, Q|E: roll, up|down: pitch, left|right: yaw"}[n]||"",t.navInfo.style.display=t.showNavInfo?null:"none",t.tooltip=new G0(t.container),t.pointerPos=new $e.Vector2,t.pointerPos.x=-2,t.pointerPos.y=-2,["pointermove","pointerdown"].forEach((a)=>t.container.addEventListener(a,(l)=>{if(a==="pointerdown"&&(t.isPointerPressed=!0),!t.isPointerDragging&&l.type==="pointermove"&&(l.pressure>0||t.isPointerPressed)&&(l.pointerType==="mouse"||l.movementX===void 0||[l.movementX,l.movementY].some((h)=>Math.abs(h)>1))&&(t.isPointerDragging=!0),t.enablePointerInteraction){let h=c(t.container);t.pointerPos.x=l.pageX-h.left,t.pointerPos.y=l.pageY-h.top}function c(h){let f=h.getBoundingClientRect(),u=window.pageXOffset||document.documentElement.scrollLeft,p=window.pageYOffset||document.documentElement.scrollTop;return{top:f.top+p,left:f.left+u}}},{passive:!0})),t.container.addEventListener("pointerup",(a)=>{if(!t.isPointerPressed)return;if(t.isPointerPressed=!1,t.isPointerDragging){if(t.isPointerDragging=!1,!t.clickAfterDrag)return}requestAnimationFrame(()=>{if(a.button===0)t.onClick(t.hoverObj||null,a,t.intersection);if(a.button===2&&t.onRightClick)t.onRightClick(t.hoverObj||null,a,t.intersection)})},{passive:!0,capture:!0}),t.container.addEventListener("contextmenu",(a)=>{if(t.onRightClick)a.preventDefault()}),t.renderer=new(i?gC:$e.WebGLRenderer)(Object.assign({antialias:!0,alpha:!0},r)),t.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio)),t.container.appendChild(t.renderer.domElement),t.extraRenderers=s,t.extraRenderers.forEach((a)=>{a.domElement.style.position="absolute",a.domElement.style.top="0px",a.domElement.style.pointerEvents="none",t.container.appendChild(a.domElement)}),t.postProcessingComposer=new cl(t.renderer),t.postProcessingComposer.addPass(new hl(t.scene,t.camera)),t.controls=new{trackball:df,orbit:gf,fly:_f}[n](t.camera,t.renderer.domElement),n==="fly")t.controls.movementSpeed=300,t.controls.rollSpeed=Math.PI/6,t.controls.dragToLook=!0;if(n==="trackball"||n==="orbit")t.controls.minDistance=0.1,t.controls.maxDistance=t.skyRadius,t.controls.addEventListener("start",()=>{t.controlsEngaged=!0}),t.controls.addEventListener("change",()=>{if(t.controlsEngaged)t.controlsDragging=!0}),t.controls.addEventListener("end",()=>{t.controlsEngaged=!1,t.controlsDragging=!1});[t.renderer,t.postProcessingComposer,...t.extraRenderers].forEach((a)=>a.setSize(t.width,t.height)),t.camera.aspect=t.width/t.height,t.camera.updateProjectionMatrix(),t.camera.position.z=1000,t.scene.add(t.skysphere=new $e.Mesh),t.skysphere.visible=!1,t.loadComplete=t.scene.visible=!o,window.scene=t.scene},update(e,t){if(e.width&&e.height&&(t.hasOwnProperty("width")||t.hasOwnProperty("height"))){let{width:i,height:r}=e;e.container.style.width=`${i}px`,e.container.style.height=`${r}px`,[e.renderer,e.postProcessingComposer,...e.extraRenderers].forEach((o)=>o.setSize(i,r)),e.camera.aspect=i/r;let s=e.viewOffset.slice(0,2);s.some((o)=>o)&&e.camera.setViewOffset(i,r,...s,i,r),e.camera.updateProjectionMatrix()}if(t.hasOwnProperty("viewOffset")){let{width:i,height:r}=e,s=e.viewOffset.slice(0,2);s.some((o)=>o)?e.camera.setViewOffset(i,r,...s,i,r):e.camera.clearViewOffset()}if(t.hasOwnProperty("skyRadius")&&e.skyRadius)e.controls.hasOwnProperty("maxDistance")&&t.skyRadius&&(e.controls.maxDistance=Math.min(e.controls.maxDistance,e.skyRadius)),e.camera.far=e.skyRadius*2.5,e.camera.updateProjectionMatrix(),e.skysphere.geometry=new $e.SphereGeometry(e.skyRadius);if(t.hasOwnProperty("backgroundColor")){let i=Ci(e.backgroundColor).alpha;if(i===void 0)i=1;e.renderer.setClearColor(new $e.Color(g0(1,e.backgroundColor)),i)}if(t.hasOwnProperty("backgroundImageUrl"))if(!e.backgroundImageUrl)e.skysphere.visible=!1,e.skysphere.material.map=null,!e.loadComplete&&n();else new $e.TextureLoader().load(e.backgroundImageUrl,(i)=>{i.colorSpace=$e.SRGBColorSpace,e.skysphere.material=new $e.MeshBasicMaterial({map:i,side:$e.BackSide}),e.skysphere.visible=!0,e.onBackgroundImageLoaded&&setTimeout(e.onBackgroundImageLoaded),!e.loadComplete&&n()});if(t.hasOwnProperty("showNavInfo")&&(e.navInfo.style.display=e.showNavInfo?null:"none"),t.hasOwnProperty("lights"))(t.lights||[]).forEach((i)=>e.scene.remove(i)),e.lights.forEach((i)=>e.scene.add(i));if(t.hasOwnProperty("objects"))(t.objects||[]).forEach((i)=>e.scene.remove(i)),e.objects.forEach((i)=>e.scene.add(i));function n(){e.loadComplete=e.scene.visible=!0}}});function W0(e,t){let n=new t;return n._destructor&&n._destructor(),{linkProp:function(i){return{default:n[i](),onChange(r,s){s[e][i](r)},triggerUpdate:!1}},linkMethod:function(i){return function(r,...s){let o=r[e],a=o[i](...s);return a===o?this:a}}}}var Cd=window.THREE?window.THREE:{AmbientLight:Aa,DirectionalLight:Ea,REVISION:Ko},vC=170,X0=W0("forceGraph",af),yC=Object.assign(...["jsonUrl","graphData","numDimensions","dagMode","dagLevelDistance","dagNodeFilter","onDagError","nodeRelSize","nodeId","nodeVal","nodeResolution","nodeColor","nodeAutoColorBy","nodeOpacity","nodeVisibility","nodeThreeObject","nodeThreeObjectExtend","nodePositionUpdate","linkSource","linkTarget","linkVisibility","linkColor","linkAutoColorBy","linkOpacity","linkWidth","linkResolution","linkCurvature","linkCurveRotation","linkMaterial","linkThreeObject","linkThreeObjectExtend","linkPositionUpdate","linkDirectionalArrowLength","linkDirectionalArrowColor","linkDirectionalArrowRelPos","linkDirectionalArrowResolution","linkDirectionalParticles","linkDirectionalParticleSpeed","linkDirectionalParticleOffset","linkDirectionalParticleWidth","linkDirectionalParticleColor","linkDirectionalParticleResolution","linkDirectionalParticleThreeObject","forceEngine","d3AlphaDecay","d3VelocityDecay","d3AlphaMin","ngraphPhysics","warmupTicks","cooldownTicks","cooldownTime","onEngineTick","onEngineStop"].map((e)=>({[e]:X0.linkProp(e)}))),xC=Object.assign(...["refresh","getGraphBbox","d3Force","d3ReheatSimulation","emitParticle"].map((e)=>({[e]:X0.linkMethod(e)}))),Cl=W0("renderObjs",Ad),bC=Object.assign(...["width","height","backgroundColor","showNavInfo","enablePointerInteraction"].map((e)=>({[e]:Cl.linkProp(e)}))),SC=Object.assign(...["lights","cameraPosition","postProcessingComposer"].map((e)=>({[e]:Cl.linkMethod(e)})),{graph2ScreenCoords:Cl.linkMethod("getScreenCoords"),screen2GraphCoords:Cl.linkMethod("getSceneCoords")}),MC=wi({props:{nodeLabel:{default:"name",triggerUpdate:!1},linkLabel:{default:"name",triggerUpdate:!1},linkHoverPrecision:{default:1,onChange:(e,t)=>t.renderObjs.lineHoverPrecision(e),triggerUpdate:!1},enableNavigationControls:{default:!0,onChange(e,t){let n=t.renderObjs.controls();if(n)n.enabled=e,e&&n.domElement&&n.domElement.dispatchEvent(new PointerEvent("pointerup"))},triggerUpdate:!1},enableNodeDrag:{default:!0,triggerUpdate:!1},onNodeDrag:{default:()=>{},triggerUpdate:!1},onNodeDragEnd:{default:()=>{},triggerUpdate:!1},onNodeClick:{triggerUpdate:!1},onNodeRightClick:{triggerUpdate:!1},onNodeHover:{triggerUpdate:!1},onLinkClick:{triggerUpdate:!1},onLinkRightClick:{triggerUpdate:!1},onLinkHover:{triggerUpdate:!1},onBackgroundClick:{triggerUpdate:!1},onBackgroundRightClick:{triggerUpdate:!1},showPointerCursor:{default:!0,triggerUpdate:!1},...yC,...bC},methods:{zoomToFit:function(e,t,n,...i){return e.renderObjs.fitToBbox(e.forceGraph.getGraphBbox(...i),t,n),this},pauseAnimation:function(e){if(e.animationFrameRequestId!==null)cancelAnimationFrame(e.animationFrameRequestId),e.animationFrameRequestId=null;return this},resumeAnimation:function(e){if(e.animationFrameRequestId===null)this._animationCycle();return this},_animationCycle(e){if(e.enablePointerInteraction)this.renderer().domElement.style.cursor=null;e.forceGraph.tickFrame(),e.renderObjs.tick(),e.animationFrameRequestId=requestAnimationFrame(this._animationCycle)},scene:(e)=>e.renderObjs.scene(),camera:(e)=>e.renderObjs.camera(),renderer:(e)=>e.renderObjs.renderer(),controls:(e)=>e.renderObjs.controls(),_destructor:function(e){this.pauseAnimation(),this.graphData({nodes:[],links:[]}),e.forceGraph._destructor?.(),e.renderObjs._destructor()},...xC,...SC},stateInit:({controlType:e,rendererConfig:t,extraRenderers:n})=>{let i=new af;return{forceGraph:i,renderObjs:Ad({controlType:e,rendererConfig:t,extraRenderers:n}).objects([i]).lights([new Cd.AmbientLight(13421772,Math.PI),new Cd.DirectionalLight(16777215,0.6*Math.PI)])}},init:function(e,t){e.innerHTML="",e.appendChild(t.container=document.createElement("div")),t.container.style.position="relative";let n=document.createElement("div");t.container.appendChild(n),t.renderObjs(n);let i=t.renderObjs.camera(),r=t.renderObjs.renderer(),s=t.renderObjs.controls();s.enabled=!!t.enableNavigationControls,t.lastSetCameraZ=i.position.z;let o;t.container.appendChild(o=document.createElement("div")),o.className="graph-info-msg",o.textContent="",t.forceGraph.onLoading(()=>{o.textContent="Loading..."}).onFinishLoading(()=>{o.textContent=""}).onUpdate(()=>{if(t.graphData=t.forceGraph.graphData(),i.position.x===0&&i.position.y===0&&i.position.z===t.lastSetCameraZ&&t.graphData.nodes.length)i.lookAt(t.forceGraph.position),t.lastSetCameraZ=i.position.z=Math.cbrt(t.graphData.nodes.length)*vC}).onFinishUpdate(()=>{if(t._dragControls){let a=t.graphData.nodes.find((l)=>l.__initialFixedPos&&!l.__disposeControlsAfterDrag);if(a)a.__disposeControlsAfterDrag=!0;else t._dragControls.dispose();t._dragControls=void 0}if(t.enableNodeDrag&&t.enablePointerInteraction&&t.forceEngine==="d3"){let a=t._dragControls=new Wh(t.graphData.nodes.map((l)=>l.__threeObj).filter((l)=>l),i,r.domElement);a.addEventListener("dragstart",function(l){let c=ci(l.object);if(!c)return;s.enabled=!1,l.object.__initialPos=l.object.position.clone(),l.object.__prevPos=l.object.position.clone();let h=c.__data;!h.__initialFixedPos&&(h.__initialFixedPos={fx:h.fx,fy:h.fy,fz:h.fz}),!h.__initialPos&&(h.__initialPos={x:h.x,y:h.y,z:h.z}),["x","y","z"].forEach((f)=>h[`f${f}`]=h[f]),r.domElement.classList.add("grabbable")}),a.addEventListener("drag",function(l){let c=ci(l.object);if(!c)return;if(!l.object.hasOwnProperty("__graphObjType")){let p=l.object.__initialPos,g=l.object.__prevPos,y=l.object.position;c.position.add(y.clone().sub(g)),g.copy(y),y.copy(p)}let{__data:h,position:f}=c,u={x:f.x-h.x,y:f.y-h.y,z:f.z-h.z};["x","y","z"].forEach((p)=>h[`f${p}`]=h[p]=f[p]),t.forceGraph.d3AlphaTarget(0.3).resetCountdown(),h.__dragged=!0,t.onNodeDrag(h,u)}),a.addEventListener("dragend",function(l){let c=ci(l.object);if(!c)return;delete l.object.__initialPos,delete l.object.__prevPos;let h=c.__data;if(h.__disposeControlsAfterDrag)a.dispose(),delete h.__disposeControlsAfterDrag;let{__initialFixedPos:f,__initialPos:u}=h,p={x:u.x-h.x,y:u.y-h.y,z:u.z-h.z};if(f){if(["x","y","z"].forEach((g)=>{let y=`f${g}`;if(f[y]===void 0)delete h[y]}),delete h.__initialFixedPos,delete h.__initialPos,h.__dragged)delete h.__dragged,t.onNodeDragEnd(h,p)}if(t.forceGraph.d3AlphaTarget(0).resetCountdown(),t.enableNavigationControls)s.enabled=!0,s._status&&s._onPointerCancel?.(),s.domElement&&s.domElement.ownerDocument&&s.domElement.ownerDocument.dispatchEvent(new PointerEvent("pointerup",{pointerType:"touch"}));r.domElement.classList.remove("grabbable")})}}),Cd.REVISION<155&&(t.renderObjs.renderer().useLegacyLights=!1),t.renderObjs.hoverOrderComparator((a,l)=>{let c=ci(a);if(!c)return 1;let h=ci(l);if(!h)return-1;let f=(u)=>u.__graphObjType==="node";return f(h)-f(c)}).tooltipContent((a)=>{let l=ci(a);return l?ze(t[`${l.__graphObjType}Label`])(l.__data)||"":""}).hoverDuringDrag(!1).onHover((a)=>{let l=ci(a);if(l!==t.hoverObj){let c=t.hoverObj?t.hoverObj.__graphObjType:null,h=t.hoverObj?t.hoverObj.__data:null,f=l?l.__graphObjType:null,u=l?l.__data:null;if(c&&c!==f){let p=t[`on${c==="node"?"Node":"Link"}Hover`];p&&p(null,h)}if(f){let p=t[`on${f==="node"?"Node":"Link"}Hover`];p&&p(u,c===f?h:null)}r.domElement.classList[(l&&t[`on${f==="node"?"Node":"Link"}Click`]||!l&&t.onBackgroundClick)&&ze(t.showPointerCursor)(u)?"add":"remove"]("clickable"),t.hoverObj=l}}).clickAfterDrag(!1).onClick((a,l)=>{let c=ci(a);if(c){let h=t[`on${c.__graphObjType==="node"?"Node":"Link"}Click`];h&&h(c.__data,l)}else t.onBackgroundClick&&t.onBackgroundClick(l)}).onRightClick((a,l)=>{let c=ci(a);if(c){let h=t[`on${c.__graphObjType==="node"?"Node":"Link"}RightClick`];h&&h(c.__data,l)}else t.onBackgroundRightClick&&t.onBackgroundRightClick(l)}),this._animationCycle()}});function ci(e){let t=e;while(t&&!t.hasOwnProperty("__graphObjType"))t=t.parent;return t}function Rd(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function wC(e){if(Array.isArray(e))return e}function TC(e){if(Array.isArray(e))return Rd(e)}function EC(e){if(e===void 0)throw ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function AC(e,t,n){return t=Rl(t),UC(e,j0()?Reflect.construct(t,n||[],Rl(e).constructor):t.apply(e,n))}function CC(e,t){if(!(e instanceof t))throw TypeError("Cannot call a class as a function")}function RC(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,BC(i.key),i)}}function PC(e,t,n){return t&&RC(e.prototype,t),Object.defineProperty(e,"prototype",{writable:!1}),e}function Rl(e){return Rl=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(t){return t.__proto__||Object.getPrototypeOf(t)},Rl(e)}function IC(e,t){if(typeof t!="function"&&t!==null)throw TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&Pd(e,t)}function j0(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],function(){}))}catch(t){}return(j0=function(){return!!e})()}function LC(e){if(typeof Symbol<"u"&&e[Symbol.iterator]!=null||e["@@iterator"]!=null)return Array.from(e)}function DC(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0){if(Object(n)!==n)return;l=!1}else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(h){c=!0,r=h}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function NC(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function OC(){throw TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function UC(e,t){if(t&&(typeof t=="object"||typeof t=="function"))return t;if(t!==void 0)throw TypeError("Derived constructors may only return object or undefined");return EC(e)}function Pd(e,t){return Pd=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(n,i){return n.__proto__=i,n},Pd(e,t)}function q0(e,t){return wC(e)||DC(e,t)||Y0(e,t)||NC()}function xo(e){return TC(e)||LC(e)||Y0(e)||OC()}function FC(e,t){if(typeof e!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var i=n.call(e,t);if(typeof i!="object")return i;throw TypeError("@@toPrimitive must return a primitive value.")}return String(e)}function BC(e){var t=FC(e,"string");return typeof t=="symbol"?t:t+""}function Y0(e,t){if(e){if(typeof e=="string")return Rd(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?Rd(e,t):void 0}}var bo=typeof window<"u"&&window.THREE?window.THREE:{CanvasTexture:va,Sprite:ma,SpriteMaterial:Ds,SRGBColorSpace:Or},kC=function(e){function t(){var n,i=arguments.length>0&&arguments[0]!==void 0?arguments[0]:"",r=arguments.length>1&&arguments[1]!==void 0?arguments[1]:10,s=arguments.length>2&&arguments[2]!==void 0?arguments[2]:"rgba(255, 255, 255, 1)";return CC(this,t),n=AC(this,t,[new bo.SpriteMaterial]),n._text="".concat(i),n._textHeight=r,n._color=s,n._backgroundColor=!1,n._padding=0,n._borderWidth=0,n._borderRadius=0,n._borderColor="white",n._offsetX=0,n._offsetY=0,n._strokeWidth=0,n._strokeColor="white",n._fontFace="system-ui",n._fontSize=90,n._fontWeight="normal",n._canvas=document.createElement("canvas"),n._genCanvas(),n}return IC(t,e),PC(t,[{key:"text",get:function(){return this._text},set:function(i){this._text=i,this._genCanvas()}},{key:"textHeight",get:function(){return this._textHeight},set:function(i){this._textHeight=i,this._genCanvas()}},{key:"color",get:function(){return this._color},set:function(i){this._color=i,this._genCanvas()}},{key:"backgroundColor",get:function(){return this._backgroundColor},set:function(i){this._backgroundColor=i,this._genCanvas()}},{key:"padding",get:function(){return this._padding},set:function(i){this._padding=i,this._genCanvas()}},{key:"borderWidth",get:function(){return this._borderWidth},set:function(i){this._borderWidth=i,this._genCanvas()}},{key:"borderRadius",get:function(){return this._borderRadius},set:function(i){this._borderRadius=i,this._genCanvas()}},{key:"borderColor",get:function(){return this._borderColor},set:function(i){this._borderColor=i,this._genCanvas()}},{key:"offsetX",get:function(){return this._offsetX},set:function(i){this._offsetX=i,this._genCanvas()}},{key:"offsetY",get:function(){return this._offsetY},set:function(i){this._offsetY=i,this._genCanvas()}},{key:"fontFace",get:function(){return this._fontFace},set:function(i){this._fontFace=i,this._genCanvas()}},{key:"fontSize",get:function(){return this._fontSize},set:function(i){this._fontSize=i,this._genCanvas()}},{key:"fontWeight",get:function(){return this._fontWeight},set:function(i){this._fontWeight=i,this._genCanvas()}},{key:"strokeWidth",get:function(){return this._strokeWidth},set:function(i){this._strokeWidth=i,this._genCanvas()}},{key:"strokeColor",get:function(){return this._strokeColor},set:function(i){this._strokeColor=i,this._genCanvas()}},{key:"_genCanvas",value:function(){var i=this,r=this._canvas,s=r.getContext("2d"),o=1/this.textHeight,a=Array.isArray(this.borderWidth)?this.borderWidth:[this.borderWidth,this.borderWidth],l=a.map(function(P){return P*i.fontSize*o}),c=Array.isArray(this.borderRadius)?this.borderRadius:[this.borderRadius,this.borderRadius,this.borderRadius,this.borderRadius],h=c.map(function(P){return P*i.fontSize*o}),f=Array.isArray(this.padding)?this.padding:[this.padding,this.padding],u=f.map(function(P){return P*i.fontSize*o}),p=[this.offsetX,this.offsetY].map(function(P){return P*i.fontSize*o}),g=this.text.split(`
`),y="".concat(this.fontWeight," ").concat(this.fontSize,"px ").concat(this.fontFace);s.font=y;var m=Math.max.apply(Math,xo(g.map(function(P){return s.measureText(P).width}))),d=this.fontSize*g.length,b=m+l[0]*2+u[0]*2,S=d+l[1]*2+u[1]*2;if(r.width=b+Math.abs(p[0]),r.height=S+Math.abs(p[1]),s.translate.apply(s,xo(p.map(function(P){return Math.max(0,P)}))),this.borderWidth){if(s.strokeStyle=this.borderColor,l[0]){var _=l[0]/2;s.lineWidth=l[0],s.beginPath(),s.moveTo(_,h[0]),s.lineTo(_,S-h[3]),s.moveTo(b-_,h[1]),s.lineTo(b-_,S-h[2]),s.stroke()}if(l[1]){var x=l[1]/2;s.lineWidth=l[1],s.beginPath(),s.moveTo(Math.max(l[0],h[0]),x),s.lineTo(b-Math.max(l[0],h[1]),x),s.moveTo(Math.max(l[0],h[3]),S-x),s.lineTo(b-Math.max(l[0],h[2]),S-x),s.stroke()}if(this.borderRadius){var w=Math.max.apply(Math,xo(l)),E=w/2;s.lineWidth=w,s.beginPath(),[!!h[0]&&[h[0],E,E,h[0]],!!h[1]&&[b-h[1],b-E,E,h[1]],!!h[2]&&[b-h[2],b-E,S-E,S-h[2]],!!h[3]&&[h[3],E,S-E,S-h[3]]].filter(function(P){return P}).forEach(function(P){var D=q0(P,4),W=D[0],R=D[1],I=D[2],k=D[3];s.moveTo(W,I),s.quadraticCurveTo(R,I,R,k)}),s.stroke()}}if(this.backgroundColor)if(s.fillStyle=this.backgroundColor,!this.borderRadius)s.fillRect(l[0],l[1],b-l[0]*2,S-l[1]*2);else s.beginPath(),s.moveTo(l[0],h[0]),[[l[0],h[0],b-h[1],l[1],l[1],l[1]],[b-l[0],b-l[0],b-l[0],l[1],h[1],S-h[2]],[b-l[0],b-h[2],h[3],S-l[1],S-l[1],S-l[1]],[l[0],l[0],l[0],S-l[1],S-h[3],h[0]]].forEach(function(P){var D=q0(P,6),W=D[0],R=D[1],I=D[2],k=D[3],z=D[4],te=D[5];s.quadraticCurveTo(W,k,R,z),s.lineTo(I,te)}),s.closePath(),s.fill();s.translate.apply(s,xo(l)),s.translate.apply(s,xo(u)),s.font=y,s.fillStyle=this.color,s.textBaseline="bottom";var v=this.strokeWidth>0;if(v)s.lineWidth=this.strokeWidth*this.fontSize/10,s.strokeStyle=this.strokeColor;if(g.forEach(function(P,D){var W=(m-s.measureText(P).width)/2,R=(D+1)*i.fontSize;v&&s.strokeText(P,W,R),s.fillText(P,W,R)}),this.material.map)this.material.map.dispose();var A=this.material.map=new bo.CanvasTexture(r);A.colorSpace=bo.SRGBColorSpace;var N=this.textHeight*g.length+a[1]*2+f[1]*2+Math.abs(this.offsetY);this.scale.set(N*r.width/r.height,N,0)}},{key:"clone",value:function(){return new this.constructor(this.text,this.textHeight,this.color).copy(this)}},{key:"copy",value:function(i){return bo.Sprite.prototype.copy.call(this,i),this.color=i.color,this.backgroundColor=i.backgroundColor,this.padding=i.padding,this.borderWidth=i.borderWidth,this.borderColor=i.borderColor,this.offsetX=i.offsetX,this.offsetY=i.offsetY,this.fontFace=i.fontFace,this.fontSize=i.fontSize,this.fontWeight=i.fontWeight,this.strokeWidth=i.strokeWidth,this.strokeColor=i.strokeColor,this}}])}(bo.Sprite);var $0={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Fe(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};class ns extends wn{constructor(e,t=1,n,i){super();this.strength=t,this.radius=n,this.threshold=i,this.resolution=e!==void 0?new re(e.x,e.y):new re(256,256),this.clearColor=new Fe(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);this.renderTargetBright=new Pt(r,s,{type:qt,depthBuffer:!1}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let c=0;c<this.nMips;c++){let h=new Pt(r,s,{type:qt,depthBuffer:!1});h.texture.name="UnrealBloomPass.h"+c,h.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(h);let f=new Pt(r,s,{type:qt,depthBuffer:!1});f.texture.name="UnrealBloomPass.v"+c,f.texture.generateMipmaps=!1,this.renderTargetsVertical.push(f),r=Math.round(r/2),s=Math.round(s/2)}let o=$0;this.highPassUniforms=si.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=0.01,this.materialHighPassFilter=new Tt({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let a=[6,10,14,18,22];r=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);for(let c=0;c<this.nMips;c++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(a[c])),this.separableBlurMaterials[c].uniforms.invSize.value=new re(1/r,1/s),r=Math.round(r/2),s=Math.round(s/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=0.1;let l=[1,0.8,0.6,0.4,0.2];this.compositeMaterial.uniforms.bloomFactors.value=l,this.bloomTintColors=[new L(1,1,1),new L(1,1,1),new L(1,1,1),new L(1,1,1),new L(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=si.clone(Qr.uniforms),this.blendMaterial=new Tt({uniforms:this.copyUniforms,vertexShader:Qr.vertexShader,fragmentShader:Qr.fragmentShader,premultipliedAlpha:!0,blending:ys,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new Fe,this._oldClearAlpha=1,this._basic=new xi,this._fsQuad=new ir(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),i=Math.round(t/2);this.renderTargetBright.setSize(n,i);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(n,i),this.renderTargetsVertical[r].setSize(n,i),this.separableBlurMaterials[r].uniforms.invSize.value=new re(1/n,1/i),n=Math.round(n/2),i=Math.round(i/2)}render(e,t,n,i,r){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();let s=e.autoClear;if(e.autoClear=!1,e.setClearColor(this.clearColor,0),r)e.state.buffers.stencil.setTest(!1);if(this.renderToScreen)this._fsQuad.material=this._basic,this._basic.map=n.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e);this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let o=this.renderTargetBright;for(let a=0;a<this.nMips;a++)this._fsQuad.material=this.separableBlurMaterials[a],this.separableBlurMaterials[a].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[a].uniforms.direction.value=ns.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[a]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[a].uniforms.colorTexture.value=this.renderTargetsHorizontal[a].texture,this.separableBlurMaterials[a].uniforms.direction.value=ns.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[a]),e.clear(),this._fsQuad.render(e),o=this.renderTargetsVertical[a];if(this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r)e.state.buffers.stencil.setTest(!0);if(this.renderToScreen)e.setRenderTarget(null),this._fsQuad.render(e);else e.setRenderTarget(n),this._fsQuad.render(e);e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=s}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let s=0;s<e;s++)t.push(0.39894*Math.exp(-0.5*s*s/(n*n))/n);let i=[],r=[];for(let s=1;s<e;s+=2){let o=t[s],a=s+1<e?t[s+1]:0,l=o+a;i.push((s*o+(s+1)*a)/l),r.push(l)}return new Tt({defines:{KERNEL_PAIRS:i.length},uniforms:{colorTexture:{value:null},invSize:{value:new re(0.5,0.5)},direction:{value:new re(0.5,0.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:i},gaussianWeights:{value:r}},vertexShader:`

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

				}`})}_getCompositeMaterial(e){return new Tt({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

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

				}`})}}ns.BlurDirectionX=new re(1,0);ns.BlurDirectionY=new re(0,1);var So={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};class Z0 extends wn{constructor(){super();this.isOutputPass=!0,this.uniforms=si.clone(So.uniforms),this.material=new zs({name:So.name,uniforms:this.uniforms,vertexShader:So.vertexShader,fragmentShader:So.fragmentShader}),this._fsQuad=new ir(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){if(this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping){if(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},We.getTransfer(this._outputColorSpace)===at)this.material.defines.SRGB_TRANSFER="";if(this._toneMapping===xs)this.material.defines.LINEAR_TONE_MAPPING="";else if(this._toneMapping===bs)this.material.defines.REINHARD_TONE_MAPPING="";else if(this._toneMapping===Ss)this.material.defines.CINEON_TONE_MAPPING="";else if(this._toneMapping===Ms)this.material.defines.ACES_FILMIC_TONE_MAPPING="";else if(this._toneMapping===Ts)this.material.defines.AGX_TONE_MAPPING="";else if(this._toneMapping===Es)this.material.defines.NEUTRAL_TONE_MAPPING="";else if(this._toneMapping===ws)this.material.defines.CUSTOM_TONE_MAPPING="";this.material.needsUpdate=!0}if(this.renderToScreen===!0)e.setRenderTarget(null),this._fsQuad.render(e);else{if(e.setRenderTarget(t),this.clear)e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil);this._fsQuad.render(e)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}export{cl as EffectComposer,MC as ForceGraph3D,Z0 as OutputPass,hl as RenderPass,kC as SpriteText,ns as UnrealBloomPass};
