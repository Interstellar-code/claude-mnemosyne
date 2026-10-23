/* ui/vendor/map-lib.js: 3d-force-graph and three-spritetext with three, built by scripts/vendor-map.ts. Do not edit; see map-lib.inputs.json and THIRD-PARTY-NOTICES.txt. */
var Q0=Object.create;var{getPrototypeOf:ev,defineProperty:Bd,getOwnPropertyNames:tv}=Object;var kd=Object.prototype.hasOwnProperty;function nv(e){return this[e]}var iv,rv,sv=(e,t,n)=>{var i=e!=null&&typeof e==="object";if(i){var r=t?iv??=new WeakMap:rv??=new WeakMap,s=r.get(e);if(s)return s}n=e!=null?Q0(ev(e)):{};let o=t||!e||!e.__esModule||!kd.call(e,"default")?Bd(n,"default",{value:e,enumerable:!0}):n;if(e&&typeof e==="object"||typeof e==="function"){for(let a of tv(e))if(!kd.call(o,a))Bd(o,a,{get:nv.bind(e,a),enumerable:!0})}if(i)r.set(e,o);return o};var nn=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var Iu=nn(function(GD,Gg){Gg.exports=function(t){if(t===0)return"x";if(t===1)return"y";if(t===2)return"z";return"c"+(t+1)}});var Qi=nn(function(HD,Hg){var yw=Iu();Hg.exports=function(t){return n;function n(i,r){let s=r&&r.indent||0,o=r&&r.join!==void 0?r.join:`
`,a=Array(s+1).join(" "),l=[];for(let c=0;c<t;++c){let h=yw(c),f=c===0?"":a;l.push(f+i.replace(/{var}/g,h))}return l.join(o)}}});var jg=nn(function(VD,Gs){var Vg=Qi();Gs.exports=xw;Gs.exports.generateCreateBodyFunctionBody=Wg;Gs.exports.getVectorCode=qg;Gs.exports.getBodyCode=Xg;function xw(e,t){let n=Wg(e,t),{Body:i}=Function(n)();return i}function Wg(e,t){return`
${qg(e,t)}
${Xg(e,t)}
return {Body: Body, Vector: Vector};
`}function Xg(e){let t=Vg(e),n=t("{var}",{join:", "});return`
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
};`}function qg(e,t){let n=Vg(e),i="";if(t)i=`${n(`
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
  };`}});var e_=nn(function(WD,xi){var Lu=Qi(),yi=Iu();xi.exports=bw;xi.exports.generateQuadTreeFunctionBody=Yg;xi.exports.getInsertStackCode=Qg;xi.exports.getQuadNodeCode=Kg;xi.exports.isSamePosition=$g;xi.exports.getChildBodyCode=Jg;xi.exports.setChildBodyCode=Zg;function bw(e){let t=Yg(e);return Function(t)()}function Yg(e){let t=Lu(e),n=Math.pow(2,e);return`
${Qg()}
${Kg(e)}
${$g(e)}
${Jg(e)}
${Zg(e)}

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
        if ((node.max_${yi(0)} - node.min_${yi(0)}) / r < theta) {
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

`;function r(a){let l=[],c=Array(a+1).join(" ");for(let h=0;h<e;++h)l.push(c+`if (${yi(h)} > max_${yi(h)}) {`),l.push(c+`  quadIdx = quadIdx + ${Math.pow(2,h)};`),l.push(c+`  min_${yi(h)} = max_${yi(h)};`),l.push(c+`  max_${yi(h)} = node.max_${yi(h)};`),l.push(c+"}");return l.join(`
`)}function s(){let a=Array(11).join(" "),l=[];for(let c=0;c<n;++c)l.push(a+`if (node.quad${c}) {`),l.push(a+`  queue[pushIdx] = node.quad${c};`),l.push(a+"  queueLength += 1;"),l.push(a+"  pushIdx += 1;"),l.push(a+"}");return l.join(`
`)}function o(a){let l=[];for(let c=0;c<n;++c)l.push(`${a}quad${c} = null;`);return l.join(`
`)}}function $g(e){let t=Lu(e);return`
  function isSamePosition(point1, point2) {
    ${t("var d{var} = Math.abs(point1.{var} - point2.{var});",{indent:2})}
  
    return ${t("d{var} < 1e-8",{join:" && "})};
  }  
`}function Zg(e){var t=Math.pow(2,e);return`
function setChild(node, idx, child) {
  ${n()}
}`;function n(){let i=[];for(let r=0;r<t;++r){let s=r===0?"  ":"  else ";i.push(`${s}if (idx === ${r}) node.quad${r} = child;`)}return i.join(`
`)}}function Jg(e){return`function getChild(node, idx) {
${t()}
  return null;
}`;function t(){let n=[],i=Math.pow(2,e);for(let r=0;r<i;++r)n.push(`  if (idx === ${r}) return node.quad${r};`);return n.join(`
`)}}function Kg(e){let t=Lu(e),n=Math.pow(2,e);var i=`
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
`)}}function Qg(){return`
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
`}});var n_=nn(function(XD,Du){Du.exports=Mw;Du.exports.generateFunctionBody=t_;var Sw=Qi();function Mw(e){let t=t_(e);return Function("bodies","settings","random",t)}function t_(e){let t=Sw(e);return`
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
`}});var r_=nn(function(qD,Nu){var ww=Qi();Nu.exports=Ew;Nu.exports.generateCreateDragForceFunctionBody=i_;function Ew(e){let t=i_(e);return Function("options",t)}function i_(e){return`
  if (!Number.isFinite(options.dragCoefficient)) throw new Error('dragCoefficient is not a finite number');

  return {
    update: function(body) {
      ${ww(e)("body.force.{var} -= options.dragCoefficient * body.velocity.{var};",{indent:6})}
    }
  };
`}});var o_=nn(function(jD,Ou){var Tw=Qi();Ou.exports=Aw;Ou.exports.generateCreateSpringForceFunctionBody=s_;function Aw(e){let t=s_(e);return Function("options","random",t)}function s_(e){let t=Tw(e);return`
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
`}});var l_=nn(function(YD,Uu){var Cw=Qi();Uu.exports=Rw;Uu.exports.generateIntegratorFunctionBody=a_;function Rw(e){let t=a_(e);return Function("bodies","timeStep","adaptiveTimeStepWeight",t)}function a_(e){let t=Cw(e);return`
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
`}});var h_=nn(function($D,c_){c_.exports=Pw;function Pw(e,t,n,i){this.from=e,this.to=t,this.length=n,this.coefficient=i}});var d_=nn(function(ZD,f_){f_.exports=u_;function u_(e,t){var n;if(!e)e={};if(t){for(n in t)if(t.hasOwnProperty(n)){var i=e.hasOwnProperty(n),r=typeof t[n],s=!i||typeof e[n]!==r;if(s)e[n]=t[n];else if(r==="object")e[n]=u_(e[n],t[n])}}return e}});var Fu=nn(function(JD,p_){function Iw(e){Dw(e);let t=Lw(e);return e.on=t.on,e.off=t.off,e.fire=t.fire,e}function Lw(e){let t=Object.create(null);return{on:function(n,i,r){if(typeof i!="function")throw Error("callback is expected to be a function");let s=t[n];return s||(s=t[n]=[]),s.push({callback:i,ctx:r}),e},off:function(n,i){if(typeof n>"u")return t=Object.create(null),e;if(t[n])if(typeof i!="function")delete t[n];else{let r=t[n];for(let s=0;s<r.length;++s)r[s].callback===i&&r.splice(s,1)}return e},fire:function(n){let i=t[n];if(!i)return e;let r;arguments.length>1&&(r=Array.prototype.slice.call(arguments,1));for(let s=0;s<i.length;++s){let o=i[s];o.callback.apply(o.ctx,r)}return e}}}function Dw(e){if(!e)throw Error("Eventify cannot use falsy object as events subject");let t=["on","fire","off"];for(let n=0;n<t.length;++n)if(e.hasOwnProperty(t[n]))throw Error("Subject cannot be eventified, since it already has property '"+t[n]+"'")}p_.exports=Iw});var g_=nn(function(KD,Da){Da.exports=Bu;Da.exports.random=Bu,Da.exports.randomIterator=Fw;function Bu(e){var t=typeof e==="number"?e:+new Date;return new er(t)}function er(e){this.seed=e}er.prototype.next=Uw;er.prototype.nextDouble=ku;er.prototype.uniform=ku;er.prototype.gaussian=Nw;er.prototype.random=ku;function Nw(){var e,t,n;do t=this.nextDouble()*2-1,n=this.nextDouble()*2-1,e=t*t+n*n;while(e>=1||e===0);return t*Math.sqrt(-2*Math.log(e)/e)}er.prototype.levy=Ow;function Ow(){var e=1.5,t=Math.pow(m_(1+e)*Math.sin(Math.PI*e/2)/(m_((1+e)/2)*e*Math.pow(2,(e-1)/2)),1/e);return this.gaussian()*t/Math.pow(Math.abs(this.gaussian()),1/e)}function m_(e){return Math.sqrt(2*Math.PI/e)*Math.pow(1/Math.E*(e+1/(12*e-1/(10*e))),e)}function ku(){var e=this.seed;return e=e+2127912214+(e<<12)&4294967295,e=(e^3345072700^e>>>19)&4294967295,e=e+374761393+(e<<5)&4294967295,e=(e+3550635116^e<<9)&4294967295,e=e+4251993797+(e<<3)&4294967295,e=(e^3042594569^e>>>16)&4294967295,this.seed=e,(e&268435455)/268435456}function Uw(e){return Math.floor(this.nextDouble()*e)}function Fw(e,t){var n=t||Bu();if(typeof n.next!=="function")throw Error("customRandom does not match expected API: next() function is missing");return{forEach:r,shuffle:i};function i(){var s,o,a;for(s=e.length-1;s>0;--s)o=n.next(s+1),a=e[o],e[o]=e[s],e[s]=a;return e}function r(s){var o,a,l;for(o=e.length-1;o>0;--o)a=n.next(o+1),l=e[a],e[a]=e[o],e[o]=l,s(l);if(e.length)s(e[0])}}});var zu=nn(function(QD,v_){v_.exports=Ww;var Bw=jg(),kw=e_(),zw=n_(),Gw=r_(),Hw=o_(),Vw=l_(),__={};function Ww(e){var t=h_(),n=d_(),i=Fu();if(e){if(e.springCoeff!==void 0)throw Error("springCoeff was renamed to springCoefficient");if(e.dragCoeff!==void 0)throw Error("dragCoeff was renamed to dragCoefficient")}e=n(e,{springLength:10,springCoefficient:0.8,gravity:-12,theta:0.8,dragCoefficient:0.9,timeStep:0.5,adaptiveTimeStepWeight:0,dimensions:2,debug:!1});var r=__[e.dimensions];if(!r){var s=e.dimensions;r={Body:Bw(s,e.debug),createQuadTree:kw(s),createBounds:zw(s),createDragForce:Gw(s),createSpringForce:Hw(s),integrate:Vw(s)},__[s]=r}var o=r.Body,a=r.createQuadTree,l=r.createBounds,c=r.createDragForce,h=r.createSpringForce,f=r.integrate,u=(I)=>new o(I),p=g_().random(42),g=[],y=[],m=a(e,p),d=l(g,e,p),b=h(e,p),S=c(e),_=0,x=[],w=new Map,T=0;N("nbody",W),N("spring",R);var v={bodies:g,quadTree:m,springs:y,settings:e,addForce:N,removeForce:P,getForces:D,step:function(){for(var I=0;I<x.length;++I)x[I](T);var k=f(g,e.timeStep,e.adaptiveTimeStepWeight);return T+=1,k},addBody:function(I){if(!I)throw Error("Body is required");return g.push(I),I},addBodyAt:function(I){if(!I)throw Error("Body position is required");var k=u(I);return g.push(k),k},removeBody:function(I){if(!I)return;var k=g.indexOf(I);if(k<0)return;if(g.splice(k,1),g.length===0)d.reset();return!0},addSpring:function(I,k,z,te){if(!I||!k)throw Error("Cannot add null spring to force simulator");if(typeof z!=="number")z=-1;var Y=new t(I,k,z,te>=0?te:-1);return y.push(Y),Y},getTotalMovement:function(){return _},removeSpring:function(I){if(!I)return;var k=y.indexOf(I);if(k>-1)return y.splice(k,1),!0},getBestNewBodyPosition:function(I){return d.getBestNewPosition(I)},getBBox:A,getBoundingBox:A,invalidateBBox:function(){console.warn("invalidateBBox() is deprecated, bounds always recomputed on `getBBox()` call")},gravity:function(I){if(I!==void 0)return e.gravity=I,m.options({gravity:I}),this;else return e.gravity},theta:function(I){if(I!==void 0)return e.theta=I,m.options({theta:I}),this;else return e.theta},random:p};return Xw(e,v),i(v),v;function A(){return d.update(),d.box}function N(I,k){if(w.has(I))throw Error("Force "+I+" is already added");w.set(I,k),x.push(k)}function P(I){var k=x.indexOf(w.get(I));if(k<0)return;x.splice(k,1),w.delete(I)}function D(){return w}function W(){if(g.length===0)return;m.insertBodies(g);var I=g.length;while(I--){var k=g[I];if(!k.isPinned)k.reset(),m.updateBodyForce(k),S.update(k)}}function R(){var I=y.length;while(I--)b.update(y[I])}}function Xw(e,t){for(var n in e)qw(e,t,n)}function qw(e,t,n){if(!e.hasOwnProperty(n))return;if(typeof t[n]==="function")return;var i=Number.isFinite(e[n]);if(i)t[n]=function(r){if(r!==void 0){if(!Number.isFinite(r))throw Error("Value of "+n+" should be a valid number.");return e[n]=r,t}return e[n]};else t[n]=function(r){if(r!==void 0)return e[n]=r,t;return e[n]}}});var y_=nn(function(eN,Gu){Gu.exports=Yw;Gu.exports.simulator=zu();var jw=Fu();function Yw(e,t){if(!e)throw Error("Graph structure cannot be undefined");var n=t&&t.createSimulator||zu(),i=n(t);if(Array.isArray(t))throw Error("Physics settings is expected to be an object");var r=e.version>19?W:D;if(t&&typeof t.nodeMass==="function")r=t.nodeMass;var s=new Map,o={},a=0,l=i.settings.springTransform||$w;S(),m();var c=!1,h={step:function(){if(a===0)return f(!0),!0;var R=i.step();h.lastMove=R,h.fire("step");var I=R/a,k=I<=0.01;return f(k),k},getNodePosition:function(R){return P(R).pos},setNodePosition:function(R){var I=P(R);I.setPosition.apply(I,Array.prototype.slice.call(arguments,1))},getLinkPosition:function(R){var I=o[R];if(I)return{from:I.from.pos,to:I.to.pos}},getGraphRect:function(){return i.getBBox()},forEachBody:u,pinNode:function(R,I){var k=P(R.id);k.isPinned=!!I},isNodePinned:function(R){return P(R.id).isPinned},dispose:function(){e.off("changed",b),h.fire("disposed")},getBody:y,getSpring:g,getForceVectorLength:p,simulator:i,graph:e,lastMove:0};return jw(h),h;function f(R){if(c!==R)c=R,d(R)}function u(R){s.forEach(R)}function p(){var R=0,I=0;return u(function(k){R+=Math.abs(k.force.x),I+=Math.abs(k.force.y)}),Math.sqrt(R*R+I*I)}function g(R,I){var k;if(I===void 0)if(typeof R!=="object")k=R;else k=R.id;else{var z=e.hasLink(R,I);if(!z)return;k=z.id}return o[k]}function y(R){return s.get(R)}function m(){e.on("changed",b)}function d(R){h.fire("stable",R)}function b(R){for(var I=0;I<R.length;++I){var k=R[I];if(k.changeType==="add"){if(k.node)_(k.node.id);if(k.link)w(k.link)}else if(k.changeType==="remove"){if(k.node)x(k.node);if(k.link)T(k.link)}}a=e.getNodesCount()}function S(){a=0,e.forEachNode(function(R){_(R.id),a+=1}),e.forEachLink(w)}function _(R){var I=s.get(R);if(!I){var k=e.getNode(R);if(!k)throw Error("initBody() was called with unknown node id");var z=k.position;if(!z){var te=v(k);z=i.getBestNewBodyPosition(te)}if(I=i.addBodyAt(z),I.id=R,s.set(R,I),A(R),N(k))I.isPinned=!0}}function x(R){var I=R.id,k=s.get(I);if(k)s.delete(I),i.removeBody(k)}function w(R){A(R.fromId),A(R.toId);var I=s.get(R.fromId),k=s.get(R.toId),z=i.addSpring(I,k,R.length);l(R,z),o[R.id]=z}function T(R){var I=o[R.id];if(I){var k=e.getNode(R.fromId),z=e.getNode(R.toId);if(k)A(k.id);if(z)A(z.id);delete o[R.id],i.removeSpring(I)}}function v(R){var I=[];if(!R.links)return I;var k=Math.min(R.links.length,2);for(var z=0;z<k;++z){var te=R.links[z],Y=te.fromId!==R.id?s.get(te.fromId):s.get(te.toId);if(Y&&Y.pos)I.push(Y)}return I}function A(R){var I=s.get(R);if(I.mass=r(R),Number.isNaN(I.mass))throw Error("Node mass should be a number")}function N(R){return R&&(R.isPinned||R.data&&R.data.isPinned)}function P(R){var I=s.get(R);if(!I)_(R),I=s.get(R);return I}function D(R){var I=e.getLinks(R);if(!I)return 1;return 1+I.length/3}function W(R){var I=e.getLinks(R);if(!I)return 1;return 1+I.size/3}}function $w(){}});var Bo="186",St={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},yn={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},vp=0,Wl=1,yp=2;var ds=1,xp=2,Ar=3,Cr=0,Vt=1,Fn=2,xn=0,ps=1,Xl=2,ql=3,jl=4,bp=5;var Rr=100,Sp=101,Mp=102,wp=103,Ep=104,Tp=200,Ap=201,Cp=202,Rp=203,Pp=204,Ip=205,Lp=206,Dp=207,Np=208,Op=209,Up=210,Fp=211,Bp=212,kp=213,zp=214,Gp=0,Hp=1,Vp=2,Yl=3,Wp=4,Xp=5,qp=6,jp=7,Yp=0,$p=1,Zp=2,Cn=0,$l=1,Zl=2,Jl=3,Kl=4,Ql=5,ec=6,tc=7;var Pr=301,Fi=302,ko=303,zo=304,ms=306,Jp=1000,Go=1001,Kp=1002,gi=1003,Qp=1004;var gs=1005;var on=1006,Ho=1007;var Bi=1008;var Rn=1009,em=1010,tm=1011,_s=1012,nc=1013,_i=1014,ni=1015,bn=1016,ic=1017,rc=1018,Ir=1020,nm=35902,im=35899,rm=1021,sm=1022,Bn=1023,ki=1026,zi=1027,om=1028,sc=1029,Gi=1030,oc=1031;var ac=1033,Vo=33776,Wo=33777,Xo=33778,qo=33779,lc=35840,cc=35841,hc=35842,uc=35843,fc=36196,dc=37492,pc=37496,mc=37488,gc=37489,jo=37490,_c=37491,vc=37808,yc=37809,xc=37810,bc=37811,Sc=37812,Mc=37813,wc=37814,Ec=37815,Tc=37816,Ac=37817,Cc=37818,Rc=37819,Pc=37820,Ic=37821,Lc=36492,Dc=36494,Nc=36495,Oc=36283,Uc=36284,Yo=36285,Fc=36286;var Bc=0,am=1,Hi="",Lr="srgb",kc="srgb-linear",zc="linear",ht="srgb";var lm=512,cm=513,hm=514,$o=515,um=516,fm=517,Zo=518,dm=519;var Gc="300 es",Hc=2000;function ov(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function av(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function wr(e){return document.createElementNS("http://www.w3.org/1999/xhtml",e)}function pm(){let e=wr("canvas");return e.style.display="block",e}var zd={},Er=null;function us(...e){let t="THREE."+e.shift();if(Er)Er("log",t,...e);else console.log(t,...e)}function mm(e){let t=e[0];if(typeof t==="string"&&t.startsWith("TSL:")){let n=e[1];if(n&&n.isStackTrace)e[0]+=" "+n.getLocation();else e[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return e}function Ie(...e){e=mm(e);let t="THREE."+e.shift();if(Er)Er("warn",t,...e);else{let n=e[0];if(n&&n.isStackTrace)console.warn(n.getError(t));else console.warn(t,...e)}}function De(...e){e=mm(e);let t="THREE."+e.shift();if(Er)Er("error",t,...e);else{let n=e[0];if(n&&n.isStackTrace)console.error(n.getError(t));else console.error(t,...e)}}function Ui(...e){let t=e.join(" ");if(t in zd)return;zd[t]=!0,Ie(...e)}function gm(e,t,n){return new Promise(function(i,r){function s(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:r();break;case e.TIMEOUT_EXPIRED:setTimeout(s,n);break;default:i()}}setTimeout(s,n)})}var _m={[0]:1,[2]:6,[4]:7,[3]:5,[1]:0,[6]:2,[7]:4,[5]:3};class kn{addEventListener(e,t){if(this._listeners===void 0)this._listeners={};let n=this._listeners;if(n[e]===void 0)n[e]=[];if(n[e].indexOf(t)===-1)n[e].push(t)}hasEventListener(e,t){let n=this._listeners;if(n===void 0)return!1;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let i=n[e];if(i!==void 0){let r=i.indexOf(t);if(r!==-1)i.splice(r,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let r=0,s=i.length;r<s;r++)i[r].call(this,e);e.target=null}}}var Gt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Gd=1234567,as=Math.PI/180,Tr=180/Math.PI;function Qn(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Gt[e&255]+Gt[e>>8&255]+Gt[e>>16&255]+Gt[e>>24&255]+"-"+Gt[t&255]+Gt[t>>8&255]+"-"+Gt[t>>16&15|64]+Gt[t>>24&255]+"-"+Gt[n&63|128]+Gt[n>>8&255]+"-"+Gt[n>>16&255]+Gt[n>>24&255]+Gt[i&255]+Gt[i>>8&255]+Gt[i>>16&255]+Gt[i>>24&255]).toLowerCase()}function He(e,t,n){return Math.max(t,Math.min(n,e))}function Vc(e,t){return(e%t+t)%t}function lv(e,t,n,i,r){return i+(e-t)*(r-i)/(n-t)}function cv(e,t,n){if(e!==t)return(n-e)/(t-e);else return 0}function ls(e,t,n){return(1-n)*e+n*t}function hv(e,t,n,i){return ls(e,t,1-Math.exp(-n*i))}function uv(e,t=1){return t-Math.abs(Vc(e,t*2)-t)}function fv(e,t,n){if(e<=t)return 0;if(e>=n)return 1;return e=(e-t)/(n-t),e*e*(3-2*e)}function dv(e,t,n){if(e<=t)return 0;if(e>=n)return 1;return e=(e-t)/(n-t),e*e*e*(e*(e*6-15)+10)}function pv(e,t){return e+Math.floor(Math.random()*(t-e+1))}function mv(e,t){return e+Math.random()*(t-e)}function gv(e){return e*(0.5-Math.random())}function _v(e){if(e!==void 0)Gd=e;let t=Gd+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function vv(e){return e*as}function yv(e){return e*Tr}function xv(e){return e>0&&Number.isInteger(e)&&2**Math.round(Math.log2(e))===e}function bv(e){return Math.pow(2,Math.ceil(Math.log(e)/Math.LN2))}function Sv(e){return Math.pow(2,Math.floor(Math.log(e)/Math.LN2))}function Mv(e,t,n,i,r){let{cos:s,sin:o}=Math,a=s(n/2),l=o(n/2),c=s((t+i)/2),h=o((t+i)/2),f=s((t-i)/2),u=o((t-i)/2),p=s((i-t)/2),g=o((i-t)/2);switch(r){case"XYX":e.set(a*h,l*f,l*u,a*c);break;case"YZY":e.set(l*u,a*h,l*f,a*c);break;case"ZXZ":e.set(l*f,l*u,a*h,a*c);break;case"XZX":e.set(a*h,l*g,l*p,a*c);break;case"YXY":e.set(l*p,a*h,l*g,a*c);break;case"ZYZ":e.set(l*g,l*p,a*h,a*c);break;default:Ie("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function An(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:case Uint8ClampedArray:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw Error("THREE.MathUtils: Invalid component type.")}}function st(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw Error("THREE.MathUtils: Invalid component type.")}}var Dr={DEG2RAD:as,RAD2DEG:Tr,generateUUID:Qn,clamp:He,euclideanModulo:Vc,mapLinear:lv,inverseLerp:cv,lerp:ls,damp:hv,pingpong:uv,smoothstep:fv,smootherstep:dv,randInt:pv,randFloat:mv,randFloatSpread:gv,seededRandom:_v,degToRad:vv,radToDeg:yv,isPowerOfTwo:xv,ceilPowerOfTwo:bv,floorPowerOfTwo:Sv,setQuaternionFromProperEuler:Mv,normalize:st,denormalize:An};class se{static{se.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),r=this.x-e.x,s=this.y-e.y;return this.x=r*n-s*i+e.x,this.y=r*i+s*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Ft{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,r,s,o){let a=n[i+0],l=n[i+1],c=n[i+2],h=n[i+3],f=r[s+0],u=r[s+1],p=r[s+2],g=r[s+3];if(h!==g||a!==f||l!==u||c!==p){let y=a*f+l*u+c*p+h*g;if(y<0)f=-f,u=-u,p=-p,g=-g,y=-y;let m=1-o;if(y<0.9995){let d=Math.acos(y),b=Math.sin(d);m=Math.sin(m*d)/b,o=Math.sin(o*d)/b,a=a*m+f*o,l=l*m+u*o,c=c*m+p*o,h=h*m+g*o}else{a=a*m+f*o,l=l*m+u*o,c=c*m+p*o,h=h*m+g*o;let d=1/Math.sqrt(a*a+l*l+c*c+h*h);a*=d,l*=d,c*=d,h*=d}}e[t]=a,e[t+1]=l,e[t+2]=c,e[t+3]=h}static multiplyQuaternionsFlat(e,t,n,i,r,s){let o=n[i],a=n[i+1],l=n[i+2],c=n[i+3],h=r[s],f=r[s+1],u=r[s+2],p=r[s+3];return e[t]=o*p+c*h+a*u-l*f,e[t+1]=a*p+c*f+l*h-o*u,e[t+2]=l*p+c*u+o*f-a*h,e[t+3]=c*p-o*h-a*f-l*u,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let{_x:n,_y:i,_z:r,_order:s}=e,{cos:o,sin:a}=Math,l=o(n/2),c=o(i/2),h=o(r/2),f=a(n/2),u=a(i/2),p=a(r/2);switch(s){case"XYZ":this._x=f*c*h+l*u*p,this._y=l*u*h-f*c*p,this._z=l*c*p+f*u*h,this._w=l*c*h-f*u*p;break;case"YXZ":this._x=f*c*h+l*u*p,this._y=l*u*h-f*c*p,this._z=l*c*p-f*u*h,this._w=l*c*h+f*u*p;break;case"ZXY":this._x=f*c*h-l*u*p,this._y=l*u*h+f*c*p,this._z=l*c*p+f*u*h,this._w=l*c*h-f*u*p;break;case"ZYX":this._x=f*c*h-l*u*p,this._y=l*u*h+f*c*p,this._z=l*c*p-f*u*h,this._w=l*c*h+f*u*p;break;case"YZX":this._x=f*c*h+l*u*p,this._y=l*u*h+f*c*p,this._z=l*c*p-f*u*h,this._w=l*c*h-f*u*p;break;case"XZY":this._x=f*c*h-l*u*p,this._y=l*u*h-f*c*p,this._z=l*c*p+f*u*h,this._w=l*c*h+f*u*p;break;default:Ie("Quaternion: .setFromEuler() encountered an unknown order: "+s)}if(t===!0)this._onChangeCallback();return this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],r=t[8],s=t[1],o=t[5],a=t[9],l=t[2],c=t[6],h=t[10],f=n+o+h;if(f>0){let u=0.5/Math.sqrt(f+1);this._w=0.25/u,this._x=(c-a)*u,this._y=(r-l)*u,this._z=(s-i)*u}else if(n>o&&n>h){let u=2*Math.sqrt(1+n-o-h);this._w=(c-a)/u,this._x=0.25*u,this._y=(i+s)/u,this._z=(r+l)/u}else if(o>h){let u=2*Math.sqrt(1+o-n-h);this._w=(r-l)/u,this._x=(i+s)/u,this._y=0.25*u,this._z=(a+c)/u}else{let u=2*Math.sqrt(1+h-n-o);this._w=(s-i)/u,this._x=(r+l)/u,this._y=(a+c)/u,this._z=0.25*u}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;if(n<0.00000001)if(n=0,Math.abs(e.x)>Math.abs(e.z))this._x=-e.y,this._y=e.x,this._z=0,this._w=n;else this._x=0,this._y=-e.z,this._z=e.y,this._w=n;else this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n;return this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(He(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();if(e===0)this._x=0,this._y=0,this._z=0,this._w=1;else e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e;return this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let{_x:n,_y:i,_z:r,_w:s}=e,{_x:o,_y:a,_z:l,_w:c}=t;return this._x=n*c+s*o+i*l-r*a,this._y=i*c+s*a+r*o-n*l,this._z=r*c+s*l+n*a-i*o,this._w=s*c-n*o-i*a-r*l,this._onChangeCallback(),this}slerp(e,t){let{_x:n,_y:i,_z:r,_w:s}=e,o=this.dot(e);if(o<0)n=-n,i=-i,r=-r,s=-s,o=-o;let a=1-t;if(o<0.9995){let l=Math.acos(o),c=Math.sin(l);a=Math.sin(a*l)/c,t=Math.sin(t*l)/c,this._x=this._x*a+n*t,this._y=this._y*a+i*t,this._z=this._z*a+r*t,this._w=this._w*a+s*t,this._onChangeCallback()}else this._x=this._x*a+n*t,this._y=this._y*a+i*t,this._z=this._z*a+r*t,this._w=this._w*a+s*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class L{static{L.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){if(n===void 0)n=this.z;return this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Hd.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Hd.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*i,this.y=r[1]*t+r[4]*n+r[7]*i,this.z=r[2]*t+r[5]*n+r[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=e.elements,s=1/(r[3]*t+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*i+r[12])*s,this.y=(r[1]*t+r[5]*n+r[9]*i+r[13])*s,this.z=(r[2]*t+r[6]*n+r[10]*i+r[14])*s,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,{x:r,y:s,z:o,w:a}=e,l=2*(s*i-o*n),c=2*(o*t-r*i),h=2*(r*n-s*t);return this.x=t+a*l+s*h-o*c,this.y=n+a*c+o*l-r*h,this.z=i+a*h+r*c-s*l,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*i,this.y=r[1]*t+r[5]*n+r[9]*i,this.z=r[2]*t+r[6]*n+r[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let{x:n,y:i,z:r}=e,{x:s,y:o,z:a}=t;return this.x=i*a-r*o,this.y=r*s-n*a,this.z=n*o-i*s,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return _l.copy(this).projectOnVector(e),this.sub(_l)}reflect(e){return this.sub(_l.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}var _l=new L,Hd=new Ft;class Fe{static{Fe.prototype.isMatrix3=!0}constructor(e,t,n,i,r,s,o,a,l){if(this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0)this.set(e,t,n,i,r,s,o,a,l)}set(e,t,n,i,r,s,o,a,l){let c=this.elements;return c[0]=e,c[1]=i,c[2]=o,c[3]=t,c[4]=r,c[5]=a,c[6]=n,c[7]=s,c[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,s=n[0],o=n[3],a=n[6],l=n[1],c=n[4],h=n[7],f=n[2],u=n[5],p=n[8],g=i[0],y=i[3],m=i[6],d=i[1],b=i[4],S=i[7],_=i[2],x=i[5],w=i[8];return r[0]=s*g+o*d+a*_,r[3]=s*y+o*b+a*x,r[6]=s*m+o*S+a*w,r[1]=l*g+c*d+h*_,r[4]=l*y+c*b+h*x,r[7]=l*m+c*S+h*w,r[2]=f*g+u*d+p*_,r[5]=f*y+u*b+p*x,r[8]=f*m+u*S+p*w,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],s=e[4],o=e[5],a=e[6],l=e[7],c=e[8];return t*s*c-t*o*l-n*r*c+n*o*a+i*r*l-i*s*a}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],s=e[4],o=e[5],a=e[6],l=e[7],c=e[8],h=c*s-o*l,f=o*a-c*r,u=l*r-s*a,p=t*h+n*f+i*u;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let g=1/p;return e[0]=h*g,e[1]=(i*l-c*n)*g,e[2]=(o*n-i*s)*g,e[3]=f*g,e[4]=(c*t-i*a)*g,e[5]=(i*r-o*t)*g,e[6]=u*g,e[7]=(n*a-l*t)*g,e[8]=(s*t-n*r)*g,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,r,s,o){let a=Math.cos(r),l=Math.sin(r);return this.set(n*a,n*l,-n*(a*s+l*o)+s+e,-i*l,i*a,-i*(-l*s+a*o)+o+t,0,0,1),this}scale(e,t){return Ui("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(vl.makeScale(e,t)),this}rotate(e){return Ui("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(vl.makeRotation(-e)),this}translate(e,t){return Ui("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(vl.makeTranslation(e,t)),this}makeTranslation(e,t){if(e.isVector2)this.set(1,0,e.x,0,1,e.y,0,0,1);else this.set(1,0,e,0,1,t,0,0,1);return this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}var vl=new Fe,Vd=new Fe().set(0.4123908,0.3575843,0.1804808,0.212639,0.7151687,0.0721923,0.0193308,0.1191948,0.9505322),Wd=new Fe().set(3.2409699,-1.5373832,-0.4986108,-0.9692436,1.8759675,0.0415551,0.0556301,-0.203977,1.0569715);function wv(){let e={enabled:!0,workingColorSpace:"srgb-linear",spaces:{},convert:function(r,s,o){if(this.enabled===!1||s===o||!s||!o)return r;if(this.spaces[s].transfer==="srgb")r.r=ei(r.r),r.g=ei(r.g),r.b=ei(r.b);if(this.spaces[s].primaries!==this.spaces[o].primaries)r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[o].fromXYZ);if(this.spaces[o].transfer==="srgb")r.r=Mr(r.r),r.g=Mr(r.g),r.b=Mr(r.b);return r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){if(r==="")return"linear";return this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,o){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Ui("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),e.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Ui("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),e.colorSpaceToWorking(r,s)}},t=[0.64,0.33,0.3,0.6,0.15,0.06],n=[0.2126,0.7152,0.0722],i=[0.3127,0.329];return e.define({["srgb-linear"]:{primaries:t,whitePoint:i,transfer:"linear",toXYZ:Vd,fromXYZ:Wd,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:"srgb"},outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}},["srgb"]:{primaries:t,whitePoint:i,transfer:"srgb",toXYZ:Vd,fromXYZ:Wd,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}}}),e}var qe=wv();function ei(e){return e<0.04045?e*0.0773993808:Math.pow(e*0.9478672986+0.0521327014,2.4)}function Mr(e){return e<0.0031308?e*12.92:1.055*Math.pow(e,0.41666)-0.055}var sr;class Wc{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src))return e.src;if(typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{if(sr===void 0)sr=wr("canvas");sr.width=e.width,sr.height=e.height;let i=sr.getContext("2d");if(e instanceof ImageData)i.putImageData(e,0,0);else i.drawImage(e,0,0,e.width,e.height);n=sr}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=wr("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let i=n.getImageData(0,0,e.width,e.height),r=i.data;for(let s=0;s<r.length;s++)r[s]=ei(r[s]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)if(t instanceof Uint8Array||t instanceof Uint8ClampedArray)t[n]=Math.floor(ei(t[n]/255)*255);else t[n]=ei(t[n]);return{data:t,width:e.width,height:e.height}}else return Ie("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}var Ev=0;class vs{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Ev++}),this.uuid=Qn(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;if(typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement)e.set(t.videoWidth,t.videoHeight,0);else if(typeof VideoFrame<"u"&&t instanceof VideoFrame)e.set(t.displayWidth,t.displayHeight,0);else if(t!==null)e.set(t.width,t.height,t.depth||0);else e.set(0,0,0);return e}set needsUpdate(e){if(e===!0)this.version++}toJSON(e){let t=e===void 0||typeof e==="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let s=0,o=i.length;s<o;s++)if(i[s].isDataTexture)r.push(yl(i[s].image));else r.push(yl(i[s]))}else r=yl(i);n.url=r}if(!t)e.images[this.uuid]=n;return n}}function yl(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap)return Wc.getDataURL(e);else if(e.data)return{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name};else return Ie("Texture: Unable to serialize Texture."),{}}var Tv=0,xl=new L;class Ot extends kn{constructor(e=Ot.DEFAULT_IMAGE,t=Ot.DEFAULT_MAPPING,n=1001,i=1001,r=1006,s=1008,o=1023,a=1009,l=Ot.DEFAULT_ANISOTROPY,c=""){super();this.isTexture=!0,Object.defineProperty(this,"id",{value:Tv++}),this.uuid=Qn(),this.name="",this.source=new vs(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=s,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=a,this.offset=new se(0,0),this.repeat=new se(1,1),this.center=new se(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Fe,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=c,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=e&&e.depth&&e.depth>1?!0:!1,this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(xl).x}get height(){return this.source.getSize(xl).y}get depth(){return this.source.getSize(xl).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){Ie(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){Ie(`Texture.setValues(): property '${t}' does not exist.`);continue}if(i&&n&&(i.isVector2&&n.isVector2))i.copy(n);else if(i&&n&&(i.isVector3&&n.isVector3))i.copy(n);else if(i&&n&&(i.isMatrix3&&n.isMatrix3))i.copy(n);else this[t]=n}}toJSON(e){let t=e===void 0||typeof e==="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};if(Object.keys(this.userData).length>0)n.userData=this.userData;if(!t)e.textures[this.uuid]=n;return n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==300)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case 1000:e.x=e.x-Math.floor(e.x);break;case 1001:e.x=e.x<0?0:1;break;case 1002:if(Math.abs(Math.floor(e.x)%2)===1)e.x=Math.ceil(e.x)-e.x;else e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case 1000:e.y=e.y-Math.floor(e.y);break;case 1001:e.y=e.y<0?0:1;break;case 1002:if(Math.abs(Math.floor(e.y)%2)===1)e.y=Math.ceil(e.y)-e.y;else e.y=e.y-Math.floor(e.y);break}if(this.flipY)e.y=1-e.y;return e}set needsUpdate(e){if(e===!0)this.version++,this.source.needsUpdate=!0}set needsPMREMUpdate(e){if(e===!0)this.pmremVersion++}}Ot.DEFAULT_IMAGE=null;Ot.DEFAULT_MAPPING=300;Ot.DEFAULT_ANISOTROPY=1;class gt{static{gt.prototype.isVector4=!0}constructor(e=0,t=0,n=0,i=1){this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=this.w,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*i+s[12]*r,this.y=s[1]*t+s[5]*n+s[9]*i+s[13]*r,this.z=s[2]*t+s[6]*n+s[10]*i+s[14]*r,this.w=s[3]*t+s[7]*n+s[11]*i+s[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);if(t<0.0001)this.x=1,this.y=0,this.z=0;else this.x=e.x/t,this.y=e.y/t,this.z=e.z/t;return this}setAxisAngleFromRotationMatrix(e){let t,n,i,r,s=0.01,o=0.1,a=e.elements,l=a[0],c=a[4],h=a[8],f=a[1],u=a[5],p=a[9],g=a[2],y=a[6],m=a[10];if(Math.abs(c-f)<0.01&&Math.abs(h-g)<0.01&&Math.abs(p-y)<0.01){if(Math.abs(c+f)<0.1&&Math.abs(h+g)<0.1&&Math.abs(p+y)<0.1&&Math.abs(l+u+m-3)<0.1)return this.set(1,0,0,0),this;t=Math.PI;let b=(l+1)/2,S=(u+1)/2,_=(m+1)/2,x=(c+f)/4,w=(h+g)/4,T=(p+y)/4;if(b>S&&b>_)if(b<0.01)n=0,i=0.707106781,r=0.707106781;else n=Math.sqrt(b),i=x/n,r=w/n;else if(S>_)if(S<0.01)n=0.707106781,i=0,r=0.707106781;else i=Math.sqrt(S),n=x/i,r=T/i;else if(_<0.01)n=0.707106781,i=0.707106781,r=0;else r=Math.sqrt(_),n=w/r,i=T/r;return this.set(n,i,r,t),this}let d=Math.sqrt((y-p)*(y-p)+(h-g)*(h-g)+(f-c)*(f-c));if(Math.abs(d)<0.001)d=1;return this.x=(y-p)/d,this.y=(h-g)/d,this.z=(f-c)/d,this.w=Math.acos((l+u+m-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this.w=He(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this.w=He(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Xc extends kn{constructor(e=1,t=1,n={}){super();n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:1006,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new gt(0,0,e,t),this.scissorTest=!1,this.viewport=new gt(0,0,e,t),this.textures=[];let i={width:e,height:t,depth:n.depth},r=new Ot(i),s=n.count;for(let o=0;o<s;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:1006,generateMipmaps:!1,flipY:!1,internalFormat:null};if(e.mapping!==void 0)t.mapping=e.mapping;if(e.wrapS!==void 0)t.wrapS=e.wrapS;if(e.wrapT!==void 0)t.wrapT=e.wrapT;if(e.wrapR!==void 0)t.wrapR=e.wrapR;if(e.magFilter!==void 0)t.magFilter=e.magFilter;if(e.minFilter!==void 0)t.minFilter=e.minFilter;if(e.format!==void 0)t.format=e.format;if(e.type!==void 0)t.type=e.type;if(e.anisotropy!==void 0)t.anisotropy=e.anisotropy;if(e.colorSpace!==void 0)t.colorSpace=e.colorSpace;if(e.flipY!==void 0)t.flipY=e.flipY;if(e.generateMipmaps!==void 0)t.generateMipmaps=e.generateMipmaps;if(e.internalFormat!==void 0)t.internalFormat=e.internalFormat;for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){if(this._depthTexture!==null&&this._depthTexture.renderTarget===this)this._depthTexture.renderTarget=null;if(e!==null&&e.renderTarget===null)e.renderTarget=this;this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,r=this.textures.length;i<r;i++)if(this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n,this.textures[i].isData3DTexture!==!0)this.textures[i].isArrayTexture=this.textures[i].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let i=Object.assign({},e.textures[t].image);this.textures[t].source=new vs(i)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Zt extends Xc{constructor(e=1,t=1,n={}){super(e,t,n);this.isWebGLRenderTarget=!0}}class Jo extends Ot{constructor(e=null,t=1,n=1,i=1){super(null);this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class qc extends Ot{constructor(e=null,t=1,n=1,i=1){super(null);this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}}class Ke{static{Ke.prototype.isMatrix4=!0}constructor(e,t,n,i,r,s,o,a,l,c,h,f,u,p,g,y){if(this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0)this.set(e,t,n,i,r,s,o,a,l,c,h,f,u,p,g,y)}set(e,t,n,i,r,s,o,a,l,c,h,f,u,p,g,y){let m=this.elements;return m[0]=e,m[4]=t,m[8]=n,m[12]=i,m[1]=r,m[5]=s,m[9]=o,m[13]=a,m[2]=l,m[6]=c,m[10]=h,m[14]=f,m[3]=u,m[7]=p,m[11]=g,m[15]=y,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Ke().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){if(this.determinantAffine()===0)return e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this;return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,i=1/or.setFromMatrixColumn(e,0).length(),r=1/or.setFromMatrixColumn(e,1).length(),s=1/or.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*s,t[9]=n[9]*s,t[10]=n[10]*s,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,{x:n,y:i,z:r}=e,s=Math.cos(n),o=Math.sin(n),a=Math.cos(i),l=Math.sin(i),c=Math.cos(r),h=Math.sin(r);if(e.order==="XYZ"){let f=s*c,u=s*h,p=o*c,g=o*h;t[0]=a*c,t[4]=-a*h,t[8]=l,t[1]=u+p*l,t[5]=f-g*l,t[9]=-o*a,t[2]=g-f*l,t[6]=p+u*l,t[10]=s*a}else if(e.order==="YXZ"){let f=a*c,u=a*h,p=l*c,g=l*h;t[0]=f+g*o,t[4]=p*o-u,t[8]=s*l,t[1]=s*h,t[5]=s*c,t[9]=-o,t[2]=u*o-p,t[6]=g+f*o,t[10]=s*a}else if(e.order==="ZXY"){let f=a*c,u=a*h,p=l*c,g=l*h;t[0]=f-g*o,t[4]=-s*h,t[8]=p+u*o,t[1]=u+p*o,t[5]=s*c,t[9]=g-f*o,t[2]=-s*l,t[6]=o,t[10]=s*a}else if(e.order==="ZYX"){let f=s*c,u=s*h,p=o*c,g=o*h;t[0]=a*c,t[4]=p*l-u,t[8]=f*l+g,t[1]=a*h,t[5]=g*l+f,t[9]=u*l-p,t[2]=-l,t[6]=o*a,t[10]=s*a}else if(e.order==="YZX"){let f=s*a,u=s*l,p=o*a,g=o*l;t[0]=a*c,t[4]=g-f*h,t[8]=p*h+u,t[1]=h,t[5]=s*c,t[9]=-o*c,t[2]=-l*c,t[6]=u*h+p,t[10]=f-g*h}else if(e.order==="XZY"){let f=s*a,u=s*l,p=o*a,g=o*l;t[0]=a*c,t[4]=-h,t[8]=l*c,t[1]=f*h+g,t[5]=s*c,t[9]=u*h-p,t[2]=p*h-u,t[6]=o*c,t[10]=g*h+f}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Av,e,Cv)}lookAt(e,t,n){let i=this.elements;if(hn.subVectors(e,t),hn.lengthSq()===0)hn.z=1;if(hn.normalize(),ui.crossVectors(n,hn),ui.lengthSq()===0){if(Math.abs(n.z)===1)hn.x+=0.0001;else hn.z+=0.0001;hn.normalize(),ui.crossVectors(n,hn)}return ui.normalize(),ho.crossVectors(hn,ui),i[0]=ui.x,i[4]=ho.x,i[8]=hn.x,i[1]=ui.y,i[5]=ho.y,i[9]=hn.y,i[2]=ui.z,i[6]=ho.z,i[10]=hn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,s=n[0],o=n[4],a=n[8],l=n[12],c=n[1],h=n[5],f=n[9],u=n[13],p=n[2],g=n[6],y=n[10],m=n[14],d=n[3],b=n[7],S=n[11],_=n[15],x=i[0],w=i[4],T=i[8],v=i[12],A=i[1],N=i[5],P=i[9],D=i[13],W=i[2],R=i[6],I=i[10],k=i[14],z=i[3],te=i[7],Y=i[11],Q=i[15];return r[0]=s*x+o*A+a*W+l*z,r[4]=s*w+o*N+a*R+l*te,r[8]=s*T+o*P+a*I+l*Y,r[12]=s*v+o*D+a*k+l*Q,r[1]=c*x+h*A+f*W+u*z,r[5]=c*w+h*N+f*R+u*te,r[9]=c*T+h*P+f*I+u*Y,r[13]=c*v+h*D+f*k+u*Q,r[2]=p*x+g*A+y*W+m*z,r[6]=p*w+g*N+y*R+m*te,r[10]=p*T+g*P+y*I+m*Y,r[14]=p*v+g*D+y*k+m*Q,r[3]=d*x+b*A+S*W+_*z,r[7]=d*w+b*N+S*R+_*te,r[11]=d*T+b*P+S*I+_*Y,r[15]=d*v+b*D+S*k+_*Q,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[12],s=e[1],o=e[5],a=e[9],l=e[13],c=e[2],h=e[6],f=e[10],u=e[14],p=e[3],g=e[7],y=e[11],m=e[15],d=a*u-l*f,b=o*u-l*h,S=o*f-a*h,_=s*u-l*c,x=s*f-a*c,w=s*h-o*c;return t*(g*d-y*b+m*S)-n*(p*d-y*_+m*x)+i*(p*b-g*_+m*w)-r*(p*S-g*x+y*w)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[1],s=e[5],o=e[9],a=e[2],l=e[6],c=e[10];return t*(s*c-o*l)-n*(r*c-o*a)+i*(r*l-s*a)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;if(e.isVector3)i[12]=e.x,i[13]=e.y,i[14]=e.z;else i[12]=e,i[13]=t,i[14]=n;return this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],s=e[4],o=e[5],a=e[6],l=e[7],c=e[8],h=e[9],f=e[10],u=e[11],p=e[12],g=e[13],y=e[14],m=e[15],d=t*o-n*s,b=t*a-i*s,S=t*l-r*s,_=n*a-i*o,x=n*l-r*o,w=i*l-r*a,T=c*g-h*p,v=c*y-f*p,A=c*m-u*p,N=h*y-f*g,P=h*m-u*g,D=f*m-u*y,W=d*D-b*P+S*N+_*A-x*v+w*T;if(W===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let R=1/W;return e[0]=(o*D-a*P+l*N)*R,e[1]=(i*P-n*D-r*N)*R,e[2]=(g*w-y*x+m*_)*R,e[3]=(f*x-h*w-u*_)*R,e[4]=(a*A-s*D-l*v)*R,e[5]=(t*D-i*A+r*v)*R,e[6]=(y*S-p*w-m*b)*R,e[7]=(c*w-f*S+u*b)*R,e[8]=(s*P-o*A+l*T)*R,e[9]=(n*A-t*P-r*T)*R,e[10]=(p*x-g*S+m*d)*R,e[11]=(h*S-c*x-u*d)*R,e[12]=(o*v-s*N-a*T)*R,e[13]=(t*N-n*v+i*T)*R,e[14]=(g*b-p*_-y*d)*R,e[15]=(c*_-h*b+f*d)*R,this}scale(e){let t=this.elements,{x:n,y:i,z:r}=e;return t[0]*=n,t[4]*=i,t[8]*=r,t[1]*=n,t[5]*=i,t[9]*=r,t[2]*=n,t[6]*=i,t[10]*=r,t[3]*=n,t[7]*=i,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){if(e.isVector3)this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1);else this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1);return this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),r=1-n,{x:s,y:o,z:a}=e,l=r*s,c=r*o;return this.set(l*s+n,l*o-i*a,l*a+i*o,0,l*o+i*a,c*o+n,c*a-i*s,0,l*a-i*o,c*a+i*s,r*a*a+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,r,s){return this.set(1,n,r,0,e,1,s,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,{_x:r,_y:s,_z:o,_w:a}=t,l=r+r,c=s+s,h=o+o,f=r*l,u=r*c,p=r*h,g=s*c,y=s*h,m=o*h,d=a*l,b=a*c,S=a*h,{x:_,y:x,z:w}=n;return i[0]=(1-(g+m))*_,i[1]=(u+S)*_,i[2]=(p-b)*_,i[3]=0,i[4]=(u-S)*x,i[5]=(1-(f+m))*x,i[6]=(y+d)*x,i[7]=0,i[8]=(p+b)*w,i[9]=(y-d)*w,i[10]=(1-(f+g))*w,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements;e.x=i[12],e.y=i[13],e.z=i[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),t.identity(),this;let s=or.set(i[0],i[1],i[2]).length(),o=or.set(i[4],i[5],i[6]).length(),a=or.set(i[8],i[9],i[10]).length();if(r<0)s=-s;wn.copy(this);let l=1/s,c=1/o,h=1/a;return wn.elements[0]*=l,wn.elements[1]*=l,wn.elements[2]*=l,wn.elements[4]*=c,wn.elements[5]*=c,wn.elements[6]*=c,wn.elements[8]*=h,wn.elements[9]*=h,wn.elements[10]*=h,t.setFromRotationMatrix(wn),n.x=s,n.y=o,n.z=a,this}makePerspective(e,t,n,i,r,s,o=2000,a=!1){let l=this.elements,c=2*r/(t-e),h=2*r/(n-i),f=(t+e)/(t-e),u=(n+i)/(n-i),p,g;if(a)p=r/(s-r),g=s*r/(s-r);else if(o===2000)p=-(s+r)/(s-r),g=-2*s*r/(s-r);else if(o===2001)p=-s/(s-r),g=-s*r/(s-r);else throw Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=f,l[12]=0,l[1]=0,l[5]=h,l[9]=u,l[13]=0,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,i,r,s,o=2000,a=!1){let l=this.elements,c=2/(t-e),h=2/(n-i),f=-(t+e)/(t-e),u=-(n+i)/(n-i),p,g;if(a)p=1/(s-r),g=s/(s-r);else if(o===2000)p=-2/(s-r),g=-(s+r)/(s-r);else if(o===2001)p=-1/(s-r),g=-r/(s-r);else throw Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=c,l[4]=0,l[8]=0,l[12]=f,l[1]=0,l[5]=h,l[9]=0,l[13]=u,l[2]=0,l[6]=0,l[10]=p,l[14]=g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}var or=new L,wn=new Ke,Av=new L(0,0,0),Cv=new L(1,1,1),ui=new L,ho=new L,hn=new L,Xd=new Ke,qd=new Ft;class ti{constructor(e=0,t=0,n=0,i=ti.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let i=e.elements,r=i[0],s=i[4],o=i[8],a=i[1],l=i[5],c=i[9],h=i[2],f=i[6],u=i[10];switch(t){case"XYZ":if(this._y=Math.asin(He(o,-1,1)),Math.abs(o)<0.9999999)this._x=Math.atan2(-c,u),this._z=Math.atan2(-s,r);else this._x=Math.atan2(f,l),this._z=0;break;case"YXZ":if(this._x=Math.asin(-He(c,-1,1)),Math.abs(c)<0.9999999)this._y=Math.atan2(o,u),this._z=Math.atan2(a,l);else this._y=Math.atan2(-h,r),this._z=0;break;case"ZXY":if(this._x=Math.asin(He(f,-1,1)),Math.abs(f)<0.9999999)this._y=Math.atan2(-h,u),this._z=Math.atan2(-s,l);else this._y=0,this._z=Math.atan2(a,r);break;case"ZYX":if(this._y=Math.asin(-He(h,-1,1)),Math.abs(h)<0.9999999)this._x=Math.atan2(f,u),this._z=Math.atan2(a,r);else this._x=0,this._z=Math.atan2(-s,l);break;case"YZX":if(this._z=Math.asin(He(a,-1,1)),Math.abs(a)<0.9999999)this._x=Math.atan2(-c,l),this._y=Math.atan2(-h,r);else this._x=0,this._y=Math.atan2(o,u);break;case"XZY":if(this._z=Math.asin(-He(s,-1,1)),Math.abs(s)<0.9999999)this._x=Math.atan2(f,l),this._y=Math.atan2(o,r);else this._x=Math.atan2(-c,u),this._y=0;break;default:Ie("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}if(this._order=t,n===!0)this._onChangeCallback();return this}setFromQuaternion(e,t,n){return Xd.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Xd,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return qd.setFromEuler(this),this.setFromQuaternion(qd,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){if(this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0)this._order=e[3];return this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}ti.DEFAULT_ORDER="XYZ";class ys{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}var Rv=0,jd=new L,ar=new Ft,jn=new Ke,uo=new L,Qr=new L,Pv=new L,Iv=new Ft,Yd=new L(1,0,0),$d=new L(0,1,0),Zd=new L(0,0,1),Jd={type:"added"},Lv={type:"removed"},lr={type:"childadded",child:null},bl={type:"childremoved",child:null};class Ct extends kn{constructor(){super();this.isObject3D=!0,Object.defineProperty(this,"id",{value:Rv++}),this.uuid=Qn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Ct.DEFAULT_UP.clone();let e=new L,t=new ti,n=new Ft,i=new L(1,1,1);function r(){n.setFromEuler(t,!1)}function s(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(s),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Ke},normalMatrix:{value:new Fe}}),this.matrix=new Ke,this.matrixWorld=new Ke,this.matrixAutoUpdate=Ct.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Ct.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new ys,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){if(this.matrixAutoUpdate)this.updateMatrix();this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return ar.setFromAxisAngle(e,t),this.quaternion.multiply(ar),this}rotateOnWorldAxis(e,t){return ar.setFromAxisAngle(e,t),this.quaternion.premultiply(ar),this}rotateX(e){return this.rotateOnAxis(Yd,e)}rotateY(e){return this.rotateOnAxis($d,e)}rotateZ(e){return this.rotateOnAxis(Zd,e)}translateOnAxis(e,t){return jd.copy(e).applyQuaternion(this.quaternion),this.position.add(jd.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Yd,e)}translateY(e){return this.translateOnAxis($d,e)}translateZ(e){return this.translateOnAxis(Zd,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(jn.copy(this.matrixWorld).invert())}lookAt(e,t,n){if(e.isVector3)uo.copy(e);else uo.set(e,t,n);let i=this.parent;if(this.updateWorldMatrix(!0,!1),Qr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight)jn.lookAt(Qr,uo,this.up);else jn.lookAt(uo,Qr,this.up);if(this.quaternion.setFromRotationMatrix(jn),i)jn.extractRotation(i.matrixWorld),ar.setFromRotationMatrix(jn),this.quaternion.premultiply(ar.invert())}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}if(e===this)return De("Object3D.add: object can't be added as a child of itself.",e),this;if(e&&e.isObject3D)e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Jd),lr.child=e,this.dispatchEvent(lr),lr.child=null;else De("Object3D.add: object not an instance of THREE.Object3D.",e);return this}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);if(t!==-1)e.parent=null,this.children.splice(t,1),e.dispatchEvent(Lv),bl.child=e,this.dispatchEvent(bl),bl.child=null;return this}removeFromParent(){let e=this.parent;if(e!==null)e.remove(this);return this}clear(){return this.remove(...this.children)}attach(e){if(this.updateWorldMatrix(!0,!1),jn.copy(this.matrixWorld).invert(),e.parent!==null)e.parent.updateWorldMatrix(!0,!1),jn.multiply(e.parent.matrixWorld);return e.applyMatrix4(jn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Jd),lr.child=e,this.dispatchEvent(lr),lr.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let s=this.children[n].getObjectByProperty(e,t);if(s!==void 0)return s}return}getObjectsByProperty(e,t,n=[]){if(this[e]===t)n.push(this);let i=this.children;for(let r=0,s=i.length;r<s;r++)i[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Qr,e,Pv),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Qr,Iv,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;if(t!==null)e(t),t.traverseAncestors(e)}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let{x:t,y:n,z:i}=e,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*i,r[13]+=n-r[1]*t-r[5]*n-r[9]*i,r[14]+=i-r[2]*t-r[6]*n-r[10]*i}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldNeedsUpdate||e){if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);this.matrixWorldNeedsUpdate=!1,e=!0}let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let i=this.parent;if(e===!0&&i!==null)i.updateWorldMatrix(!0,!1);if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldNeedsUpdate||n){if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);this.matrixWorldNeedsUpdate=!1,n=!0}if(t===!0){let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e==="string",n={};if(t)e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"};let i={};if(i.uuid=this.uuid,i.type=this.type,i.name=this.name,i.castShadow=this.castShadow,i.receiveShadow=this.receiveShadow,i.visible=this.visible,i.frustumCulled=this.frustumCulled,i.renderOrder=this.renderOrder,i.static=this.static,i.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0)i.userData=this.userData;if(i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.pivot!==null)i.pivot=this.pivot.toArray();if(this.morphTargetDictionary!==void 0)i.morphTargetDictionary=Object.assign({},this.morphTargetDictionary);if(this.morphTargetInfluences!==void 0)i.morphTargetInfluences=this.morphTargetInfluences.slice();if(this.isInstancedMesh){if(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null)i.instanceColor=this.instanceColor.toJSON()}if(this.isBatchedMesh){if(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map((o)=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map((o)=>({...o})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(e),i.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null)i.colorsTexture=this._colorsTexture.toJSON(e);if(this.boundingSphere!==null)i.boundingSphere=this.boundingSphere.toJSON();if(this.boundingBox!==null)i.boundingBox=this.boundingBox.toJSON()}function r(o,a){if(o[a.uuid]===void 0)o[a.uuid]=a.toJSON(e);return a.uuid}if(this.isScene){if(this.background){if(this.background.isColor)i.background=this.background.toJSON();else if(this.background.isTexture)i.background=this.background.toJSON(e).uuid}if(this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0)i.environment=this.environment.toJSON(e).uuid}else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let a=o.shapes;if(Array.isArray(a))for(let l=0,c=a.length;l<c;l++){let h=a[l];r(e.shapes,h)}else r(e.shapes,a)}}if(this.isSkinnedMesh){if(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0)r(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid}if(this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let a=0,l=this.material.length;a<l;a++)o.push(r(e.materials,this.material[a]));i.material=o}else i.material=r(e.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){let a=this.animations[o];i.animations.push(r(e.animations,a))}}if(t){let o=s(e.geometries),a=s(e.materials),l=s(e.textures),c=s(e.images),h=s(e.shapes),f=s(e.skeletons),u=s(e.animations),p=s(e.nodes);if(o.length>0)n.geometries=o;if(a.length>0)n.materials=a;if(l.length>0)n.textures=l;if(c.length>0)n.images=c;if(h.length>0)n.shapes=h;if(f.length>0)n.skeletons=f;if(u.length>0)n.animations=u;if(p.length>0)n.nodes=p}return n.object=i,n;function s(o){let a=[];for(let l in o){let c=o[l];delete c.metadata,a.push(c)}return a}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}}Ct.DEFAULT_UP=new L(0,1,0);Ct.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ct.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class Kn extends Ct{constructor(){super();this.isGroup=!0,this.type="Group"}}var Dv={type:"move"};class xs{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){if(this._hand===null)this._hand=new Kn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1};return this._hand}getTargetRaySpace(){if(this._targetRay===null)this._targetRay=new Kn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new L,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new L;return this._targetRay}getGripSpace(){if(this._grip===null)this._grip=new Kn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new L,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new L,this._grip.eventsEnabled=!1;return this._grip}dispatchEvent(e){if(this._targetRay!==null)this._targetRay.dispatchEvent(e);if(this._grip!==null)this._grip.dispatchEvent(e);if(this._hand!==null)this._hand.dispatchEvent(e);return this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){if(this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null)this._targetRay.visible=!1;if(this._grip!==null)this._grip.visible=!1;if(this._hand!==null)this._hand.visible=!1;return this}update(e,t,n){let i=null,r=null,s=null,o=this._targetRay,a=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){s=!0;for(let g of e.hand.values()){let y=t.getJointPose(g,n),m=this._getHandJoint(l,g);if(y!==null)m.matrix.fromArray(y.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=y.radius;m.visible=y!==null}let c=l.joints["index-finger-tip"],h=l.joints["thumb-tip"],f=c.position.distanceTo(h.position),u=0.02,p=0.005;if(l.inputState.pinching&&f>u+p)l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this});else if(!l.inputState.pinching&&f<=u-p)l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this})}else if(a!==null&&e.gripSpace){if(r=t.getPose(e.gripSpace,n),r!==null){if(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity)a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity);else a.hasLinearVelocity=!1;if(r.angularVelocity)a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity);else a.hasAngularVelocity=!1;if(a.eventsEnabled)a.dispatchEvent({type:"gripUpdated",data:e,target:this})}}if(o!==null){if(i=t.getPose(e.targetRaySpace,n),i===null&&r!==null)i=r;if(i!==null){if(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity)o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity);else o.hasLinearVelocity=!1;if(i.angularVelocity)o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity);else o.hasAngularVelocity=!1;this.dispatchEvent(Dv)}}}if(o!==null)o.visible=i!==null;if(a!==null)a.visible=r!==null;if(l!==null)l.visible=s!==null;return this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Kn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}var vm={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},fi={h:0,s:0,l:0},fo={h:0,s:0,l:0};function Sl(e,t,n){if(n<0)n+=1;if(n>1)n-=1;if(n<0.16666666666666666)return e+(t-e)*6*n;if(n<0.5)return t;if(n<0.6666666666666666)return e+(t-e)*6*(0.6666666666666666-n);return e}class ke{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let i=e;if(i&&i.isColor)this.copy(i);else if(typeof i==="number")this.setHex(i);else if(typeof i==="string")this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t="srgb"){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,qe.colorSpaceToWorking(this,t),this}setRGB(e,t,n,i=qe.workingColorSpace){return this.r=e,this.g=t,this.b=n,qe.colorSpaceToWorking(this,i),this}setHSL(e,t,n,i=qe.workingColorSpace){if(e=Vc(e,1),t=He(t,0,1),n=He(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=0.5?n*(1+t):n+t-n*t,s=2*n-r;this.r=Sl(s,r,e+0.3333333333333333),this.g=Sl(s,r,e),this.b=Sl(s,r,e-0.3333333333333333)}return qe.colorSpaceToWorking(this,i),this}setStyle(e,t="srgb"){function n(r){if(r===void 0)return;if(parseFloat(r)<1)Ie("Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,s=i[1],o=i[2];switch(s){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Ie("Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=i[1],s=r.length;if(s===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);else if(s===6)return this.setHex(parseInt(r,16),t);else Ie("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t="srgb"){let n=vm[e.toLowerCase()];if(n!==void 0)this.setHex(n,t);else Ie("Color: Unknown color "+e);return this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=ei(e.r),this.g=ei(e.g),this.b=ei(e.b),this}copyLinearToSRGB(e){return this.r=Mr(e.r),this.g=Mr(e.g),this.b=Mr(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e="srgb"){return qe.workingToColorSpace(Ht.copy(this),e),Math.round(He(Ht.r*255,0,255))*65536+Math.round(He(Ht.g*255,0,255))*256+Math.round(He(Ht.b*255,0,255))}getHexString(e="srgb"){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=qe.workingColorSpace){qe.workingToColorSpace(Ht.copy(this),t);let{r:n,g:i,b:r}=Ht,s=Math.max(n,i,r),o=Math.min(n,i,r),a,l,c=(o+s)/2;if(o===s)a=0,l=0;else{let h=s-o;switch(l=c<=0.5?h/(s+o):h/(2-s-o),s){case n:a=(i-r)/h+(i<r?6:0);break;case i:a=(r-n)/h+2;break;case r:a=(n-i)/h+4;break}a/=6}return e.h=a,e.s=l,e.l=c,e}getRGB(e,t=qe.workingColorSpace){return qe.workingToColorSpace(Ht.copy(this),t),e.r=Ht.r,e.g=Ht.g,e.b=Ht.b,e}getStyle(e="srgb"){qe.workingToColorSpace(Ht.copy(this),e);let{r:t,g:n,b:i}=Ht;if(e!=="srgb")return`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`;return`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(fi),this.setHSL(fi.h+e,fi.s+t,fi.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(fi),e.getHSL(fo);let n=ls(fi.h,fo.h,t),i=ls(fi.s,fo.s,t),r=ls(fi.l,fo.l,t);return this.setHSL(n,i,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,i=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*i,this.g=r[1]*t+r[4]*n+r[7]*i,this.b=r[2]*t+r[5]*n+r[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}var Ht=new ke;ke.NAMES=vm;class Ko extends Ct{constructor(){super();if(this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ti,this.environmentIntensity=1,this.environmentRotation=new ti,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){if(super.copy(e,t),e.background!==null)this.background=e.background.clone();if(e.environment!==null)this.environment=e.environment.clone();if(e.fog!==null)this.fog=e.fog.clone();if(this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null)this.overrideMaterial=e.overrideMaterial.clone();return this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);if(this.fog!==null)t.object.fog=this.fog.toJSON();return t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}}var En=new L,Yn=new L,Ml=new L,$n=new L,cr=new L,hr=new L,Kd=new L,wl=new L,El=new L,Tl=new L,Al=new gt,Cl=new gt,Rl=new gt;class fn{constructor(e=new L,t=new L,n=new L){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),En.subVectors(e,t),i.cross(En);let r=i.lengthSq();if(r>0)return i.multiplyScalar(1/Math.sqrt(r));return i.set(0,0,0)}static getBarycoord(e,t,n,i,r){En.subVectors(i,t),Yn.subVectors(n,t),Ml.subVectors(e,t);let s=En.dot(En),o=En.dot(Yn),a=En.dot(Ml),l=Yn.dot(Yn),c=Yn.dot(Ml),h=s*l-o*o;if(h===0)return r.set(0,0,0),null;let f=1/h,u=(l*a-o*c)*f,p=(s*c-o*a)*f;return r.set(1-u-p,p,u)}static containsPoint(e,t,n,i){if(this.getBarycoord(e,t,n,i,$n)===null)return!1;return $n.x>=0&&$n.y>=0&&$n.x+$n.y<=1}static getInterpolation(e,t,n,i,r,s,o,a){if(this.getBarycoord(e,t,n,i,$n)===null){if(a.x=0,a.y=0,"z"in a)a.z=0;if("w"in a)a.w=0;return null}return a.setScalar(0),a.addScaledVector(r,$n.x),a.addScaledVector(s,$n.y),a.addScaledVector(o,$n.z),a}static getInterpolatedAttribute(e,t,n,i,r,s){return Al.setScalar(0),Cl.setScalar(0),Rl.setScalar(0),Al.fromBufferAttribute(e,t),Cl.fromBufferAttribute(e,n),Rl.fromBufferAttribute(e,i),s.setScalar(0),s.addScaledVector(Al,r.x),s.addScaledVector(Cl,r.y),s.addScaledVector(Rl,r.z),s}static isFrontFacing(e,t,n,i){return En.subVectors(n,t),Yn.subVectors(e,t),En.cross(Yn).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return En.subVectors(this.c,this.b),Yn.subVectors(this.a,this.b),En.cross(Yn).length()*0.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(0.3333333333333333)}getNormal(e){return fn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return fn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,i,r){return fn.getInterpolation(e,this.a,this.b,this.c,t,n,i,r)}containsPoint(e){return fn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return fn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,i=this.b,r=this.c,s,o;cr.subVectors(i,n),hr.subVectors(r,n),wl.subVectors(e,n);let a=cr.dot(wl),l=hr.dot(wl);if(a<=0&&l<=0)return t.copy(n);El.subVectors(e,i);let c=cr.dot(El),h=hr.dot(El);if(c>=0&&h<=c)return t.copy(i);let f=a*h-c*l;if(f<=0&&a>=0&&c<=0)return s=a/(a-c),t.copy(n).addScaledVector(cr,s);Tl.subVectors(e,r);let u=cr.dot(Tl),p=hr.dot(Tl);if(p>=0&&u<=p)return t.copy(r);let g=u*l-a*p;if(g<=0&&l>=0&&p<=0)return o=l/(l-p),t.copy(n).addScaledVector(hr,o);let y=c*p-u*h;if(y<=0&&h-c>=0&&u-p>=0)return Kd.subVectors(r,i),o=(h-c)/(h-c+(u-p)),t.copy(i).addScaledVector(Kd,o);let m=1/(y+g+f);return s=g*m,o=f*m,t.copy(n).addScaledVector(cr,s).addScaledVector(hr,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class Pn{constructor(e=new L(1/0,1/0,1/0),t=new L(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Tn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Tn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Tn.copy(t).multiplyScalar(0.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(0.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let s=0,o=r.count;s<o;s++){if(e.isMesh===!0)e.getVertexPosition(s,Tn);else Tn.fromBufferAttribute(r,s);Tn.applyMatrix4(e.matrixWorld),this.expandByPoint(Tn)}else{if(e.boundingBox!==void 0){if(e.boundingBox===null)e.computeBoundingBox();po.copy(e.boundingBox)}else{if(n.boundingBox===null)n.computeBoundingBox();po.copy(n.boundingBox)}po.applyMatrix4(e.matrixWorld),this.union(po)}}let i=e.children;for(let r=0,s=i.length;r<s;r++)this.expandByObject(i[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Tn),Tn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;if(e.normal.x>0)t=e.normal.x*this.min.x,n=e.normal.x*this.max.x;else t=e.normal.x*this.max.x,n=e.normal.x*this.min.x;if(e.normal.y>0)t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y;else t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y;if(e.normal.z>0)t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z;else t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z;return t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(es),mo.subVectors(this.max,es),ur.subVectors(e.a,es),fr.subVectors(e.b,es),dr.subVectors(e.c,es),di.subVectors(fr,ur),pi.subVectors(dr,fr),Li.subVectors(ur,dr);let t=[0,-di.z,di.y,0,-pi.z,pi.y,0,-Li.z,Li.y,di.z,0,-di.x,pi.z,0,-pi.x,Li.z,0,-Li.x,-di.y,di.x,0,-pi.y,pi.x,0,-Li.y,Li.x,0];if(!Pl(t,ur,fr,dr,mo))return!1;if(t=[1,0,0,0,1,0,0,0,1],!Pl(t,ur,fr,dr,mo))return!1;return go.crossVectors(di,pi),t=[go.x,go.y,go.z],Pl(t,ur,fr,dr,mo)}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Tn).distanceTo(e)}getBoundingSphere(e){if(this.isEmpty())e.makeEmpty();else this.getCenter(e.center),e.radius=this.getSize(Tn).length()*0.5;return e}intersect(e){if(this.min.max(e.min),this.max.min(e.max),this.isEmpty())this.makeEmpty();return this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){if(this.isEmpty())return this;return Zn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Zn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Zn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Zn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Zn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Zn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Zn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Zn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Zn),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}var Zn=[new L,new L,new L,new L,new L,new L,new L,new L],Tn=new L,po=new Pn,ur=new L,fr=new L,dr=new L,di=new L,pi=new L,Li=new L,es=new L,mo=new L,go=new L,Di=new L;function Pl(e,t,n,i,r){for(let s=0,o=e.length-3;s<=o;s+=3){Di.fromArray(e,s);let a=r.x*Math.abs(Di.x)+r.y*Math.abs(Di.y)+r.z*Math.abs(Di.z),l=t.dot(Di),c=n.dot(Di),h=i.dot(Di);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var wt=new L,_o=new se,Nv=0;class sn extends kn{constructor(e,t,n=!1){super();if(Array.isArray(e))throw TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Nv++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=35044,this.updateRanges=[],this.gpuType=1015,this.version=0}onUploadCallback(){}set needsUpdate(e){if(e===!0)this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)_o.fromBufferAttribute(this,t),_o.applyMatrix3(e),this.setXY(t,_o.x,_o.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.applyMatrix3(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.applyMatrix4(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.applyNormalMatrix(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.transformDirection(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];if(this.normalized)n=An(n,this.array);return n}setComponent(e,t,n){if(this.normalized)n=st(n,this.array);return this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];if(this.normalized)t=An(t,this.array);return t}setX(e,t){if(this.normalized)t=st(t,this.array);return this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];if(this.normalized)t=An(t,this.array);return t}setY(e,t){if(this.normalized)t=st(t,this.array);return this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];if(this.normalized)t=An(t,this.array);return t}setZ(e,t){if(this.normalized)t=st(t,this.array);return this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];if(this.normalized)t=An(t,this.array);return t}setW(e,t){if(this.normalized)t=st(t,this.array);return this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){if(e*=this.itemSize,this.normalized)t=st(t,this.array),n=st(n,this.array);return this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){if(e*=this.itemSize,this.normalized)t=st(t,this.array),n=st(n,this.array),i=st(i,this.array);return this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,r){if(e*=this.itemSize,this.normalized)t=st(t,this.array),n=st(n,this.array),i=st(i,this.array),r=st(r,this.array);return this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}}class Qo extends sn{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class ea extends sn{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class mt extends sn{constructor(e,t,n){super(new Float32Array(e),t,n)}}var Ov=new Pn,ts=new L,Il=new L;class Nr{constructor(e=new L,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;if(t!==void 0)n.copy(t);else Ov.setFromPoints(e).getCenter(n);let i=0;for(let r=0,s=e.length;r<s;r++)i=Math.max(i,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);if(t.copy(e),n>this.radius*this.radius)t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center);return t}getBoundingBox(e){if(this.isEmpty())return e.makeEmpty(),e;return e.set(this.center,this.center),e.expandByScalar(this.radius),e}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;ts.subVectors(e,this.center);let t=ts.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*0.5;this.center.addScaledVector(ts,i/n),this.radius+=i}return this}union(e){if(e.isEmpty())return this;if(this.isEmpty())return this.copy(e),this;if(this.center.equals(e.center)===!0)this.radius=Math.max(this.radius,e.radius);else Il.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(ts.copy(e.center).add(Il)),this.expandByPoint(ts.copy(e.center).sub(Il));return this}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}var Uv=0,vn=new Ke,Ll=new Ct,pr=new L,un=new Pn,ns=new Pn,Nt=new L;class Rt extends kn{constructor(){super();this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Uv++}),this.uuid=Qn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){if(Array.isArray(e))this.index=new((ov(e))?ea:Qo)(e,1);else this.index=e;return this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;if(t!==void 0)t.applyMatrix4(e),t.needsUpdate=!0;let n=this.attributes.normal;if(n!==void 0){let r=new Fe().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}let i=this.attributes.tangent;if(i!==void 0)i.transformDirection(e),i.needsUpdate=!0;if(this.boundingBox!==null)this.computeBoundingBox();if(this.boundingSphere!==null)this.computeBoundingSphere();return this._transformed=!0,this}applyQuaternion(e){return vn.makeRotationFromQuaternion(e),this.applyMatrix4(vn),this}rotateX(e){return vn.makeRotationX(e),this.applyMatrix4(vn),this}rotateY(e){return vn.makeRotationY(e),this.applyMatrix4(vn),this}rotateZ(e){return vn.makeRotationZ(e),this.applyMatrix4(vn),this}translate(e,t,n){return vn.makeTranslation(e,t,n),this.applyMatrix4(vn),this}scale(e,t,n){return vn.makeScale(e,t,n),this.applyMatrix4(vn),this}lookAt(e){return Ll.lookAt(e),Ll.updateMatrix(),this.applyMatrix4(Ll.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(pr).negate(),this.translate(pr.x,pr.y,pr.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let i=0,r=e.length;i<r;i++){let s=e[i];n.push(s.x,s.y,s.z||0)}this.setAttribute("position",new mt(n,3))}else{let n=Math.min(e.length,t.count);for(let i=0;i<n;i++){let r=e[i];t.setXYZ(i,r.x,r.y,r.z||0)}if(e.length>t.count)Ie("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.");t.needsUpdate=!0}return this}computeBoundingBox(){if(this.boundingBox===null)this.boundingBox=new Pn;let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){De("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new L(-1/0,-1/0,-1/0),new L(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let r=t[n];if(un.setFromBufferAttribute(r),this.morphTargetsRelative)Nt.addVectors(this.boundingBox.min,un.min),this.boundingBox.expandByPoint(Nt),Nt.addVectors(this.boundingBox.max,un.max),this.boundingBox.expandByPoint(Nt);else this.boundingBox.expandByPoint(un.min),this.boundingBox.expandByPoint(un.max)}}else this.boundingBox.makeEmpty();if(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))De('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){if(this.boundingSphere===null)this.boundingSphere=new Nr;let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){De("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new L,1/0);return}if(e){let n=this.boundingSphere.center;if(un.setFromBufferAttribute(e),t)for(let r=0,s=t.length;r<s;r++){let o=t[r];if(ns.setFromBufferAttribute(o),this.morphTargetsRelative)Nt.addVectors(un.min,ns.min),un.expandByPoint(Nt),Nt.addVectors(un.max,ns.max),un.expandByPoint(Nt);else un.expandByPoint(ns.min),un.expandByPoint(ns.max)}un.getCenter(n);let i=0;for(let r=0,s=e.count;r<s;r++)Nt.fromBufferAttribute(e,r),i=Math.max(i,n.distanceToSquared(Nt));if(t)for(let r=0,s=t.length;r<s;r++){let o=t[r],a=this.morphTargetsRelative;for(let l=0,c=o.count;l<c;l++){if(Nt.fromBufferAttribute(o,l),a)pr.fromBufferAttribute(e,l),Nt.add(pr);i=Math.max(i,n.distanceToSquared(Nt))}}if(this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius))De('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){De("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let{position:n,normal:i,uv:r}=t,s=this.getAttribute("tangent");if(s===void 0||s.count!==n.count)s=new sn(new Float32Array(4*n.count),4),this.setAttribute("tangent",s);let o=[],a=[];for(let T=0;T<n.count;T++)o[T]=new L,a[T]=new L;let l=new L,c=new L,h=new L,f=new se,u=new se,p=new se,g=new L,y=new L;function m(T,v,A){l.fromBufferAttribute(n,T),c.fromBufferAttribute(n,v),h.fromBufferAttribute(n,A),f.fromBufferAttribute(r,T),u.fromBufferAttribute(r,v),p.fromBufferAttribute(r,A),c.sub(l),h.sub(l),u.sub(f),p.sub(f);let N=1/(u.x*p.y-p.x*u.y);if(!isFinite(N))return;g.copy(c).multiplyScalar(p.y).addScaledVector(h,-u.y).multiplyScalar(N),y.copy(h).multiplyScalar(u.x).addScaledVector(c,-p.x).multiplyScalar(N),o[T].add(g),o[v].add(g),o[A].add(g),a[T].add(y),a[v].add(y),a[A].add(y)}let d=this.groups;if(d.length===0)d=[{start:0,count:e.count}];for(let T=0,v=d.length;T<v;++T){let A=d[T],{start:N,count:P}=A;for(let D=N,W=N+P;D<W;D+=3)m(e.getX(D+0),e.getX(D+1),e.getX(D+2))}let b=new L,S=new L,_=new L,x=new L;function w(T){_.fromBufferAttribute(i,T),x.copy(_);let v=o[T];b.copy(v),b.sub(_.multiplyScalar(_.dot(v))).normalize(),S.crossVectors(x,v);let N=S.dot(a[T])<0?-1:1;s.setXYZW(T,b.x,b.y,b.z,N)}for(let T=0,v=d.length;T<v;++T){let A=d[T],{start:N,count:P}=A;for(let D=N,W=N+P;D<W;D+=3)w(e.getX(D+0)),w(e.getX(D+1)),w(e.getX(D+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new sn(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let f=0,u=n.count;f<u;f++)n.setXYZ(f,0,0,0);let i=new L,r=new L,s=new L,o=new L,a=new L,l=new L,c=new L,h=new L;if(e)for(let f=0,u=e.count;f<u;f+=3){let p=e.getX(f+0),g=e.getX(f+1),y=e.getX(f+2);i.fromBufferAttribute(t,p),r.fromBufferAttribute(t,g),s.fromBufferAttribute(t,y),c.subVectors(s,r),h.subVectors(i,r),c.cross(h),o.fromBufferAttribute(n,p),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,y),o.add(c),a.add(c),l.add(c),n.setXYZ(p,o.x,o.y,o.z),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(y,l.x,l.y,l.z)}else for(let f=0,u=t.count;f<u;f+=3)i.fromBufferAttribute(t,f+0),r.fromBufferAttribute(t,f+1),s.fromBufferAttribute(t,f+2),c.subVectors(s,r),h.subVectors(i,r),c.cross(h),n.setXYZ(f+0,c.x,c.y,c.z),n.setXYZ(f+1,c.x,c.y,c.z),n.setXYZ(f+2,c.x,c.y,c.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Nt.fromBufferAttribute(e,t),Nt.normalize(),e.setXYZ(t,Nt.x,Nt.y,Nt.z)}toNonIndexed(){function e(o,a){let{array:l,itemSize:c,normalized:h}=o,f=new l.constructor(a.length*c),u=0,p=0;for(let g=0,y=a.length;g<y;g++){if(o.isInterleavedBufferAttribute)u=a[g]*o.data.stride+o.offset;else u=a[g]*c;for(let m=0;m<c;m++)f[p++]=l[u++]}return new sn(f,c,h)}if(this.index===null)return Ie("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new Rt,n=this.index.array,i=this.attributes;for(let o in i){let a=i[o],l=e(a,n);t.setAttribute(o,l)}let r=this.morphAttributes;for(let o in r){let a=[],l=r[o];for(let c=0,h=l.length;c<h;c++){let f=l[c],u=e(f,n);a.push(u)}t.morphAttributes[o]=a}t.morphTargetsRelative=this.morphTargetsRelative;let s=this.groups;for(let o=0,a=s.length;o<a;o++){let l=s[o];t.addGroup(l.start,l.count,l.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0)e.userData=this.userData;if(this.parameters!==void 0&&this._transformed!==!0){let a=this.parameters;for(let l in a)if(a[l]!==void 0)e[l]=a[l];return e}e.data={attributes:{}};let t=this.index;if(t!==null)e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)};let n=this.attributes;for(let a in n){let l=n[a];e.data.attributes[a]=l.toJSON(e.data)}let i={},r=!1;for(let a in this.morphAttributes){let l=this.morphAttributes[a],c=[];for(let h=0,f=l.length;h<f;h++){let u=l[h];c.push(u.toJSON(e.data))}if(c.length>0)i[a]=c,r=!0}if(r)e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative;let s=this.groups;if(s.length>0)e.data.groups=JSON.parse(JSON.stringify(s));let o=this.boundingSphere;if(o!==null)e.data.boundingSphere=o.toJSON();return e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;if(n!==null)this.setIndex(n.clone());let i=e.attributes;for(let l in i){let c=i[l];this.setAttribute(l,c.clone(t))}let r=e.morphAttributes;for(let l in r){let c=[],h=r[l];for(let f=0,u=h.length;f<u;f++)c.push(h[f].clone(t));this.morphAttributes[l]=c}this.morphTargetsRelative=e.morphTargetsRelative;let s=e.groups;for(let l=0,c=s.length;l<c;l++){let h=s[l];this.addGroup(h.start,h.count,h.materialIndex)}let o=e.boundingBox;if(o!==null)this.boundingBox=o.clone();let a=e.boundingSphere;if(a!==null)this.boundingSphere=a.clone();return this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}class jc{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=35044,this.updateRanges=[],this.version=0,this.uuid=Qn()}onUploadCallback(){}set needsUpdate(e){if(e===!0)this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,r=this.stride;i<r;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){if(e.arrayBuffers===void 0)e.arrayBuffers={};if(this.array.buffer._uuid===void 0)this.array.buffer._uuid=Qn();if(e.arrayBuffers[this.array.buffer._uuid]===void 0)e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer;let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){if(e.arrayBuffers===void 0)e.arrayBuffers={};if(this.array.buffer._uuid===void 0)this.array.buffer._uuid=Qn();if(e.arrayBuffers[this.array.buffer._uuid]===void 0)e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer));let t={uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride};return t.usage=this.usage,t}}var Yt=new L;class fs{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Yt.fromBufferAttribute(this,t),Yt.applyMatrix4(e),this.setXYZ(t,Yt.x,Yt.y,Yt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Yt.fromBufferAttribute(this,t),Yt.applyNormalMatrix(e),this.setXYZ(t,Yt.x,Yt.y,Yt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Yt.fromBufferAttribute(this,t),Yt.transformDirection(e),this.setXYZ(t,Yt.x,Yt.y,Yt.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];if(this.normalized)n=An(n,this.array);return n}setComponent(e,t,n){if(this.normalized)n=st(n,this.array);return this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){if(this.normalized)t=st(t,this.array);return this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){if(this.normalized)t=st(t,this.array);return this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){if(this.normalized)t=st(t,this.array);return this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){if(this.normalized)t=st(t,this.array);return this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];if(this.normalized)t=An(t,this.array);return t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];if(this.normalized)t=An(t,this.array);return t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];if(this.normalized)t=An(t,this.array);return t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];if(this.normalized)t=An(t,this.array);return t}setXY(e,t,n){if(e=e*this.data.stride+this.offset,this.normalized)t=st(t,this.array),n=st(n,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){if(e=e*this.data.stride+this.offset,this.normalized)t=st(t,this.array),n=st(n,this.array),i=st(i,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,r){if(e=e*this.data.stride+this.offset,this.normalized)t=st(t,this.array),n=st(n,this.array),i=st(i,this.array),r=st(r,this.array);return this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=r,this}clone(e){if(e===void 0){us("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return new sn(new this.array.constructor(t),this.itemSize,this.normalized)}else{if(e.interleavedBuffers===void 0)e.interleavedBuffers={};if(e.interleavedBuffers[this.data.uuid]===void 0)e.interleavedBuffers[this.data.uuid]=this.data.clone(e);return new fs(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}}toJSON(e){if(e===void 0){us("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else{if(e.interleavedBuffers===void 0)e.interleavedBuffers={};if(e.interleavedBuffers[this.data.uuid]===void 0)e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e);return{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}}var Dl=new L,Fv=new L,Bv=new Fe;class rn{constructor(e=new L(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=Dl.subVectors(n,t).cross(Fv.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let i=e.delta(Dl),r=this.normal.dot(i);if(r===0){if(this.distanceToPoint(e.start)===0)return t.copy(e.start);return null}let s=-(e.start.dot(this.normal)+this.constant)/r;if(n===!0&&(s<0||s>1))return null;return t.copy(e.start).addScaledVector(i,s)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Bv.getNormalMatrix(e),i=this.coplanarPoint(Dl).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}}var kv=0;class ii extends kn{constructor(){super();this.isMaterial=!0,Object.defineProperty(this,"id",{value:kv++}),this.uuid=Qn(),this.name="",this.type="Material",this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ke(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=7680,this.stencilZFail=7680,this.stencilZPass=7680,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){if(this._alphaTest>0!==e>0)this.version++;this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e===void 0)return;for(let t in e){let n=e[t];if(n===void 0){Ie(`Material: parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){Ie(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}if(i&&i.isColor)i.set(n);else if(i&&i.isVector2&&(n&&n.isVector2)||i&&i.isEuler&&(n&&n.isEuler)||i&&i.isVector3&&(n&&n.isVector3))i.copy(n);else this[t]=n}}toJSON(e){let t=e===void 0||typeof e==="string";if(t)e={textures:{},images:{}};let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};if(n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor)n.color=this.color.getHex();if(this.roughness!==void 0)n.roughness=this.roughness;if(this.metalness!==void 0)n.metalness=this.metalness;if(this.sheen!==void 0)n.sheen=this.sheen;if(this.sheenColor&&this.sheenColor.isColor)n.sheenColor=this.sheenColor.getHex();if(this.sheenRoughness!==void 0)n.sheenRoughness=this.sheenRoughness;if(this.emissive&&this.emissive.isColor)n.emissive=this.emissive.getHex();if(this.emissiveIntensity!==void 0)n.emissiveIntensity=this.emissiveIntensity;if(this.specular&&this.specular.isColor)n.specular=this.specular.getHex();if(this.specularIntensity!==void 0)n.specularIntensity=this.specularIntensity;if(this.specularColor&&this.specularColor.isColor)n.specularColor=this.specularColor.getHex();if(this.shininess!==void 0)n.shininess=this.shininess;if(this.clearcoat!==void 0)n.clearcoat=this.clearcoat;if(this.clearcoatRoughness!==void 0)n.clearcoatRoughness=this.clearcoatRoughness;if(this.clearcoatMap&&this.clearcoatMap.isTexture)n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid;if(this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture)n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid;if(this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture)n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray();if(this.sheenColorMap&&this.sheenColorMap.isTexture)n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid;if(this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture)n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid;if(this.dispersion!==void 0)n.dispersion=this.dispersion;if(this.retroreflectivity!==void 0)n.retroreflectivity=this.retroreflectivity;if(this.iridescence!==void 0)n.iridescence=this.iridescence;if(this.iridescenceIOR!==void 0)n.iridescenceIOR=this.iridescenceIOR;if(this.iridescenceThicknessRange!==void 0)n.iridescenceThicknessRange=this.iridescenceThicknessRange;if(this.iridescenceMap&&this.iridescenceMap.isTexture)n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid;if(this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture)n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid;if(this.anisotropy!==void 0)n.anisotropy=this.anisotropy;if(this.anisotropyRotation!==void 0)n.anisotropyRotation=this.anisotropyRotation;if(this.anisotropyMap&&this.anisotropyMap.isTexture)n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid;if(this.map&&this.map.isTexture)n.map=this.map.toJSON(e).uuid;if(this.matcap&&this.matcap.isTexture)n.matcap=this.matcap.toJSON(e).uuid;if(this.alphaMap&&this.alphaMap.isTexture)n.alphaMap=this.alphaMap.toJSON(e).uuid;if(this.lightMap&&this.lightMap.isTexture)n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity;if(this.aoMap&&this.aoMap.isTexture)n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity;if(this.bumpMap&&this.bumpMap.isTexture)n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale;if(this.normalMap&&this.normalMap.isTexture)n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray();if(this.displacementMap&&this.displacementMap.isTexture)n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias;if(this.roughnessMap&&this.roughnessMap.isTexture)n.roughnessMap=this.roughnessMap.toJSON(e).uuid;if(this.metalnessMap&&this.metalnessMap.isTexture)n.metalnessMap=this.metalnessMap.toJSON(e).uuid;if(this.emissiveMap&&this.emissiveMap.isTexture)n.emissiveMap=this.emissiveMap.toJSON(e).uuid;if(this.specularMap&&this.specularMap.isTexture)n.specularMap=this.specularMap.toJSON(e).uuid;if(this.specularIntensityMap&&this.specularIntensityMap.isTexture)n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid;if(this.specularColorMap&&this.specularColorMap.isTexture)n.specularColorMap=this.specularColorMap.toJSON(e).uuid;if(this.envMap&&this.envMap.isTexture){if(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0)n.combine=this.combine}if(this.envMapRotation!==void 0)n.envMapRotation=this.envMapRotation.toArray();if(this.envMapIntensity!==void 0)n.envMapIntensity=this.envMapIntensity;if(this.reflectivity!==void 0)n.reflectivity=this.reflectivity;if(this.refractionRatio!==void 0)n.refractionRatio=this.refractionRatio;if(this.gradientMap&&this.gradientMap.isTexture)n.gradientMap=this.gradientMap.toJSON(e).uuid;if(this.transmission!==void 0)n.transmission=this.transmission;if(this.transmissionMap&&this.transmissionMap.isTexture)n.transmissionMap=this.transmissionMap.toJSON(e).uuid;if(this.thickness!==void 0)n.thickness=this.thickness;if(this.thicknessMap&&this.thicknessMap.isTexture)n.thicknessMap=this.thicknessMap.toJSON(e).uuid;if(this.attenuationDistance!==void 0)n.attenuationDistance=this.attenuationDistance;if(this.attenuationColor!==void 0)n.attenuationColor=this.attenuationColor.getHex();if(this.size!==void 0)n.size=this.size;if(this.sizeAttenuation!==void 0)n.sizeAttenuation=this.sizeAttenuation;if(Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0)n.clippingPlanes=this.clippingPlanes.map((r)=>r.toJSON());if(this.rotation!==void 0)n.rotation=this.rotation;if(this.depthPacking!==void 0)n.depthPacking=this.depthPacking;if(this.linewidth!==void 0)n.linewidth=this.linewidth;if(this.linecap!==void 0)n.linecap=this.linecap;if(this.linejoin!==void 0)n.linejoin=this.linejoin;if(this.dashSize!==void 0)n.dashSize=this.dashSize;if(this.gapSize!==void 0)n.gapSize=this.gapSize;if(this.scale!==void 0)n.scale=this.scale;if(this.wireframe!==void 0)n.wireframe=this.wireframe;if(this.wireframeLinewidth!==void 0)n.wireframeLinewidth=this.wireframeLinewidth;if(this.wireframeLinecap!==void 0)n.wireframeLinecap=this.wireframeLinecap;if(this.wireframeLinejoin!==void 0)n.wireframeLinejoin=this.wireframeLinejoin;if(this.flatShading!==void 0)n.flatShading=this.flatShading;if(this.fog!==void 0)n.fog=this.fog;if(Object.keys(this.userData).length>0)n.userData=this.userData;function i(r){let s=[];for(let o in r){let a=r[o];delete a.metadata,s.push(a)}return s}if(t){let r=i(e.textures),s=i(e.images);if(r.length>0)n.textures=r;if(s.length>0)n.images=s}return n}fromJSON(e,t){if(e.uuid!==void 0)this.uuid=e.uuid;if(e.name!==void 0)this.name=e.name;if(e.color!==void 0&&this.color!==void 0)this.color.setHex(e.color);if(e.roughness!==void 0)this.roughness=e.roughness;if(e.metalness!==void 0)this.metalness=e.metalness;if(e.sheen!==void 0)this.sheen=e.sheen;if(e.sheenColor!==void 0)this.sheenColor=new ke().setHex(e.sheenColor);if(e.sheenRoughness!==void 0)this.sheenRoughness=e.sheenRoughness;if(e.emissive!==void 0&&this.emissive!==void 0)this.emissive.setHex(e.emissive);if(e.specular!==void 0&&this.specular!==void 0)this.specular.setHex(e.specular);if(e.specularIntensity!==void 0)this.specularIntensity=e.specularIntensity;if(e.specularColor!==void 0&&this.specularColor!==void 0)this.specularColor.setHex(e.specularColor);if(e.shininess!==void 0)this.shininess=e.shininess;if(e.clearcoat!==void 0)this.clearcoat=e.clearcoat;if(e.clearcoatRoughness!==void 0)this.clearcoatRoughness=e.clearcoatRoughness;if(e.dispersion!==void 0)this.dispersion=e.dispersion;if(e.retroreflectivity!==void 0)this.retroreflectivity=e.retroreflectivity;if(e.iridescence!==void 0)this.iridescence=e.iridescence;if(e.iridescenceIOR!==void 0)this.iridescenceIOR=e.iridescenceIOR;if(e.iridescenceThicknessRange!==void 0)this.iridescenceThicknessRange=e.iridescenceThicknessRange;if(e.transmission!==void 0)this.transmission=e.transmission;if(e.thickness!==void 0)this.thickness=e.thickness;if(e.attenuationDistance!==void 0)this.attenuationDistance=e.attenuationDistance;if(e.attenuationColor!==void 0&&this.attenuationColor!==void 0)this.attenuationColor.setHex(e.attenuationColor);if(e.anisotropy!==void 0)this.anisotropy=e.anisotropy;if(e.anisotropyRotation!==void 0)this.anisotropyRotation=e.anisotropyRotation;if(e.fog!==void 0)this.fog=e.fog;if(e.flatShading!==void 0)this.flatShading=e.flatShading;if(e.blending!==void 0)this.blending=e.blending;if(e.combine!==void 0)this.combine=e.combine;if(e.side!==void 0)this.side=e.side;if(e.shadowSide!==void 0)this.shadowSide=e.shadowSide;if(e.opacity!==void 0)this.opacity=e.opacity;if(e.transparent!==void 0)this.transparent=e.transparent;if(e.alphaTest!==void 0)this.alphaTest=e.alphaTest;if(e.alphaHash!==void 0)this.alphaHash=e.alphaHash;if(e.depthFunc!==void 0)this.depthFunc=e.depthFunc;if(e.depthTest!==void 0)this.depthTest=e.depthTest;if(e.depthWrite!==void 0)this.depthWrite=e.depthWrite;if(e.colorWrite!==void 0)this.colorWrite=e.colorWrite;if(e.clippingPlanes!==void 0)this.clippingPlanes=e.clippingPlanes.map((n)=>new rn().fromJSON(n));if(e.clipIntersection!==void 0)this.clipIntersection=e.clipIntersection;if(e.clipShadows!==void 0)this.clipShadows=e.clipShadows;if(e.depthPacking!==void 0)this.depthPacking=e.depthPacking;if(e.blendSrc!==void 0)this.blendSrc=e.blendSrc;if(e.blendDst!==void 0)this.blendDst=e.blendDst;if(e.blendEquation!==void 0)this.blendEquation=e.blendEquation;if(e.blendSrcAlpha!==void 0)this.blendSrcAlpha=e.blendSrcAlpha;if(e.blendDstAlpha!==void 0)this.blendDstAlpha=e.blendDstAlpha;if(e.blendEquationAlpha!==void 0)this.blendEquationAlpha=e.blendEquationAlpha;if(e.blendColor!==void 0&&this.blendColor!==void 0)this.blendColor.setHex(e.blendColor);if(e.blendAlpha!==void 0)this.blendAlpha=e.blendAlpha;if(e.stencilWriteMask!==void 0)this.stencilWriteMask=e.stencilWriteMask;if(e.stencilFunc!==void 0)this.stencilFunc=e.stencilFunc;if(e.stencilRef!==void 0)this.stencilRef=e.stencilRef;if(e.stencilFuncMask!==void 0)this.stencilFuncMask=e.stencilFuncMask;if(e.stencilFail!==void 0)this.stencilFail=e.stencilFail;if(e.stencilZFail!==void 0)this.stencilZFail=e.stencilZFail;if(e.stencilZPass!==void 0)this.stencilZPass=e.stencilZPass;if(e.stencilWrite!==void 0)this.stencilWrite=e.stencilWrite;if(e.wireframe!==void 0)this.wireframe=e.wireframe;if(e.wireframeLinewidth!==void 0)this.wireframeLinewidth=e.wireframeLinewidth;if(e.wireframeLinecap!==void 0)this.wireframeLinecap=e.wireframeLinecap;if(e.wireframeLinejoin!==void 0)this.wireframeLinejoin=e.wireframeLinejoin;if(e.rotation!==void 0)this.rotation=e.rotation;if(e.linewidth!==void 0)this.linewidth=e.linewidth;if(e.linecap!==void 0)this.linecap=e.linecap;if(e.linejoin!==void 0)this.linejoin=e.linejoin;if(e.dashSize!==void 0)this.dashSize=e.dashSize;if(e.gapSize!==void 0)this.gapSize=e.gapSize;if(e.scale!==void 0)this.scale=e.scale;if(e.polygonOffset!==void 0)this.polygonOffset=e.polygonOffset;if(e.polygonOffsetFactor!==void 0)this.polygonOffsetFactor=e.polygonOffsetFactor;if(e.polygonOffsetUnits!==void 0)this.polygonOffsetUnits=e.polygonOffsetUnits;if(e.dithering!==void 0)this.dithering=e.dithering;if(e.alphaToCoverage!==void 0)this.alphaToCoverage=e.alphaToCoverage;if(e.premultipliedAlpha!==void 0)this.premultipliedAlpha=e.premultipliedAlpha;if(e.forceSinglePass!==void 0)this.forceSinglePass=e.forceSinglePass;if(e.allowOverride!==void 0)this.allowOverride=e.allowOverride;if(e.visible!==void 0)this.visible=e.visible;if(e.toneMapped!==void 0)this.toneMapped=e.toneMapped;if(e.userData!==void 0)this.userData=e.userData;if(e.vertexColors!==void 0)if(typeof e.vertexColors==="number")this.vertexColors=e.vertexColors>0;else this.vertexColors=e.vertexColors;if(e.size!==void 0)this.size=e.size;if(e.sizeAttenuation!==void 0)this.sizeAttenuation=e.sizeAttenuation;if(e.map!==void 0)this.map=t[e.map]||null;if(e.matcap!==void 0)this.matcap=t[e.matcap]||null;if(e.alphaMap!==void 0)this.alphaMap=t[e.alphaMap]||null;if(e.bumpMap!==void 0)this.bumpMap=t[e.bumpMap]||null;if(e.bumpScale!==void 0)this.bumpScale=e.bumpScale;if(e.normalMap!==void 0)this.normalMap=t[e.normalMap]||null;if(e.normalMapType!==void 0)this.normalMapType=e.normalMapType;if(e.normalScale!==void 0){let n=e.normalScale;if(Array.isArray(n)===!1)n=[n,n];this.normalScale=new se().fromArray(n)}if(e.displacementMap!==void 0)this.displacementMap=t[e.displacementMap]||null;if(e.displacementScale!==void 0)this.displacementScale=e.displacementScale;if(e.displacementBias!==void 0)this.displacementBias=e.displacementBias;if(e.roughnessMap!==void 0)this.roughnessMap=t[e.roughnessMap]||null;if(e.metalnessMap!==void 0)this.metalnessMap=t[e.metalnessMap]||null;if(e.emissiveMap!==void 0)this.emissiveMap=t[e.emissiveMap]||null;if(e.emissiveIntensity!==void 0)this.emissiveIntensity=e.emissiveIntensity;if(e.specularMap!==void 0)this.specularMap=t[e.specularMap]||null;if(e.specularIntensityMap!==void 0)this.specularIntensityMap=t[e.specularIntensityMap]||null;if(e.specularColorMap!==void 0)this.specularColorMap=t[e.specularColorMap]||null;if(e.envMap!==void 0)this.envMap=t[e.envMap]||null;if(e.envMapRotation!==void 0)this.envMapRotation.fromArray(e.envMapRotation);if(e.envMapIntensity!==void 0)this.envMapIntensity=e.envMapIntensity;if(e.reflectivity!==void 0)this.reflectivity=e.reflectivity;if(e.refractionRatio!==void 0)this.refractionRatio=e.refractionRatio;if(e.lightMap!==void 0)this.lightMap=t[e.lightMap]||null;if(e.lightMapIntensity!==void 0)this.lightMapIntensity=e.lightMapIntensity;if(e.aoMap!==void 0)this.aoMap=t[e.aoMap]||null;if(e.aoMapIntensity!==void 0)this.aoMapIntensity=e.aoMapIntensity;if(e.gradientMap!==void 0)this.gradientMap=t[e.gradientMap]||null;if(e.clearcoatMap!==void 0)this.clearcoatMap=t[e.clearcoatMap]||null;if(e.clearcoatRoughnessMap!==void 0)this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null;if(e.clearcoatNormalMap!==void 0)this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null;if(e.clearcoatNormalScale!==void 0)this.clearcoatNormalScale=new se().fromArray(e.clearcoatNormalScale);if(e.iridescenceMap!==void 0)this.iridescenceMap=t[e.iridescenceMap]||null;if(e.iridescenceThicknessMap!==void 0)this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null;if(e.transmissionMap!==void 0)this.transmissionMap=t[e.transmissionMap]||null;if(e.thicknessMap!==void 0)this.thicknessMap=t[e.thicknessMap]||null;if(e.anisotropyMap!==void 0)this.anisotropyMap=t[e.anisotropyMap]||null;if(e.sheenColorMap!==void 0)this.sheenColorMap=t[e.sheenColorMap]||null;if(e.sheenRoughnessMap!==void 0)this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null;return this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let i=t.length;n=Array(i);for(let r=0;r!==i;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){if(e===!0)this.version++}}class bs extends ii{constructor(e){super();this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new ke(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}var mr,is=new L,gr=new L,_r=new L,vr=new se,rs=new se,ym=new Ke,vo=new L,ss=new L,yo=new L,Qd=new se,Nl=new se,ep=new se;class ta extends Ct{constructor(e=new bs){super();if(this.isSprite=!0,this.type="Sprite",mr===void 0){mr=new Rt;let t=new Float32Array([-0.5,-0.5,0,0,0,0.5,-0.5,0,1,0,0.5,0.5,0,1,1,-0.5,0.5,0,0,1]),n=new jc(t,5);mr.setIndex([0,1,2,0,2,3]),mr.setAttribute("position",new fs(n,3,0,!1)),mr.setAttribute("uv",new fs(n,2,3,!1))}this.geometry=mr,this.material=e,this.center=new se(0.5,0.5),this.count=1}intersectsFrustum(e){return e.intersectsSprite(this)}raycast(e,t){if(e.camera===null)De('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.');if(gr.setFromMatrixScale(this.matrixWorld),ym.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),_r.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1)gr.multiplyScalar(-_r.z);let n=this.material.rotation,i,r;if(n!==0)r=Math.cos(n),i=Math.sin(n);let s=this.center;xo(vo.set(-0.5,-0.5,0),_r,s,gr,i,r),xo(ss.set(0.5,-0.5,0),_r,s,gr,i,r),xo(yo.set(0.5,0.5,0),_r,s,gr,i,r),Qd.set(0,0),Nl.set(1,0),ep.set(1,1);let o=e.ray.intersectTriangle(vo,ss,yo,!1,is);if(o===null){if(xo(ss.set(-0.5,0.5,0),_r,s,gr,i,r),Nl.set(0,1),o=e.ray.intersectTriangle(vo,yo,ss,!1,is),o===null)return}let a=e.ray.origin.distanceTo(is);if(a<e.near||a>e.far)return;t.push({distance:a,point:is.clone(),uv:fn.getInterpolation(is,vo,ss,yo,Qd,Nl,ep,new se),face:null,object:this})}copy(e,t){if(super.copy(e,t),e.center!==void 0)this.center.copy(e.center);return this.material=e.material,this}}function xo(e,t,n,i,r,s){if(vr.subVectors(e,n).addScalar(0.5).multiply(i),r!==void 0)rs.x=s*vr.x-r*vr.y,rs.y=r*vr.x+s*vr.y;else rs.copy(vr);e.copy(t),e.x+=rs.x,e.y+=rs.y,e.applyMatrix4(ym)}var Jn=new L,Ol=new L,bo=new L,So=new L;class Vi{constructor(e=new L,t=new L(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Jn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);if(n<0)return t.copy(this.origin);return t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Jn.subVectors(e,this.origin).dot(this.direction);if(t<0)return this.origin.distanceToSquared(e);return Jn.copy(this.origin).addScaledVector(this.direction,t),Jn.distanceToSquared(e)}distanceSqToSegment(e,t,n,i){Ol.copy(e).add(t).multiplyScalar(0.5),bo.copy(t).sub(e).normalize(),So.copy(this.origin).sub(Ol);let r=e.distanceTo(t)*0.5,s=-this.direction.dot(bo),o=So.dot(this.direction),a=-So.dot(bo),l=So.lengthSq(),c=Math.abs(1-s*s),h,f,u,p;if(c>0)if(h=s*a-o,f=s*o-a,p=r*c,h>=0)if(f>=-p)if(f<=p){let g=1/c;h*=g,f*=g,u=h*(h+s*f+2*o)+f*(s*h+f+2*a)+l}else f=r,h=Math.max(0,-(s*f+o)),u=-h*h+f*(f+2*a)+l;else f=-r,h=Math.max(0,-(s*f+o)),u=-h*h+f*(f+2*a)+l;else if(f<=-p)h=Math.max(0,-(-s*r+o)),f=h>0?-r:Math.min(Math.max(-r,-a),r),u=-h*h+f*(f+2*a)+l;else if(f<=p)h=0,f=Math.min(Math.max(-r,-a),r),u=f*(f+2*a)+l;else h=Math.max(0,-(s*r+o)),f=h>0?r:Math.min(Math.max(-r,-a),r),u=-h*h+f*(f+2*a)+l;else f=s>0?-r:r,h=Math.max(0,-(s*f+o)),u=-h*h+f*(f+2*a)+l;if(n)n.copy(this.origin).addScaledVector(this.direction,h);if(i)i.copy(Ol).addScaledVector(bo,f);return u}intersectSphere(e,t){if(e.radius<0)return null;Jn.subVectors(e.center,this.origin);let n=Jn.dot(this.direction),i=Jn.dot(Jn)-n*n,r=e.radius*e.radius;if(i>r)return null;let s=Math.sqrt(r-i),o=n-s,a=n+s;if(a<0)return null;if(o<0)return this.at(a,t);return this.at(o,t)}intersectsSphere(e){if(e.radius<0)return!1;return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0){if(e.distanceToPoint(this.origin)===0)return 0;return null}let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);if(n===null)return null;return this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);if(t===0)return!0;if(e.normal.dot(this.direction)*t<0)return!0;return!1}intersectBox(e,t){let n,i,r,s,o,a,l=1/this.direction.x,c=1/this.direction.y,h=1/this.direction.z,f=this.origin;if(l>=0)n=(e.min.x-f.x)*l,i=(e.max.x-f.x)*l;else n=(e.max.x-f.x)*l,i=(e.min.x-f.x)*l;if(c>=0)r=(e.min.y-f.y)*c,s=(e.max.y-f.y)*c;else r=(e.max.y-f.y)*c,s=(e.min.y-f.y)*c;if(n>s||r>i)return null;if(r>n||isNaN(n))n=r;if(s<i||isNaN(i))i=s;if(h>=0)o=(e.min.z-f.z)*h,a=(e.max.z-f.z)*h;else o=(e.max.z-f.z)*h,a=(e.min.z-f.z)*h;if(n>a||o>i)return null;if(o>n||n!==n)n=o;if(a<i||i!==i)i=a;if(i<0)return null;return this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,Jn)!==null}intersectTriangle(e,t,n,i,r){let s=this.origin,o=this.direction,{x:a,y:l,z:c}=o,h=e.x-s.x,f=e.y-s.y,u=e.z-s.z,p=t.x-s.x,g=t.y-s.y,y=t.z-s.z,m=n.x-s.x,d=n.y-s.y,b=n.z-s.z,S=Math.abs(a),_=Math.abs(l),x=Math.abs(c),w,T,v,A,N,P,D,W,R,I,k,z;if(S>=_&&S>=x)if(v=a,P=h,R=p,z=m,a>=0)w=l,T=c,A=f,N=u,D=g,W=y,I=d,k=b;else w=c,T=l,A=u,N=f,D=y,W=g,I=b,k=d;else if(_>=x)if(v=l,P=f,R=g,z=d,l>=0)w=c,T=a,A=u,N=h,D=y,W=p,I=b,k=m;else w=a,T=c,A=h,N=u,D=p,W=y,I=m,k=b;else if(v=c,P=u,R=y,z=b,c>=0)w=a,T=l,A=h,N=f,D=p,W=g,I=m,k=d;else w=l,T=a,A=f,N=h,D=g,W=p,I=d,k=m;if(v===0)return null;let te=w/v,Y=T/v,Q=1/v,G=A-te*P,ee=N-Y*P,oe=D-te*R,Ue=W-Y*R,Re=I-te*z,X=k-Y*z,re=Re*Ue-X*oe,le=G*X-ee*Re,Pe=oe*ee-Ue*G;if(i){if(re<0||le<0||Pe<0)return null}else if((re<0||le<0||Pe<0)&&(re>0||le>0||Pe>0))return null;let Oe=re+le+Pe;if(Oe===0)return null;let Ae=Q*(re*P+le*R+Pe*z);if(Oe>0?Ae<0:Ae>0)return null;return this.at(Ae/Oe,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Or extends ii{constructor(e){super();this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ke(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ti,this.combine=0,this.reflectivity=1,this.refractionRatio=0.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}var tp=new Ke,Ni=new Vi,Mo=new Nr,np=new L,wo=new L,Eo=new L,To=new L,Ul=new L,Ao=new L,ip=new L,Co=new L;class Bt extends Ct{constructor(e=new Rt,t=new Or){super();this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){if(super.copy(e,t),e.morphTargetInfluences!==void 0)this.morphTargetInfluences=e.morphTargetInfluences.slice();if(e.morphTargetDictionary!==void 0)this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary);return this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){let o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){let n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,s=n.morphTargetsRelative;t.fromBufferAttribute(i,e);let o=this.morphTargetInfluences;if(r&&o){Ao.set(0,0,0);for(let a=0,l=r.length;a<l;a++){let c=o[a],h=r[a];if(c===0)continue;if(Ul.fromBufferAttribute(h,e),s)Ao.addScaledVector(Ul,c);else Ao.addScaledVector(Ul.sub(t),c)}t.add(Ao)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.material,r=this.matrixWorld;if(i===void 0)return;if(n.boundingSphere===null)n.computeBoundingSphere();if(Mo.copy(n.boundingSphere),Mo.applyMatrix4(r),Ni.copy(e.ray).recast(e.near),Mo.containsPoint(Ni.origin)===!1){if(Ni.intersectSphere(Mo,np)===null)return;if(Ni.origin.distanceToSquared(np)>(e.far-e.near)**2)return}if(tp.copy(r).invert(),Ni.copy(e.ray).applyMatrix4(tp),n.boundingBox!==null){if(Ni.intersectsBox(n.boundingBox)===!1)return}this._computeIntersections(e,t,Ni)}_computeIntersections(e,t,n){let i,r=this.geometry,s=this.material,o=r.index,a=r.attributes.position,l=r.attributes.uv,c=r.attributes.uv1,h=r.attributes.normal,{groups:f,drawRange:u}=r;if(o!==null)if(Array.isArray(s))for(let p=0,g=f.length;p<g;p++){let y=f[p],m=s[y.materialIndex],d=Math.max(y.start,u.start),b=Math.min(o.count,Math.min(y.start+y.count,u.start+u.count));for(let S=d,_=b;S<_;S+=3){let x=o.getX(S),w=o.getX(S+1),T=o.getX(S+2);if(i=Ro(this,m,e,n,l,c,h,x,w,T),i)i.faceIndex=Math.floor(S/3),i.face.materialIndex=y.materialIndex,t.push(i)}}else{let p=Math.max(0,u.start),g=Math.min(o.count,u.start+u.count);for(let y=p,m=g;y<m;y+=3){let d=o.getX(y),b=o.getX(y+1),S=o.getX(y+2);if(i=Ro(this,s,e,n,l,c,h,d,b,S),i)i.faceIndex=Math.floor(y/3),t.push(i)}}else if(a!==void 0)if(Array.isArray(s))for(let p=0,g=f.length;p<g;p++){let y=f[p],m=s[y.materialIndex],d=Math.max(y.start,u.start),b=Math.min(a.count,Math.min(y.start+y.count,u.start+u.count));for(let S=d,_=b;S<_;S+=3){let x=S,w=S+1,T=S+2;if(i=Ro(this,m,e,n,l,c,h,x,w,T),i)i.faceIndex=Math.floor(S/3),i.face.materialIndex=y.materialIndex,t.push(i)}}else{let p=Math.max(0,u.start),g=Math.min(a.count,u.start+u.count);for(let y=p,m=g;y<m;y+=3){let d=y,b=y+1,S=y+2;if(i=Ro(this,s,e,n,l,c,h,d,b,S),i)i.faceIndex=Math.floor(y/3),t.push(i)}}}}function zv(e,t,n,i,r,s,o,a){let l;if(t.side===1)l=i.intersectTriangle(o,s,r,!0,a);else l=i.intersectTriangle(r,s,o,t.side===0,a);if(l===null)return null;Co.copy(a),Co.applyMatrix4(e.matrixWorld);let c=n.ray.origin.distanceTo(Co);if(c<n.near||c>n.far)return null;return{distance:c,point:Co.clone(),object:e}}function Ro(e,t,n,i,r,s,o,a,l,c){e.getVertexPosition(a,wo),e.getVertexPosition(l,Eo),e.getVertexPosition(c,To);let h=zv(e,t,n,i,wo,Eo,To,ip);if(h){let f=new L;if(fn.getBarycoord(ip,wo,Eo,To,f),r)h.uv=fn.getInterpolatedAttribute(r,a,l,c,f,new se);if(s)h.uv1=fn.getInterpolatedAttribute(s,a,l,c,f,new se);if(o){if(h.normal=fn.getInterpolatedAttribute(o,a,l,c,f,new L),h.normal.dot(i.direction)>0)h.normal.multiplyScalar(-1)}let u={a,b:l,c,normal:new L,materialIndex:0};fn.getNormal(wo,Eo,To,u.normal),h.face=u,h.barycoord=f}return h}class Yc extends Ot{constructor(e=null,t=1,n=1,i,r,s,o,a,l=1003,c=1003,h,f){super(null,s,o,a,l,c,i,r,h,f);this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}var Oi=new Nr,Gv=new se(0.5,0.5),Po=new L;class Ss{constructor(e=new rn,t=new rn,n=new rn,i=new rn,r=new rn,s=new rn){this.planes=[e,t,n,i,r,s]}set(e,t,n,i,r,s){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(i),o[4].copy(r),o[5].copy(s),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=2000,n=!1){let i=this.planes,r=e.elements,s=r[0],o=r[1],a=r[2],l=r[3],c=r[4],h=r[5],f=r[6],u=r[7],p=r[8],g=r[9],y=r[10],m=r[11],d=r[12],b=r[13],S=r[14],_=r[15];if(i[0].setComponents(l-s,u-c,m-p,_-d).normalize(),i[1].setComponents(l+s,u+c,m+p,_+d).normalize(),i[2].setComponents(l+o,u+h,m+g,_+b).normalize(),i[3].setComponents(l-o,u-h,m-g,_-b).normalize(),n)i[4].setComponents(a,f,y,S).normalize(),i[5].setComponents(l-a,u-f,m-y,_-S).normalize();else if(i[4].setComponents(l-a,u-f,m-y,_-S).normalize(),t===2000)i[5].setComponents(l+a,u+f,m+y,_+S).normalize();else if(t===2001)i[5].setComponents(a,f,y,S).normalize();else throw Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0){if(e.boundingSphere===null)e.computeBoundingSphere();Oi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld)}else{let t=e.geometry;if(t.boundingSphere===null)t.computeBoundingSphere();Oi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Oi)}intersectsSprite(e){Oi.center.set(0,0,0);let t=Gv.distanceTo(e.center);return Oi.radius=0.7071067811865476+t,Oi.applyMatrix4(e.matrixWorld),this.intersectsSphere(Oi)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(Po.x=i.normal.x>0?e.max.x:e.min.x,Po.y=i.normal.y>0?e.max.y:e.min.y,Po.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(Po)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Ms extends ii{constructor(e){super();this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new ke(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}var Uo=new L,Fo=new L,rp=new Ke,os=new Vi,Io=new Nr,Fl=new L,sp=new L;class na extends Ct{constructor(e=new Rt,t=new Ms){super();this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,r=t.count;i<r;i++)Uo.fromBufferAttribute(t,i-1),Fo.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=Uo.distanceTo(Fo);e.setAttribute("lineDistance",new mt(n,1))}else Ie("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Line.threshold,s=n.drawRange;if(n.boundingSphere===null)n.computeBoundingSphere();if(Io.copy(n.boundingSphere),Io.applyMatrix4(i),Io.radius+=r,e.ray.intersectsSphere(Io)===!1)return;rp.copy(i).invert(),os.copy(e.ray).applyMatrix4(rp);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),a=o*o,l=this.isLineSegments?2:1,c=n.index,f=n.attributes.position;if(c!==null){let u=Math.max(0,s.start),p=Math.min(c.count,s.start+s.count);for(let g=u,y=p-1;g<y;g+=l){let m=c.getX(g),d=c.getX(g+1),b=Lo(this,e,os,a,m,d,g);if(b)t.push(b)}if(this.isLineLoop){let g=c.getX(p-1),y=c.getX(u),m=Lo(this,e,os,a,g,y,p-1);if(m)t.push(m)}}else{let u=Math.max(0,s.start),p=Math.min(f.count,s.start+s.count);for(let g=u,y=p-1;g<y;g+=l){let m=Lo(this,e,os,a,g,g+1,g);if(m)t.push(m)}if(this.isLineLoop){let g=Lo(this,e,os,a,p-1,u,p-1);if(g)t.push(g)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){let o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Lo(e,t,n,i,r,s,o){let a=e.geometry.attributes.position;if(Uo.fromBufferAttribute(a,r),Fo.fromBufferAttribute(a,s),n.distanceSqToSegment(Uo,Fo,Fl,sp)>i)return;Fl.applyMatrix4(e.matrixWorld);let c=t.ray.origin.distanceTo(Fl);if(c<t.near||c>t.far)return;return{distance:c,point:sp.clone().applyMatrix4(e.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:e}}class ia extends Ot{constructor(e=[],t=301,n,i,r,s,o,a,l,c){super(e,t,n,i,r,s,o,a,l,c);this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class ra extends Ot{constructor(e,t,n,i,r,s,o,a,l){super(e,t,n,i,r,s,o,a,l);this.isCanvasTexture=!0,this.needsUpdate=!0}}class Wi extends Ot{constructor(e,t,n=1014,i,r,s,o=1003,a=1003,l,c=1026,h=1){if(c!==1026&&c!==1027)throw Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let f={width:e,height:t,depth:h};super(f,i,r,s,o,a,c,n,l);this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new vs(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}}class $c extends Wi{constructor(e,t=1014,n=301,i,r,s=1003,o=1003,a,l=1026){let c={width:e,height:e,depth:1},h=[c,c,c,c,c,c];super(e,e,t,n,i,r,s,o,a,l);this.image=h,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class sa extends Ot{constructor(e=null){super();this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Ur extends Rt{constructor(e=1,t=1,n=1,i=1,r=1,s=1){super();this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:r,depthSegments:s};let o=this;i=Math.floor(i),r=Math.floor(r),s=Math.floor(s);let a=[],l=[],c=[],h=[],f=0,u=0;p("z","y","x",-1,-1,n,t,e,s,r,0),p("z","y","x",1,-1,n,t,-e,s,r,1),p("x","z","y",1,1,e,n,t,i,s,2),p("x","z","y",1,-1,e,n,-t,i,s,3),p("x","y","z",1,-1,e,t,n,i,r,4),p("x","y","z",-1,-1,e,t,-n,i,r,5),this.setIndex(a),this.setAttribute("position",new mt(l,3)),this.setAttribute("normal",new mt(c,3)),this.setAttribute("uv",new mt(h,2));function p(g,y,m,d,b,S,_,x,w,T,v){let A=S/w,N=_/T,P=S/2,D=_/2,W=x/2,R=w+1,I=T+1,k=0,z=0,te=new L;for(let Y=0;Y<I;Y++){let Q=Y*N-D;for(let G=0;G<R;G++){let ee=G*A-P;te[g]=ee*d,te[y]=Q*b,te[m]=W,l.push(te.x,te.y,te.z),te[g]=0,te[y]=0,te[m]=x>0?1:-1,c.push(te.x,te.y,te.z),h.push(G/w),h.push(1-Y/T),k+=1}}for(let Y=0;Y<T;Y++)for(let Q=0;Q<w;Q++){let G=f+Q+R*Y,ee=f+Q+R*(Y+1),oe=f+(Q+1)+R*(Y+1),Ue=f+(Q+1)+R*Y;a.push(G,ee,Ue),a.push(ee,oe,Ue),z+=6}o.addGroup(u,z,v),u+=z,f+=k}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ur(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class Fr extends Rt{constructor(e=1,t=1,n=1,i=32,r=1,s=!1,o=0,a=Math.PI*2){super();this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:r,openEnded:s,thetaStart:o,thetaLength:a};let l=this;i=Math.floor(i),r=Math.floor(r);let c=[],h=[],f=[],u=[],p=0,g=[],y=n/2,m=0;if(d(),s===!1){if(e>0)b(!0);if(t>0)b(!1)}this.setIndex(c),this.setAttribute("position",new mt(h,3)),this.setAttribute("normal",new mt(f,3)),this.setAttribute("uv",new mt(u,2));function d(){let S=new L,_=new L,x=0,w=(t-e)/n;for(let T=0;T<=r;T++){let v=[],A=T/r,N=A*(t-e)+e;for(let P=0;P<=i;P++){let D=P/i,W=D*a+o,R=Math.sin(W),I=Math.cos(W);_.x=N*R,_.y=-A*n+y,_.z=N*I,h.push(_.x,_.y,_.z),S.set(R,w,I).normalize(),f.push(S.x,S.y,S.z),u.push(D,1-A),v.push(p++)}g.push(v)}for(let T=0;T<i;T++)for(let v=0;v<r;v++){let A=g[v][T],N=g[v+1][T],P=g[v+1][T+1],D=g[v][T+1];if(e>0||v!==0)c.push(A,N,D),x+=3;if(t>0||v!==r-1)c.push(N,P,D),x+=3}l.addGroup(m,x,0),m+=x}function b(S){let _=p,x=new se,w=new L,T=0,v=S===!0?e:t,A=S===!0?1:-1;for(let P=1;P<=i;P++)h.push(0,y*A,0),f.push(0,A,0),u.push(0.5,0.5),p++;let N=p;for(let P=0;P<=i;P++){let W=P/i*a+o,R=Math.cos(W),I=Math.sin(W);w.x=v*I,w.y=y*A,w.z=v*R,h.push(w.x,w.y,w.z),f.push(0,A,0),x.x=R*0.5+0.5,x.y=I*0.5*A+0.5,u.push(x.x,x.y),p++}for(let P=0;P<i;P++){let D=_+P,W=N+P;if(S===!0)c.push(W,W+1,D);else c.push(W+1,W,D);T+=3}l.addGroup(m,T,S===!0?1:2),m+=T}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Fr(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class ws extends Fr{constructor(e=1,t=1,n=32,i=1,r=!1,s=0,o=Math.PI*2){super(0,e,t,n,i,r,s,o);this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:s,thetaLength:o}}static fromJSON(e){return new ws(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class In{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Ie("Curve: .getPoint() not implemented.")}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,i=this.getPoint(0),r=0;t.push(0);for(let s=1;s<=e;s++)n=this.getPoint(s/e),r+=n.distanceTo(i),t.push(r),i=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),i=0,r=n.length,s;if(t)s=t;else s=e*n[r-1];let o=0,a=r-1,l;while(o<=a)if(i=Math.floor(o+(a-o)/2),l=n[i]-s,l<0)o=i+1;else if(l>0)a=i-1;else{a=i;break}if(i=a,n[i]===s)return i/(r-1);let c=n[i],f=n[i+1]-c,u=(s-c)/f;return(i+u)/(r-1)}getTangent(e,t){let i=e-0.0001,r=e+0.0001;if(i<0)i=0;if(r>1)r=1;let s=this.getPoint(i),o=this.getPoint(r),a=t||(s.isVector2?new se:new L);return a.copy(o).sub(s).normalize(),a}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new L,i=[],r=[],s=[],o=new L,a=new Ke;for(let u=0;u<=e;u++){let p=u/e;i[u]=this.getTangentAt(p,new L)}r[0]=new L,s[0]=new L;let l=Number.MAX_VALUE,c=Math.abs(i[0].x),h=Math.abs(i[0].y),f=Math.abs(i[0].z);if(c<=l)l=c,n.set(1,0,0);if(h<=l)l=h,n.set(0,1,0);if(f<=l)n.set(0,0,1);o.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],o),s[0].crossVectors(i[0],r[0]);for(let u=1;u<=e;u++){if(r[u]=r[u-1].clone(),s[u]=s[u-1].clone(),o.crossVectors(i[u-1],i[u]),o.length()>Number.EPSILON){o.normalize();let p=Math.acos(He(i[u-1].dot(i[u]),-1,1));r[u].applyMatrix4(a.makeRotationAxis(o,p))}s[u].crossVectors(i[u],r[u])}if(t===!0){let u=Math.acos(He(r[0].dot(r[e]),-1,1));if(u/=e,i[0].dot(o.crossVectors(r[0],r[e]))>0)u=-u;for(let p=1;p<=e;p++)r[p].applyMatrix4(a.makeRotationAxis(i[p],u*p)),s[p].crossVectors(i[p],r[p])}return{tangents:i,normals:r,binormals:s}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}}class oa extends In{constructor(e=0,t=0,n=1,i=1,r=0,s=Math.PI*2,o=!1,a=0){super();this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=s,this.aClockwise=o,this.aRotation=a}getPoint(e,t=new se){let n=t,i=Math.PI*2,r=this.aEndAngle-this.aStartAngle,s=Math.abs(r)<Number.EPSILON;while(r<0)r+=i;while(r>i)r-=i;if(r<Number.EPSILON)if(s)r=0;else r=i;if(this.aClockwise===!0&&!s)if(r===i)r=-i;else r=r-i;let o=this.aStartAngle+e*r,a=this.aX+this.xRadius*Math.cos(o),l=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let c=Math.cos(this.aRotation),h=Math.sin(this.aRotation),f=a-this.aX,u=l-this.aY;a=f*c-u*h+this.aX,l=f*h+u*c+this.aY}return n.set(a,l)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}}class Zc extends oa{constructor(e,t,n,i,r,s){super(e,t,n,n,i,r,s);this.isArcCurve=!0,this.type="ArcCurve"}}function Jc(){let e=0,t=0,n=0,i=0;function r(s,o,a,l){e=s,t=a,n=-3*s+3*o-2*a-l,i=2*s-2*o+a+l}return{initCatmullRom:function(s,o,a,l,c){r(o,a,c*(a-s),c*(l-o))},initNonuniformCatmullRom:function(s,o,a,l,c,h,f){let u=(o-s)/c-(a-s)/(c+h)+(a-o)/h,p=(a-o)/h-(l-o)/(h+f)+(l-a)/f;u*=h,p*=h,r(o,a,u,p)},calc:function(s){let o=s*s,a=o*s;return e+t*s+n*o+i*a}}}var op=new L,ap=new L,Bl=new Jc,kl=new Jc,zl=new Jc;class Kc extends In{constructor(e=[],t=!1,n="centripetal",i=0.5){super();this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=i}getPoint(e,t=new L){let n=t,i=this.points,r=i.length,s=(r-(this.closed?0:1))*e,o=Math.floor(s),a=s-o;if(this.closed)o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r;else if(a===0&&o===r-1)o=r-2,a=1;let l,c;if(this.closed||o>0)l=i[(o-1)%r];else ap.subVectors(i[0],i[1]).add(i[0]),l=ap;let h=i[o%r],f=i[(o+1)%r];if(this.closed||o+2<r)c=i[(o+2)%r];else op.subVectors(i[r-1],i[r-2]).add(i[r-1]),c=op;if(this.curveType==="centripetal"||this.curveType==="chordal"){let u=this.curveType==="chordal"?0.5:0.25,p=Math.pow(l.distanceToSquared(h),u),g=Math.pow(h.distanceToSquared(f),u),y=Math.pow(f.distanceToSquared(c),u);if(g<0.0001)g=1;if(p<0.0001)p=g;if(y<0.0001)y=g;Bl.initNonuniformCatmullRom(l.x,h.x,f.x,c.x,p,g,y),kl.initNonuniformCatmullRom(l.y,h.y,f.y,c.y,p,g,y),zl.initNonuniformCatmullRom(l.z,h.z,f.z,c.z,p,g,y)}else if(this.curveType==="catmullrom")Bl.initCatmullRom(l.x,h.x,f.x,c.x,this.tension),kl.initCatmullRom(l.y,h.y,f.y,c.y,this.tension),zl.initCatmullRom(l.z,h.z,f.z,c.z,this.tension);return n.set(Bl.calc(a),kl.calc(a),zl.calc(a)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new L().fromArray(i))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}}function lp(e,t,n,i,r){let s=(i-t)*0.5,o=(r-n)*0.5,a=e*e,l=e*a;return(2*n-2*i+s+o)*l+(-3*n+3*i-2*s-o)*a+s*e+n}function Hv(e,t){let n=1-e;return n*n*t}function Vv(e,t){return 2*(1-e)*e*t}function Wv(e,t){return e*e*t}function cs(e,t,n,i){return Hv(e,t)+Vv(e,n)+Wv(e,i)}function Xv(e,t){let n=1-e;return n*n*n*t}function qv(e,t){let n=1-e;return 3*n*n*e*t}function jv(e,t){return 3*(1-e)*e*e*t}function Yv(e,t){return e*e*e*t}function hs(e,t,n,i,r){return Xv(e,t)+qv(e,n)+jv(e,i)+Yv(e,r)}class Qc extends In{constructor(e=new se,t=new se,n=new se,i=new se){super();this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new se){let n=t,i=this.v0,r=this.v1,s=this.v2,o=this.v3;return n.set(hs(e,i.x,r.x,s.x,o.x),hs(e,i.y,r.y,s.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class Es extends In{constructor(e=new L,t=new L,n=new L,i=new L){super();this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new L){let n=t,i=this.v0,r=this.v1,s=this.v2,o=this.v3;return n.set(hs(e,i.x,r.x,s.x,o.x),hs(e,i.y,r.y,s.y,o.y),hs(e,i.z,r.z,s.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class eh extends In{constructor(e=new se,t=new se){super();this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new se){let n=t;if(e===1)n.copy(this.v2);else n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1);return n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new se){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class th extends In{constructor(e=new L,t=new L){super();this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new L){let n=t;if(e===1)n.copy(this.v2);else n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1);return n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new L){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class nh extends In{constructor(e=new se,t=new se,n=new se){super();this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new se){let n=t,i=this.v0,r=this.v1,s=this.v2;return n.set(cs(e,i.x,r.x,s.x),cs(e,i.y,r.y,s.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class Br extends In{constructor(e=new L,t=new L,n=new L){super();this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new L){let n=t,i=this.v0,r=this.v1,s=this.v2;return n.set(cs(e,i.x,r.x,s.x),cs(e,i.y,r.y,s.y),cs(e,i.z,r.z,s.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class ih extends In{constructor(e=[]){super();this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new se){let n=t,i=this.points,r=(i.length-1)*e,s=Math.floor(r),o=r-s,a=i[s===0?s:s-1],l=i[s],c=i[s>i.length-2?i.length-1:s+1],h=i[s>i.length-3?i.length-1:s+2];return n.set(lp(o,a.x,l.x,c.x,h.x),lp(o,a.y,l.y,c.y,h.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new se().fromArray(i))}return this}}var $v=Object.freeze({__proto__:null,ArcCurve:Zc,CatmullRomCurve3:Kc,CubicBezierCurve:Qc,CubicBezierCurve3:Es,EllipseCurve:oa,LineCurve:eh,LineCurve3:th,QuadraticBezierCurve:nh,QuadraticBezierCurve3:Br,SplineCurve:ih});class Ts extends Rt{constructor(e=1,t=1,n=1,i=1){super();this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let r=e/2,s=t/2,o=Math.floor(n),a=Math.floor(i),l=o+1,c=a+1,h=e/o,f=t/a,u=[],p=[],g=[],y=[];for(let m=0;m<c;m++){let d=m*f-s;for(let b=0;b<l;b++){let S=b*h-r;p.push(S,-d,0),g.push(0,0,1),y.push(b/o),y.push(1-m/a)}}for(let m=0;m<a;m++)for(let d=0;d<o;d++){let b=d+l*m,S=d+l*(m+1),_=d+1+l*(m+1),x=d+1+l*m;u.push(b,S,x),u.push(S,_,x)}this.setIndex(u),this.setAttribute("position",new mt(p,3)),this.setAttribute("normal",new mt(g,3)),this.setAttribute("uv",new mt(y,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ts(e.width,e.height,e.widthSegments,e.heightSegments)}}class Xi extends Rt{constructor(e=1,t=32,n=16,i=0,r=Math.PI*2,s=0,o=Math.PI){super();this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:i,phiLength:r,thetaStart:s,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let a=Math.min(s+o,Math.PI),l=0,c=[],h=new L,f=new L,u=[],p=[],g=[],y=[];for(let m=0;m<=n;m++){let d=[],b=m/n,S=s+b*o,_=e*Math.cos(S),x=Math.sqrt(e*e-_*_),w=0;if(m===0&&s===0)w=0.5/t;else if(m===n&&a===Math.PI)w=-0.5/t;for(let T=0;T<=t;T++){let v=T/t,A=i+v*r;h.x=-x*Math.cos(A),h.y=_,h.z=x*Math.sin(A),p.push(h.x,h.y,h.z),f.copy(h).normalize(),g.push(f.x,f.y,f.z),y.push(v+w,1-b),d.push(l++)}c.push(d)}for(let m=0;m<n;m++)for(let d=0;d<t;d++){let b=c[m][d+1],S=c[m][d],_=c[m+1][d],x=c[m+1][d+1];if(m!==0||s>0)u.push(b,S,x);if(m!==n-1||a<Math.PI)u.push(S,_,x)}this.setIndex(u),this.setAttribute("position",new mt(p,3)),this.setAttribute("normal",new mt(g,3)),this.setAttribute("uv",new mt(y,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Xi(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class As extends Rt{constructor(e=new Br(new L(-1,-1,0),new L(-1,1,0),new L(1,1,0)),t=64,n=1,i=8,r=!1){super();this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:i,closed:r};let s=e.computeFrenetFrames(t,r);this.tangents=s.tangents,this.normals=s.normals,this.binormals=s.binormals;let o=new L,a=new L,l=new se,c=new L,h=[],f=[],u=[],p=[];g(),this.setIndex(p),this.setAttribute("position",new mt(h,3)),this.setAttribute("normal",new mt(f,3)),this.setAttribute("uv",new mt(u,2));function g(){for(let b=0;b<t;b++)y(b);y(r===!1?t:0),d(),m()}function y(b){c=e.getPointAt(b/t,c);let S=s.normals[b],_=s.binormals[b];for(let x=0;x<=i;x++){let w=x/i*Math.PI*2,T=Math.sin(w),v=-Math.cos(w);a.x=v*S.x+T*_.x,a.y=v*S.y+T*_.y,a.z=v*S.z+T*_.z,a.normalize(),f.push(a.x,a.y,a.z),o.x=c.x+n*a.x,o.y=c.y+n*a.y,o.z=c.z+n*a.z,h.push(o.x,o.y,o.z)}}function m(){for(let b=1;b<=t;b++)for(let S=1;S<=i;S++){let _=(i+1)*(b-1)+(S-1),x=(i+1)*b+(S-1),w=(i+1)*b+S,T=(i+1)*(b-1)+S;p.push(_,x,T),p.push(x,w,T)}}function d(){for(let b=0;b<=t;b++)for(let S=0;S<=i;S++)l.x=b/t,l.y=S/i,u.push(l.x,l.y)}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new As(new $v[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}}function qi(e){let t={};for(let n in e){t[n]={};for(let i in e[n]){let r=e[n][i];if(cp(r))if(r.isRenderTargetTexture)Ie("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[n][i]=null;else t[n][i]=r.clone();else if(Array.isArray(r))if(cp(r[0])){let s=[];for(let o=0,a=r.length;o<a;o++)s[o]=r[o].clone();t[n][i]=s}else t[n][i]=r.slice();else t[n][i]=r}}return t}function Wt(e){let t={};for(let n=0;n<e.length;n++){let i=qi(e[n]);for(let r in i)t[r]=i[r]}return t}function cp(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function Zv(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function rh(e){let t=e.getRenderTarget();if(t===null)return e.outputColorSpace;if(t.isXRRenderTarget===!0)return t.texture.colorSpace;return qe.workingColorSpace}var aa={clone:qi,merge:Wt},Jv=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Kv=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Jt extends ii{constructor(e){super();if(this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Jv,this.fragmentShader=Kv,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0)this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=qi(e.uniforms),this.uniformsGroups=Zv(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let s=this.uniforms[i].value;if(s&&s.isTexture)t.uniforms[i]={type:"t",value:s.toJSON(e).uuid};else if(s&&s.isColor)t.uniforms[i]={type:"c",value:s.getHex()};else if(s&&s.isVector2)t.uniforms[i]={type:"v2",value:s.toArray()};else if(s&&s.isVector3)t.uniforms[i]={type:"v3",value:s.toArray()};else if(s&&s.isVector4)t.uniforms[i]={type:"v4",value:s.toArray()};else if(s&&s.isMatrix3)t.uniforms[i]={type:"m3",value:s.toArray()};else if(s&&s.isMatrix4)t.uniforms[i]={type:"m4",value:s.toArray()};else t.uniforms[i]={value:s}}if(Object.keys(this.defines).length>0)t.defines=this.defines;t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let i in this.extensions)if(this.extensions[i]===!0)n[i]=!0;if(Object.keys(n).length>0)t.extensions=n;return t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let i=e.uniforms[n];switch(this.uniforms[n]={},i.type){case"t":this.uniforms[n].value=t[i.value]||null;break;case"c":this.uniforms[n].value=new ke().setHex(i.value);break;case"v2":this.uniforms[n].value=new se().fromArray(i.value);break;case"v3":this.uniforms[n].value=new L().fromArray(i.value);break;case"v4":this.uniforms[n].value=new gt().fromArray(i.value);break;case"m3":this.uniforms[n].value=new Fe().fromArray(i.value);break;case"m4":this.uniforms[n].value=new Ke().fromArray(i.value);break;default:this.uniforms[n].value=i.value}}if(e.defines!==void 0)this.defines=e.defines;if(e.vertexShader!==void 0)this.vertexShader=e.vertexShader;if(e.fragmentShader!==void 0)this.fragmentShader=e.fragmentShader;if(e.glslVersion!==void 0)this.glslVersion=e.glslVersion;if(e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];if(e.lights!==void 0)this.lights=e.lights;if(e.clipping!==void 0)this.clipping=e.clipping;return this}}class sh extends Jt{constructor(e){super(e);this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class la extends ii{constructor(e){super();this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new ke(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ke(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new se(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ti,this.combine=0,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=0.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class oh extends ii{constructor(e){super();this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=3200,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class ah extends ii{constructor(e){super();this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}function yr(e,t){if(!e||e.constructor===t)return e;if(typeof t.BYTES_PER_ELEMENT==="number")return new t(e);return Array.prototype.slice.call(e)}function Gl(e){return e!==void 0&&e.inTangents!==void 0&&e.outTangents!==void 0}class ji{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],r=t[n-1];e:{t:{let s;n:{i:if(!(e<i)){for(let o=n+2;;){if(i===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=i,i=t[++n],e<i)break t}s=t.length;break n}if(!(e>=r)){let o=t[1];if(e<o)n=2,r=o;for(let a=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(i=r,r=t[--n-1],e>=r)break t}s=n,n=0;break n}break e}while(n<s){let o=n+s>>>1;if(e<t[o])s=o;else n=o+1}if(i=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,i)}return this.interpolate_(n,r,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i;for(let s=0;s!==i;++s)t[s]=n[r+s];return t}interpolate_(){throw Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}}class lh extends ji{constructor(e,t,n,i){super(e,t,n,i);this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:2400,endingEnd:2400}}intervalChanged_(e,t,n){let i=this.parameterPositions,r=e-2,s=e+1,o=i[r],a=i[s];if(o===void 0)switch(this.getSettings_().endingStart){case 2401:r=e,o=2*t-n;break;case 2402:r=i.length-2,o=t+i[r]-i[r+1];break;default:r=e,o=n}if(a===void 0)switch(this.getSettings_().endingEnd){case 2401:s=e,a=2*n-t;break;case 2402:s=1,a=n+i[1]-i[0];break;default:s=e-1,a=t}let l=(n-t)*0.5,c=this.valueSize;this._weightPrev=l/(t-o),this._weightNext=l/(a-n),this._offsetPrev=r*c,this._offsetNext=s*c}interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,c=this._offsetPrev,h=this._offsetNext,f=this._weightPrev,u=this._weightNext,p=(n-t)/(i-t),g=p*p,y=g*p,m=-f*y+2*f*g-f*p,d=(1+f)*y+(-1.5-2*f)*g+(-0.5+f)*p+1,b=(-1-u)*y+(1.5+u)*g+0.5*p,S=u*y-u*g;for(let _=0;_!==o;++_)r[_]=m*s[c+_]+d*s[l+_]+b*s[a+_]+S*s[h+_];return r}}class ch extends ji{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,c=(n-t)/(i-t),h=1-c;for(let f=0;f!==o;++f)r[f]=s[l+f]*h+s[a+f]*c;return r}}class hh extends ji{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}}class uh extends ji{interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=e*o,l=a-o,c=this.inTangents,h=this.outTangents;if(!c||!h){let p=(n-t)/(i-t),g=1-p;for(let y=0;y!==o;++y)r[y]=s[l+y]*g+s[a+y]*p;return r}let f=o*2,u=e-1;for(let p=0;p!==o;++p){let g=s[l+p],y=s[a+p],m=u*f+p*2,d=h[m],b=h[m+1],S=e*f+p*2,_=c[S],x=c[S+1],w=ey(n,t,d,_,i);r[p]=xm(w,g,b,x,y)}return r}}function xm(e,t,n,i,r){let s=1-e;return s*s*s*t+3*s*s*e*n+3*s*e*e*i+e*e*e*r}function Qv(e,t,n,i,r){let s=1-e;return 3*s*s*(n-t)+6*s*e*(i-n)+3*e*e*(r-i)}function ey(e,t,n,i,r){let s=(e-t)/(r-t);for(let o=0;o<8;o++){let a=xm(s,t,n,i,r)-e;if(Math.abs(a)<0.0000000001)break;let l=Qv(s,t,n,i,r);if(Math.abs(l)<0.0000000001)break;s=Math.max(0,Math.min(1,s-a/l))}return s}class Sn{constructor(e,t,n,i){if(e===void 0)throw Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=yr(t,this.TimeBufferType),this.values=yr(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:yr(e.times,Array),values:yr(e.values,Array)};let i=e.getInterpolation();if(i!==e.DefaultInterpolation)n.interpolation=i;if(Gl(e.settings))n.settings={inTangents:yr(e.settings.inTangents,Array),outTangents:yr(e.settings.outTangents,Array)}}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new hh(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new ch(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new lh(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new uh(this.times,this.values,this.getValueSize(),e);if(this.settings)t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents;return t}setInterpolation(e){let t;switch(e){case 2300:t=this.InterpolantFactoryMethodDiscrete;break;case 2301:t=this.InterpolantFactoryMethodLinear;break;case 2302:t=this.InterpolantFactoryMethodSmooth;break;case 2303:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(n);return Ie("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return 2300;case this.InterpolantFactoryMethodLinear:return 2301;case this.InterpolantFactoryMethodSmooth:return 2302;case this.InterpolantFactoryMethodBezier:return 2303}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e;if(Gl(this.settings))hp(this.settings.inTangents,e),hp(this.settings.outTangents,e)}return this}trim(e,t){let n=this.times,i=n.length,r=0,s=i-1;while(r!==i&&n[r]<e)++r;while(s!==-1&&n[s]>t)--s;if(++s,r!==0||s!==i){if(r>=s)s=Math.max(s,1),r=s-1;let o=this.getValueSize();this.times=n.slice(r,s),this.values=this.values.slice(r*o,s*o)}return this}validate(){let e=!0,t=this.getValueSize();if(t-Math.floor(t)!==0)De("KeyframeTrack: Invalid value size in track.",this),e=!1;let n=this.times,i=this.values,r=n.length;if(r===0)De("KeyframeTrack: Track is empty.",this),e=!1;let s=null;for(let o=0;o!==r;o++){let a=n[o];if(typeof a==="number"&&isNaN(a)){De("KeyframeTrack: Time is not a valid number.",this,o,a),e=!1;break}if(s!==null&&s>a){De("KeyframeTrack: Out of order keys.",this,o,a,s),e=!1;break}s=a}if(i!==void 0){if(av(i))for(let o=0,a=i.length;o!==a;++o){let l=i[o];if(isNaN(l)){De("KeyframeTrack: Value is not a valid number.",this,o,l),e=!1;break}}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===2302,r=e.length-1,s=1;for(let o=1;o<r;++o){let a=!1,l=e[o],c=e[o+1];if(l!==c&&(o!==1||l!==e[0]))if(!i){let h=o*n,f=h-n,u=h+n;for(let p=0;p!==n;++p){let g=t[h+p];if(g!==t[f+p]||g!==t[u+p]){a=!0;break}}}else a=!0;if(a){if(o!==s){e[s]=e[o];let h=o*n,f=s*n;for(let u=0;u!==n;++u)t[f+u]=t[h+u]}++s}}if(r>0){e[s]=e[r];for(let o=r*n,a=s*n,l=0;l!==n;++l)t[a+l]=t[o+l];++s}if(s!==e.length)this.times=e.slice(0,s),this.values=t.slice(0,s*n);else this.times=e,this.values=t;return this}clone(){let e=this.times.slice(),t=this.values.slice(),i=new this.constructor(this.name,e,t);if(i.createInterpolant=this.createInterpolant,Gl(this.settings))i.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()};return i}}function hp(e,t){for(let n=0,i=e.length;n!==i;n+=2)e[n]*=t}Sn.prototype.ValueTypeName="";Sn.prototype.TimeBufferType=Float32Array;Sn.prototype.ValueBufferType=Float32Array;Sn.prototype.DefaultInterpolation=2301;class Yi extends Sn{constructor(e,t,n){super(e,t,n)}}Yi.prototype.ValueTypeName="bool";Yi.prototype.ValueBufferType=Array;Yi.prototype.DefaultInterpolation=2300;Yi.prototype.InterpolantFactoryMethodLinear=void 0;Yi.prototype.InterpolantFactoryMethodSmooth=void 0;class fh extends Sn{constructor(e,t,n,i){super(e,t,n,i)}}fh.prototype.ValueTypeName="color";class dh extends Sn{constructor(e,t,n,i){super(e,t,n,i)}}dh.prototype.ValueTypeName="number";class ph extends ji{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=(n-t)/(i-t),l=e*o;for(let c=l+o;l!==c;l+=4)Ft.slerpFlat(r,0,s,l-o,s,l,a);return r}}class ca extends Sn{constructor(e,t,n,i){super(e,t,n,i)}InterpolantFactoryMethodLinear(e){return new ph(this.times,this.values,this.getValueSize(),e)}}ca.prototype.ValueTypeName="quaternion";ca.prototype.InterpolantFactoryMethodSmooth=void 0;class $i extends Sn{constructor(e,t,n){super(e,t,n)}}$i.prototype.ValueTypeName="string";$i.prototype.ValueBufferType=Array;$i.prototype.DefaultInterpolation=2300;$i.prototype.InterpolantFactoryMethodLinear=void 0;$i.prototype.InterpolantFactoryMethodSmooth=void 0;class mh extends Sn{constructor(e,t,n,i){super(e,t,n,i)}}mh.prototype.ValueTypeName="vector";var Oo={enabled:!1,files:{},add:function(e,t){if(this.enabled===!1)return;if(up(e))return;this.files[e]=t},get:function(e){if(this.enabled===!1)return;if(up(e))return;return this.files[e]},remove:function(e){delete this.files[e]},clear:function(){this.files={}}};function up(e){try{let t=e.slice(e.indexOf(":")+1);return new URL(t).protocol==="blob:"}catch(t){return!1}}class gh{constructor(e,t,n){let i=this,r=!1,s=0,o=0,a=void 0,l=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(c){if(o++,r===!1){if(i.onStart!==void 0)i.onStart(c,s,o)}r=!0},this.itemEnd=function(c){if(s++,i.onProgress!==void 0)i.onProgress(c,s,o);if(s===o){if(r=!1,i.onLoad!==void 0)i.onLoad()}},this.itemError=function(c){if(i.onError!==void 0)i.onError(c)},this.resolveURL=function(c){if(c=c.normalize("NFC"),a)return a(c);return c},this.setURLModifier=function(c){return a=c,this},this.addHandler=function(c,h){return l.push(c,h),this},this.removeHandler=function(c){let h=l.indexOf(c);if(h!==-1)l.splice(h,2);return this},this.getHandler=function(c){for(let h=0,f=l.length;h<f;h+=2){let u=l[h],p=l[h+1];if(u.global)u.lastIndex=0;if(u.test(c))return p}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){if(!this._abortController)this._abortController=new AbortController;return this._abortController}}var bm=new gh;class Cs{constructor(e){if(this.manager=e!==void 0?e:bm,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,r){n.load(e,i,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}}Cs.DEFAULT_MATERIAL_NAME="__DEFAULT";var xr=new WeakMap;class _h extends Cs{constructor(e){super(e)}load(e,t,n,i){if(this.path!==void 0)e=this.path+e;e=this.manager.resolveURL(e);let r=this,s=Oo.get(`image:${e}`);if(s!==void 0){if(s.complete===!0)r.manager.itemStart(e),setTimeout(function(){if(t)t(s);r.manager.itemEnd(e)},0);else{let h=xr.get(s);if(h===void 0)h=[],xr.set(s,h);h.push({onLoad:t,onError:i})}return s}let o=wr("img");function a(){if(c(),t)t(this);let h=xr.get(this)||[];for(let f=0;f<h.length;f++){let u=h[f];if(u.onLoad)u.onLoad(this)}xr.delete(this),r.manager.itemEnd(e)}function l(h){if(c(),i)i(h);Oo.remove(`image:${e}`);let f=xr.get(this)||[];for(let u=0;u<f.length;u++){let p=f[u];if(p.onError)p.onError(h)}xr.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function c(){o.removeEventListener("load",a,!1),o.removeEventListener("error",l,!1)}if(o.addEventListener("load",a,!1),o.addEventListener("error",l,!1),e.slice(0,5)!=="data:"){if(this.crossOrigin!==void 0)o.crossOrigin=this.crossOrigin}return Oo.add(`image:${e}`,o),r.manager.itemStart(e),o.src=e,o}}class ha extends Cs{constructor(e){super(e)}load(e,t,n,i){let r=new Ot,s=new _h(this.manager);return s.setCrossOrigin(this.crossOrigin),s.setPath(this.path),s.load(e,function(o){if(r.image=o,r.needsUpdate=!0,t!==void 0)t(r)},n,i),r}}class ua extends Ct{constructor(e,t=1){super();this.isLight=!0,this.type="Light",this.color=new ke(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}}var Hl=new Ke,fp=new L,dp=new L;class vh{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new se(512,512),this.mapType=1009,this.map=null,this.mapPass=null,this.matrix=new Ke,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ss,this._frameExtents=new se(1,1),this._viewportCount=1,this._viewports=[new gt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;fp.setFromMatrixPosition(e.matrixWorld),t.position.copy(fp),dp.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(dp),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,i){Hl.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(Hl,e.coordinateSystem,e.reversedDepth);let r=this._frameExtents,s=i?i.z/r.x:1,o=i?i.w/r.y:1,a=i?i.x/r.x:0,l=i?i.y/r.y:0;if(e.coordinateSystem===2001||e.reversedDepth)t.set(0.5*s,0,0,0.5*s+a,0,0.5*o,0,0.5*o+l,0,0,1,0,0,0,0,1);else t.set(0.5*s,0,0,0.5*s+a,0,0.5*o,0,0.5*o+l,0,0,0.5,0.5,0,0,0,1);t.multiply(Hl)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){if(this.map)this.map.dispose();if(this.mapPass)this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}var Do=new L,No=new Ft,Un=new L;class fa extends Ct{constructor(){super();this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ke,this.projectionMatrix=new Ke,this.projectionMatrixInverse=new Ke,this.coordinateSystem=2000,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){if(super.updateMatrixWorld(e),this.matrixWorld.decompose(Do,No,Un),Un.x===1&&Un.y===1&&Un.z===1)this.matrixWorldInverse.copy(this.matrixWorld).invert();else this.matrixWorldInverse.compose(Do,No,Un.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){if(super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(Do,No,Un),Un.x===1&&Un.y===1&&Un.z===1)this.matrixWorldInverse.copy(this.matrixWorld).invert();else this.matrixWorldInverse.compose(Do,No,Un.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}var mi=new L,pp=new se,mp=new se;class $t extends fa{constructor(e=50,t=1,n=0.1,i=2000){super();this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=0.5*this.getFilmHeight()/e;this.fov=Tr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(as*0.5*this.fov);return 0.5*this.getFilmHeight()/e}getEffectiveFOV(){return Tr*2*Math.atan(Math.tan(as*0.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){mi.set(-1,-1,0.5).applyMatrix4(this.projectionMatrixInverse),t.set(mi.x,mi.y).multiplyScalar(-e/mi.z),mi.set(1,1,0.5).applyMatrix4(this.projectionMatrixInverse),n.set(mi.x,mi.y).multiplyScalar(-e/mi.z)}getViewSize(e,t){return this.getViewBounds(e,pp,mp),t.subVectors(mp,pp)}setViewOffset(e,t,n,i,r,s){if(this.aspect=e/t,this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(as*0.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,r=-0.5*i,s=this.view;if(this.view!==null&&this.view.enabled){let{fullWidth:a,fullHeight:l}=s;r+=s.offsetX*i/a,t-=s.offsetY*n/l,i*=s.width/a,n*=s.height/l}let o=this.filmOffset;if(o!==0)r+=e*o/this.getFilmWidth();this.projectionMatrix.makePerspective(r,r+i,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);if(t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null)t.object.view=Object.assign({},this.view);return t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class Zi extends fa{constructor(e=-1,t=1,n=1,i=-1,r=0.1,s=2000){super();this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=r,this.far=s,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,r,s){if(this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,r=n-e,s=n+e,o=i+t,a=i-t;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,c=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,s=r+l*this.view.width,o-=c*this.view.offsetY,a=o-c*this.view.height}this.projectionMatrix.makeOrthographic(r,s,o,a,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);if(t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null)t.object.view=Object.assign({},this.view);return t}}class Sm extends vh{constructor(){super(new Zi(-5,5,5,-5,0.5,500));this.isDirectionalLightShadow=!0}}class da extends ua{constructor(e,t){super(e,t);this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ct.DEFAULT_UP),this.updateMatrix(),this.target=new Ct,this.shadow=new Sm}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}}class pa extends ua{constructor(e,t){super(e,t);this.isAmbientLight=!0,this.type="AmbientLight"}}var br=-90,Sr=1;class yh extends Ct{constructor(e,t,n){super();this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let i=new $t(br,Sr,e,t);i.layers=this.layers,this.add(i);let r=new $t(br,Sr,e,t);r.layers=this.layers,this.add(r);let s=new $t(br,Sr,e,t);s.layers=this.layers,this.add(s);let o=new $t(br,Sr,e,t);o.layers=this.layers,this.add(o);let a=new $t(br,Sr,e,t);a.layers=this.layers,this.add(a);let l=new $t(br,Sr,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,i,r,s,o,a]=t;for(let l of t)this.remove(l);if(e===2000)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),s.up.set(0,0,1),s.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),a.up.set(0,1,0),a.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),s.up.set(0,0,-1),s.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),a.up.set(0,-1,0),a.lookAt(0,0,-1);else throw Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let l of t)this.add(l),l.updateMatrixWorld()}update(e,t){if(this.parent===null)this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:i}=this;if(this.coordinateSystem!==e.coordinateSystem)this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem();let[r,s,o,a,l,c]=this.children,h=e.getRenderTarget(),f=e.getActiveCubeFace(),u=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let g=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let y=!1;if(e.isWebGLRenderer===!0)y=e.state.buffers.depth.getReversed();else y=e.reversedDepthBuffer;if(e.setRenderTarget(n,0,i),y&&e.autoClear===!1)e.clearDepth();if(e.render(t,r),e.setRenderTarget(n,1,i),y&&e.autoClear===!1)e.clearDepth();if(e.render(t,s),e.setRenderTarget(n,2,i),y&&e.autoClear===!1)e.clearDepth();if(e.render(t,o),e.setRenderTarget(n,3,i),y&&e.autoClear===!1)e.clearDepth();if(e.render(t,a),e.setRenderTarget(n,4,i),y&&e.autoClear===!1)e.clearDepth();if(e.render(t,l),n.texture.generateMipmaps=g,e.setRenderTarget(n,5,i),y&&e.autoClear===!1)e.clearDepth();e.render(t,c),e.setRenderTarget(h,f,u),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}}class xh extends $t{constructor(e=[]){super();this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class kr{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){if(this._document=e,e.hidden!==void 0)this._pageVisibilityHandler=ty.bind(this),e.addEventListener("visibilitychange",this._pageVisibilityHandler,!1)}disconnect(){if(this._pageVisibilityHandler!==null)this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null;this._document=null}getDelta(){return this._delta/1000}getElapsed(){return this._elapsed/1000}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){if(this._pageVisibilityHandler!==null&&this._document.hidden===!0)this._delta=0;else this._previousTime=this._currentTime,this._currentTime=(e!==void 0?e:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta;return this}}function ty(){if(this._document.hidden===!1)this.reset()}var bh="\\[\\]\\.:\\/",ny=new RegExp("["+bh+"]","g"),Sh="[^"+bh+"]",iy="[^"+bh.replace("\\.","")+"]",ry=/((?:WC+[\/:])*)/.source.replace("WC",Sh),sy=/(WCOD+)?/.source.replace("WCOD",iy),oy=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Sh),ay=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Sh),ly=new RegExp("^"+ry+sy+oy+ay+"$"),cy=["material","materials","bones","map"];class Mm{constructor(e,t,n){let i=n||ot.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];if(i!==void 0)i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=n.length;i!==r;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}}class ot{constructor(e,t,n){this.path=t,this.parsedPath=n||ot.parseTrackName(t),this.node=ot.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){if(!(e&&e.isAnimationObjectGroup))return new ot(e,t,n);else return new ot.Composite(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(ny,"")}static parseTrackName(e){let t=ly.exec(e);if(t===null)throw Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let r=n.nodeName.substring(i+1);if(cy.indexOf(r)!==-1)n.nodeName=n.nodeName.substring(0,i),n.objectName=r}if(n.propertyName===null||n.propertyName.length===0)throw Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(r){for(let s=0;s<r.length;s++){let o=r[s];if(o.name===t||o.uuid===t)return o;let a=n(o.children);if(a)return a}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,{objectName:n,propertyName:i,propertyIndex:r}=t;if(!e)e=ot.findNode(this.rootNode,t.nodeName),this.node=e;if(this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Ie("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let l=t.objectIndex;switch(n){case"materials":if(!e.material){De("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){De("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){De("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let c=0;c<e.length;c++)if(e[c].name===l){l=c;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){De("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){De("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){De("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(l!==void 0){if(e[l]===void 0){De("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[l]}}let s=e[i];if(s===void 0){let l=t.nodeName;De("PropertyBinding: Trying to update property for track: "+l+"."+i+" but it wasn't found.",e);return}let o=this.Versioning.None;if(this.targetObject=e,e.isMaterial===!0)o=this.Versioning.NeedsUpdate;else if(e.isObject3D===!0)o=this.Versioning.MatrixWorldNeedsUpdate;let a=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){De("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){De("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}if(e.morphTargetDictionary[r]!==void 0)r=e.morphTargetDictionary[r]}a=this.BindingType.ArrayElement,this.resolvedProperty=s,this.propertyIndex=r}else if(s.fromArray!==void 0&&s.toArray!==void 0)a=this.BindingType.HasFromToArray,this.resolvedProperty=s;else if(Array.isArray(s))a=this.BindingType.EntireArray,this.resolvedProperty=s;else this.propertyName=i;this.getValue=this.GetterByBindingType[a],this.setValue=this.SetterByBindingTypeAndVersioning[a][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}ot.Composite=Mm;ot.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};ot.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};ot.prototype.GetterByBindingType=[ot.prototype._getValue_direct,ot.prototype._getValue_array,ot.prototype._getValue_arrayElement,ot.prototype._getValue_toArray];ot.prototype.SetterByBindingTypeAndVersioning=[[ot.prototype._setValue_direct,ot.prototype._setValue_direct_setNeedsUpdate,ot.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[ot.prototype._setValue_array,ot.prototype._setValue_array_setNeedsUpdate,ot.prototype._setValue_array_setMatrixWorldNeedsUpdate],[ot.prototype._setValue_arrayElement,ot.prototype._setValue_arrayElement_setNeedsUpdate,ot.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[ot.prototype._setValue_fromArray,ot.prototype._setValue_fromArray_setNeedsUpdate,ot.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var FC=new Float32Array(1);var gp=new Ke;class zr{constructor(e,t,n=0,i=1/0){this.ray=new Vi(e,t),this.near=n,this.far=i,this.camera=null,this.layers=new ys,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){if(t.isPerspectiveCamera)this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,0.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t;else if(t.isOrthographicCamera)this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t;else De("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return gp.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(gp),this}intersectObject(e,t=!0,n=[]){return Vl(e,this,n,t),n.sort(_p),n}intersectObjects(e,t=!0,n=[]){for(let i=0,r=e.length;i<r;i++)Vl(e[i],this,n,t);return n.sort(_p),n}}function _p(e,t){return e.distance-t.distance}function Vl(e,t,n,i){let r=!0;if(e.layers.test(t.layers)){if(e.raycast(t,n)===!1)r=!1}if(r===!0&&i===!0){let s=e.children;for(let o=0,a=s.length;o<a;o++)Vl(s[o],t,n,!0)}}class Rs{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=He(this.phi,0.000001,Math.PI-0.000001),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){if(this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0)this.theta=0,this.phi=0;else this.theta=Math.atan2(e,n),this.phi=Math.acos(He(t/this.radius,-1,1));return this}clone(){return new this.constructor().copy(this)}}class Mh{static{Mh.prototype.isMatrix2=!0}constructor(e,t,n,i){if(this.elements=[1,0,0,1],e!==void 0)this.set(e,t,n,i)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,i){let r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=i,this}}class zn extends kn{constructor(e,t=null){super();this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(this.domElement!==null)this.disconnect();this.domElement=e}disconnect(){}dispose(){}update(){}}function wh(e,t,n,i){let r=hy(i);switch(n){case 1021:return e*t;case 1028:return e*t/r.components*r.byteLength;case 1029:return e*t/r.components*r.byteLength;case 1030:return e*t*2/r.components*r.byteLength;case 1031:return e*t*2/r.components*r.byteLength;case 1022:return e*t*3/r.components*r.byteLength;case 1023:return e*t*4/r.components*r.byteLength;case 1033:return e*t*4/r.components*r.byteLength;case 33776:case 33777:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case 33778:case 33779:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 35841:case 35843:return Math.max(e,16)*Math.max(t,8)/4;case 35840:case 35842:return Math.max(e,8)*Math.max(t,8)/2;case 36196:case 37492:case 37488:case 37489:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case 37496:case 37490:case 37491:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 37808:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case 37809:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case 37810:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case 37811:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case 37812:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case 37813:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case 37814:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case 37815:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case 37816:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case 37817:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case 37818:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case 37819:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case 37820:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case 37821:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case 36492:case 36494:case 36495:return Math.ceil(e/4)*Math.ceil(t/4)*16;case 36283:case 36284:return Math.ceil(e/4)*Math.ceil(t/4)*8;case 36285:case 36286:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function hy(e){switch(e){case 1009:case 1010:return{byteLength:1,components:1};case 1012:case 1011:case 1016:return{byteLength:2,components:1};case 1017:case 1018:return{byteLength:2,components:4};case 1014:case 1013:case 1015:return{byteLength:4,components:1};case 35902:case 35899:return{byteLength:4,components:3}}throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}if(typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));if(typeof window<"u")if(window.__THREE__)Ie("WARNING: Multiple instances of Three.js being imported.");else window.__THREE__="186";function Xm(){let e=null,t=!1,n=null,i=null;function r(s,o){i=e.requestAnimationFrame(r),n(s,o)}return{start:function(){if(t===!0)return;if(n===null)return;if(e===null)return;i=e.requestAnimationFrame(r),t=!0},stop:function(){if(e!==null)e.cancelAnimationFrame(i);t=!1},setAnimationLoop:function(s){n=s},setContext:function(s){e=s}}}function uy(e){let t=new WeakMap;function n(a,l){let{array:c,usage:h}=a,f=c.byteLength,u=e.createBuffer();e.bindBuffer(l,u),e.bufferData(l,c,h),a.onUploadCallback();let p;if(c instanceof Float32Array)p=e.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)p=e.HALF_FLOAT;else if(c instanceof Uint16Array)if(a.isFloat16BufferAttribute)p=e.HALF_FLOAT;else p=e.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=e.SHORT;else if(c instanceof Uint32Array)p=e.UNSIGNED_INT;else if(c instanceof Int32Array)p=e.INT;else if(c instanceof Int8Array)p=e.BYTE;else if(c instanceof Uint8Array)p=e.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=e.UNSIGNED_BYTE;else throw Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function i(a,l,c){let{array:h,updateRanges:f}=l;if(e.bindBuffer(c,a),f.length===0)e.bufferSubData(c,0,h);else{f.sort((p,g)=>p.start-g.start);let u=0;for(let p=1;p<f.length;p++){let g=f[u],y=f[p];if(y.start<=g.start+g.count+1)g.count=Math.max(g.count,y.start+y.count-g.start);else++u,f[u]=y}f.length=u+1;for(let p=0,g=f.length;p<g;p++){let y=f[p];e.bufferSubData(c,y.start*h.BYTES_PER_ELEMENT,h,y.start,y.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(a){if(a.isInterleavedBufferAttribute)a=a.data;return t.get(a)}function s(a){if(a.isInterleavedBufferAttribute)a=a.data;let l=t.get(a);if(l)e.deleteBuffer(l.buffer),t.delete(a)}function o(a,l){if(a.isInterleavedBufferAttribute)a=a.data;if(a.isGLBufferAttribute){let h=t.get(a);if(!h||h.version<a.version)t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=t.get(a);if(c===void 0)t.set(a,n(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:r,remove:s,update:o}}var fy=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,dy=`#ifdef USE_ALPHAHASH
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
#endif`,py=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,my=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,gy=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,_y=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,vy=`#ifdef USE_AOMAP
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
#endif`,yy=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,xy=`#ifdef USE_BATCHING
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
#endif`,by=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Sy=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,My=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,wy=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Ey=`#ifdef USE_IRIDESCENCE
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
#endif`,Ty=`#ifdef USE_BUMPMAP
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
#endif`,Ay=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Cy=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Ry=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Py=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Iy=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Ly=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Dy=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Ny=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,Oy=`#define PI 3.141592653589793
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
} // validated`,Uy=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Fy=`vec3 transformedNormal = objectNormal;
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
#endif`,By=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,ky=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,zy=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Gy=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Hy="gl_FragColor = linearToOutputTexel( gl_FragColor );",Vy=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Wy=`#ifdef USE_ENVMAP
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
#endif`,Xy=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,qy=`#ifdef USE_ENVMAP
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
#endif`,jy=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Yy=`#ifdef USE_ENVMAP
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
#endif`,$y=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Zy=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Jy=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Ky=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Qy=`#ifdef USE_GRADIENTMAP
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
}`,ex=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,tx=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,nx=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,ix=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,rx=`#ifdef USE_ENVMAP
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
#endif`,sx=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,ox=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,ax=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lx=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,cx=`PhysicalMaterial material;
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
#endif`,hx=`uniform sampler2D dfgLUT;
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
}`,ux=`
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
#endif`,fx=`#if defined( RE_IndirectDiffuse )
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
#endif`,dx=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,px=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,mx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,gx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,_x=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,vx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,yx=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,xx=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,bx=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Sx=`#if defined( USE_POINTS_UV )
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
#endif`,Mx=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,wx=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Ex=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Tx=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Ax=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Cx=`#ifdef USE_MORPHTARGETS
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
#endif`,Rx=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Px=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Ix=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Lx=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Dx=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Nx=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Ox=`#ifdef USE_NORMALMAP
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
#endif`,Ux=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Fx=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Bx=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,kx=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,zx=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Gx=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Hx=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Vx=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Wx=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Xx=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,qx=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,jx=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Yx=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,$x=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Zx=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,Jx=`float getShadowMask() {
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
}`,Kx=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Qx=`#ifdef USE_SKINNING
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
#endif`,eb=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,tb=`#ifdef USE_SKINNING
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
#endif`,nb=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,ib=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,rb=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,sb=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,ob=`#ifdef USE_TRANSMISSION
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
#endif`,ab=`#ifdef USE_TRANSMISSION
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
#endif`,lb=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,cb=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,hb=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`;var ub=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,fb=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,db=`uniform sampler2D t2D;
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
}`,pb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,mb=`#ifdef ENVMAP_TYPE_CUBE
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
}`,gb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,_b=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,vb=`#include <common>
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
}`,yb=`#if DEPTH_PACKING == 3200
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
}`,xb=`#define DISTANCE
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
}`,bb=`#define DISTANCE
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
}`,Sb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Mb=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,wb=`uniform float scale;
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
}`,Eb=`uniform vec3 diffuse;
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
}`,Tb=`#include <common>
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
}`,Ab=`uniform vec3 diffuse;
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
}`,Cb=`#define LAMBERT
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
}`,Rb=`#define LAMBERT
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
}`,Pb=`#define MATCAP
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
}`,Ib=`#define MATCAP
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
}`,Lb=`#define NORMAL
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
}`,Db=`#define NORMAL
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
}`,Nb=`#define PHONG
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
}`,Ob=`#define PHONG
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
}`,Ub=`#define STANDARD
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
}`,Fb=`#define STANDARD
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
}`,Bb=`#define TOON
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
}`,kb=`#define TOON
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
}`,zb=`uniform float size;
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
}`,Gb=`uniform vec3 diffuse;
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
}`,Hb=`#include <common>
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
}`,Vb=`uniform vec3 color;
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
}`,Wb=`uniform float rotation;
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
}`,Xb=`uniform vec3 diffuse;
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
}`,Ve={alphahash_fragment:fy,alphahash_pars_fragment:dy,alphamap_fragment:py,alphamap_pars_fragment:my,alphatest_fragment:gy,alphatest_pars_fragment:_y,aomap_fragment:vy,aomap_pars_fragment:yy,batching_pars_vertex:xy,batching_vertex:by,begin_vertex:Sy,beginnormal_vertex:My,bsdfs:wy,iridescence_fragment:Ey,bumpmap_pars_fragment:Ty,clipping_planes_fragment:Ay,clipping_planes_pars_fragment:Cy,clipping_planes_pars_vertex:Ry,clipping_planes_vertex:Py,color_fragment:Iy,color_pars_fragment:Ly,color_pars_vertex:Dy,color_vertex:Ny,common:Oy,cube_uv_reflection_fragment:Uy,defaultnormal_vertex:Fy,displacementmap_pars_vertex:By,displacementmap_vertex:ky,emissivemap_fragment:zy,emissivemap_pars_fragment:Gy,colorspace_fragment:Hy,colorspace_pars_fragment:Vy,envmap_fragment:Wy,envmap_common_pars_fragment:Xy,envmap_pars_fragment:qy,envmap_pars_vertex:jy,envmap_physical_pars_fragment:rx,envmap_vertex:Yy,fog_vertex:$y,fog_pars_vertex:Zy,fog_fragment:Jy,fog_pars_fragment:Ky,gradientmap_pars_fragment:Qy,lightmap_pars_fragment:ex,lights_lambert_fragment:tx,lights_lambert_pars_fragment:nx,lights_pars_begin:ix,lights_toon_fragment:sx,lights_toon_pars_fragment:ox,lights_phong_fragment:ax,lights_phong_pars_fragment:lx,lights_physical_fragment:cx,lights_physical_pars_fragment:hx,lights_fragment_begin:ux,lights_fragment_maps:fx,lights_fragment_end:dx,lightprobes_pars_fragment:px,logdepthbuf_fragment:mx,logdepthbuf_pars_fragment:gx,logdepthbuf_pars_vertex:_x,logdepthbuf_vertex:vx,map_fragment:yx,map_pars_fragment:xx,map_particle_fragment:bx,map_particle_pars_fragment:Sx,metalnessmap_fragment:Mx,metalnessmap_pars_fragment:wx,morphinstance_vertex:Ex,morphcolor_vertex:Tx,morphnormal_vertex:Ax,morphtarget_pars_vertex:Cx,morphtarget_vertex:Rx,normal_fragment_begin:Px,normal_fragment_maps:Ix,normal_pars_fragment:Lx,normal_pars_vertex:Dx,normal_vertex:Nx,normalmap_pars_fragment:Ox,clearcoat_normal_fragment_begin:Ux,clearcoat_normal_fragment_maps:Fx,clearcoat_pars_fragment:Bx,iridescence_pars_fragment:kx,opaque_fragment:zx,packing:Gx,premultiplied_alpha_fragment:Hx,project_vertex:Vx,dithering_fragment:Wx,dithering_pars_fragment:Xx,roughnessmap_fragment:qx,roughnessmap_pars_fragment:jx,shadowmap_pars_fragment:Yx,shadowmap_pars_vertex:$x,shadowmap_vertex:Zx,shadowmask_pars_fragment:Jx,skinbase_vertex:Kx,skinning_pars_vertex:Qx,skinning_vertex:eb,skinnormal_vertex:tb,specularmap_fragment:nb,specularmap_pars_fragment:ib,tonemapping_fragment:rb,tonemapping_pars_fragment:sb,transmission_fragment:ob,transmission_pars_fragment:ab,uv_pars_fragment:lb,uv_pars_vertex:cb,uv_vertex:hb,worldpos_vertex:ub,background_vert:fb,background_frag:db,backgroundCube_vert:pb,backgroundCube_frag:mb,cube_vert:gb,cube_frag:_b,depth_vert:vb,depth_frag:yb,distance_vert:xb,distance_frag:bb,equirect_vert:Sb,equirect_frag:Mb,linedashed_vert:wb,linedashed_frag:Eb,meshbasic_vert:Tb,meshbasic_frag:Ab,meshlambert_vert:Cb,meshlambert_frag:Rb,meshmatcap_vert:Pb,meshmatcap_frag:Ib,meshnormal_vert:Lb,meshnormal_frag:Db,meshphong_vert:Nb,meshphong_frag:Ob,meshphysical_vert:Ub,meshphysical_frag:Fb,meshtoon_vert:Bb,meshtoon_frag:kb,points_vert:zb,points_frag:Gb,shadow_vert:Hb,shadow_frag:Vb,sprite_vert:Wb,sprite_frag:Xb},pe={common:{diffuse:{value:new ke(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Fe},alphaMap:{value:null},alphaMapTransform:{value:new Fe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Fe}},envmap:{envMap:{value:null},envMapRotation:{value:new Fe},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:0.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Fe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Fe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Fe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Fe},normalScale:{value:new se(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Fe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Fe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Fe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Fe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:0.00025},fogNear:{value:1},fogFar:{value:2000},fogColor:{value:new ke(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new L},probesMax:{value:new L},probesResolution:{value:new L}},points:{diffuse:{value:new ke(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Fe},alphaTest:{value:0},uvTransform:{value:new Fe}},sprite:{diffuse:{value:new ke(16777215)},opacity:{value:1},center:{value:new se(0.5,0.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Fe},alphaMap:{value:null},alphaMapTransform:{value:new Fe},alphaTest:{value:0}}},Hn={basic:{uniforms:Wt([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.fog]),vertexShader:Ve.meshbasic_vert,fragmentShader:Ve.meshbasic_frag},lambert:{uniforms:Wt([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,pe.lights,{emissive:{value:new ke(0)},envMapIntensity:{value:1}}]),vertexShader:Ve.meshlambert_vert,fragmentShader:Ve.meshlambert_frag},phong:{uniforms:Wt([pe.common,pe.specularmap,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,pe.lights,{emissive:{value:new ke(0)},specular:{value:new ke(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Ve.meshphong_vert,fragmentShader:Ve.meshphong_frag},standard:{uniforms:Wt([pe.common,pe.envmap,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.roughnessmap,pe.metalnessmap,pe.fog,pe.lights,{emissive:{value:new ke(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ve.meshphysical_vert,fragmentShader:Ve.meshphysical_frag},toon:{uniforms:Wt([pe.common,pe.aomap,pe.lightmap,pe.emissivemap,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.gradientmap,pe.fog,pe.lights,{emissive:{value:new ke(0)}}]),vertexShader:Ve.meshtoon_vert,fragmentShader:Ve.meshtoon_frag},matcap:{uniforms:Wt([pe.common,pe.bumpmap,pe.normalmap,pe.displacementmap,pe.fog,{matcap:{value:null}}]),vertexShader:Ve.meshmatcap_vert,fragmentShader:Ve.meshmatcap_frag},points:{uniforms:Wt([pe.points,pe.fog]),vertexShader:Ve.points_vert,fragmentShader:Ve.points_frag},dashed:{uniforms:Wt([pe.common,pe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ve.linedashed_vert,fragmentShader:Ve.linedashed_frag},depth:{uniforms:Wt([pe.common,pe.displacementmap]),vertexShader:Ve.depth_vert,fragmentShader:Ve.depth_frag},normal:{uniforms:Wt([pe.common,pe.bumpmap,pe.normalmap,pe.displacementmap,{opacity:{value:1}}]),vertexShader:Ve.meshnormal_vert,fragmentShader:Ve.meshnormal_frag},sprite:{uniforms:Wt([pe.sprite,pe.fog]),vertexShader:Ve.sprite_vert,fragmentShader:Ve.sprite_frag},background:{uniforms:{uvTransform:{value:new Fe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ve.background_vert,fragmentShader:Ve.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Fe}},vertexShader:Ve.backgroundCube_vert,fragmentShader:Ve.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ve.cube_vert,fragmentShader:Ve.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ve.equirect_vert,fragmentShader:Ve.equirect_frag},distance:{uniforms:Wt([pe.common,pe.displacementmap,{referencePosition:{value:new L},nearDistance:{value:1},farDistance:{value:1000}}]),vertexShader:Ve.distance_vert,fragmentShader:Ve.distance_frag},shadow:{uniforms:Wt([pe.lights,pe.fog,{color:{value:new ke(0)},opacity:{value:1}}]),vertexShader:Ve.shadow_vert,fragmentShader:Ve.shadow_frag}};Hn.physical={uniforms:Wt([Hn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Fe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Fe},clearcoatNormalScale:{value:new se(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Fe},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Fe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Fe},sheen:{value:0},sheenColor:{value:new ke(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Fe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Fe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Fe},transmissionSamplerSize:{value:new se},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Fe},attenuationDistance:{value:0},attenuationColor:{value:new ke(0)},specularColor:{value:new ke(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Fe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Fe},anisotropyVector:{value:new se},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Fe}}]),vertexShader:Ve.meshphysical_vert,fragmentShader:Ve.meshphysical_frag};var ma={r:0,b:0,g:0},qb=new Ke,qm=new Fe;qm.set(-1,0,0,0,1,0,0,0,1);function jb(e,t,n,i,r,s){let o=new ke(0),a=r===!0?0:1,l,c,h=null,f=0,u=null;function p(b){let S=b.isScene===!0?b.background:null;if(S&&S.isTexture){let _=b.backgroundBlurriness>0;S=t.get(S,_)}return S}function g(b){let S=!1,_=p(b);if(_===null)m(o,a);else if(_&&_.isColor)m(_,1),S=!0;let x=e.xr.getEnvironmentBlendMode();if(x==="additive")n.buffers.color.setClear(0,0,0,1,s);else if(x==="alpha-blend")n.buffers.color.setClear(0,0,0,0,s);if(e.autoClear||S)n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil)}function y(b,S){let _=p(S);if(_&&(_.isCubeTexture||_.mapping===ms)){if(c===void 0)c=new Bt(new Ur(1,1,1),new Jt({name:"BackgroundCubeMaterial",uniforms:qi(Hn.backgroundCube.uniforms),vertexShader:Hn.backgroundCube.vertexShader,fragmentShader:Hn.backgroundCube.fragmentShader,side:Vt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(x,w,T){this.matrixWorld.copyPosition(T.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c);if(c.material.uniforms.envMap.value=_,c.material.uniforms.backgroundBlurriness.value=S.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(qb.makeRotationFromEuler(S.backgroundRotation)).transpose(),_.isCubeTexture&&_.isRenderTargetTexture===!1)c.material.uniforms.backgroundRotation.value.premultiply(qm);if(c.material.toneMapped=qe.getTransfer(_.colorSpace)!==ht,h!==_||f!==_.version||u!==e.toneMapping)c.material.needsUpdate=!0,h=_,f=_.version,u=e.toneMapping;c.layers.enableAll(),b.unshift(c,c.geometry,c.material,0,0,null)}else if(_&&_.isTexture){if(l===void 0)l=new Bt(new Ts(2,2),new Jt({name:"BackgroundMaterial",uniforms:qi(Hn.background.uniforms),vertexShader:Hn.background.vertexShader,fragmentShader:Hn.background.fragmentShader,side:Cr,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l);if(l.material.uniforms.t2D.value=_,l.material.uniforms.backgroundIntensity.value=S.backgroundIntensity,l.material.toneMapped=qe.getTransfer(_.colorSpace)!==ht,_.matrixAutoUpdate===!0)_.updateMatrix();if(l.material.uniforms.uvTransform.value.copy(_.matrix),h!==_||f!==_.version||u!==e.toneMapping)l.material.needsUpdate=!0,h=_,f=_.version,u=e.toneMapping;l.layers.enableAll(),b.unshift(l,l.geometry,l.material,0,0,null)}}function m(b,S){b.getRGB(ma,rh(e)),n.buffers.color.setClear(ma.r,ma.g,ma.b,S,s)}function d(){if(c!==void 0)c.geometry.dispose(),c.material.dispose(),c=void 0;if(l!==void 0)l.geometry.dispose(),l.material.dispose(),l=void 0}return{getClearColor:function(){return o},setClearColor:function(b,S=1){o.set(b),a=S,m(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(b){a=b,m(o,a)},render:g,addToRenderList:y,dispose:d}}function Yb(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},r=u(null),s=r,o=!1;function a(P,D,W,R,I){let k=!1,z=f(P,R,W,D);if(s!==z)s=z,c(s.object);if(k=p(P,R,W,I),k)g(P,R,W,I);if(I!==null)t.update(I,e.ELEMENT_ARRAY_BUFFER);if(k||o){if(o=!1,_(P,D,W,R),I!==null)e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(I).buffer)}}function l(){return e.createVertexArray()}function c(P){return e.bindVertexArray(P)}function h(P){return e.deleteVertexArray(P)}function f(P,D,W,R){let I=R.wireframe===!0,k=i[D.id];if(k===void 0)k={},i[D.id]=k;let z=P.isInstancedMesh===!0?P.id:0,te=k[z];if(te===void 0)te={},k[z]=te;let Y=te[W.id];if(Y===void 0)Y={},te[W.id]=Y;let Q=Y[I];if(Q===void 0)Q=u(l()),Y[I]=Q;return Q}function u(P){let D=[],W=[],R=[];for(let I=0;I<n;I++)D[I]=0,W[I]=0,R[I]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:D,enabledAttributes:W,attributeDivisors:R,object:P,attributes:{},index:null}}function p(P,D,W,R){let I=s.attributes,k=D.attributes,z=0,te=W.getAttributes();for(let Y in te)if(te[Y].location>=0){let G=I[Y],ee=k[Y];if(ee===void 0){if(Y==="instanceMatrix"&&P.instanceMatrix)ee=P.instanceMatrix;if(Y==="instanceColor"&&P.instanceColor)ee=P.instanceColor}if(G===void 0)return!0;if(G.attribute!==ee)return!0;if(ee&&G.data!==ee.data)return!0;z++}if(s.attributesNum!==z)return!0;if(s.index!==R)return!0;return!1}function g(P,D,W,R){let I={},k=D.attributes,z=0,te=W.getAttributes();for(let Y in te)if(te[Y].location>=0){let G=k[Y];if(G===void 0){if(Y==="instanceMatrix"&&P.instanceMatrix)G=P.instanceMatrix;if(Y==="instanceColor"&&P.instanceColor)G=P.instanceColor}let ee={};if(ee.attribute=G,G&&G.data)ee.data=G.data;I[Y]=ee,z++}s.attributes=I,s.attributesNum=z,s.index=R}function y(){let P=s.newAttributes;for(let D=0,W=P.length;D<W;D++)P[D]=0}function m(P){d(P,0)}function d(P,D){let W=s.newAttributes,R=s.enabledAttributes,I=s.attributeDivisors;if(W[P]=1,R[P]===0)e.enableVertexAttribArray(P),R[P]=1;if(I[P]!==D)e.vertexAttribDivisor(P,D),I[P]=D}function b(){let P=s.newAttributes,D=s.enabledAttributes;for(let W=0,R=D.length;W<R;W++)if(D[W]!==P[W])e.disableVertexAttribArray(W),D[W]=0}function S(P,D,W,R,I,k,z){if(z===!0)e.vertexAttribIPointer(P,D,W,I,k);else e.vertexAttribPointer(P,D,W,R,I,k)}function _(P,D,W,R){y();let I=R.attributes,k=W.getAttributes(),z=D.defaultAttributeValues;for(let te in k){let Y=k[te];if(Y.location>=0){let Q=I[te];if(Q===void 0){if(te==="instanceMatrix"&&P.instanceMatrix)Q=P.instanceMatrix;if(te==="instanceColor"&&P.instanceColor)Q=P.instanceColor}if(Q!==void 0){let G=Q.normalized,ee=Q.itemSize,oe=t.get(Q);if(oe===void 0)continue;let{buffer:Ue,type:Re,bytesPerElement:X}=oe,re=Re===e.INT||Re===e.UNSIGNED_INT||Q.gpuType===nc;if(Q.isInterleavedBufferAttribute){let le=Q.data,Pe=le.stride,Oe=Q.offset;if(le.isInstancedInterleavedBuffer){for(let Ae=0;Ae<Y.locationSize;Ae++)d(Y.location+Ae,le.meshPerAttribute);if(P.isInstancedMesh!==!0&&R._maxInstanceCount===void 0)R._maxInstanceCount=le.meshPerAttribute*le.count}else for(let Ae=0;Ae<Y.locationSize;Ae++)m(Y.location+Ae);e.bindBuffer(e.ARRAY_BUFFER,Ue);for(let Ae=0;Ae<Y.locationSize;Ae++)S(Y.location+Ae,ee/Y.locationSize,Re,G,Pe*X,(Oe+ee/Y.locationSize*Ae)*X,re)}else{if(Q.isInstancedBufferAttribute){for(let le=0;le<Y.locationSize;le++)d(Y.location+le,Q.meshPerAttribute);if(P.isInstancedMesh!==!0&&R._maxInstanceCount===void 0)R._maxInstanceCount=Q.meshPerAttribute*Q.count}else for(let le=0;le<Y.locationSize;le++)m(Y.location+le);e.bindBuffer(e.ARRAY_BUFFER,Ue);for(let le=0;le<Y.locationSize;le++)S(Y.location+le,ee/Y.locationSize,Re,G,ee*X,ee/Y.locationSize*le*X,re)}}else if(z!==void 0){let G=z[te];if(G!==void 0)switch(G.length){case 2:e.vertexAttrib2fv(Y.location,G);break;case 3:e.vertexAttrib3fv(Y.location,G);break;case 4:e.vertexAttrib4fv(Y.location,G);break;default:e.vertexAttrib1fv(Y.location,G)}}}}b()}function x(){A();for(let P in i){let D=i[P];for(let W in D){let R=D[W];for(let I in R){let k=R[I];for(let z in k)h(k[z].object),delete k[z];delete R[I]}}delete i[P]}}function w(P){if(i[P.id]===void 0)return;let D=i[P.id];for(let W in D){let R=D[W];for(let I in R){let k=R[I];for(let z in k)h(k[z].object),delete k[z];delete R[I]}}delete i[P.id]}function T(P){for(let D in i){let W=i[D];for(let R in W){let I=W[R];if(I[P.id]===void 0)continue;let k=I[P.id];for(let z in k)h(k[z].object),delete k[z];delete I[P.id]}}}function v(P){for(let D in i){let W=i[D],R=P.isInstancedMesh===!0?P.id:0,I=W[R];if(I===void 0)continue;for(let k in I){let z=I[k];for(let te in z)h(z[te].object),delete z[te];delete I[k]}if(delete W[R],Object.keys(W).length===0)delete i[D]}}function A(){if(N(),o=!0,s===r)return;s=r,c(s.object)}function N(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:A,resetDefaultState:N,dispose:x,releaseStatesOfGeometry:w,releaseStatesOfObject:v,releaseStatesOfProgram:T,initAttributes:y,enableAttribute:m,disableUnusedAttributes:b}}function $b(e,t,n){let i;function r(l){i=l}function s(l,c){e.drawArrays(i,l,c),n.update(c,i,1)}function o(l,c,h){if(h===0)return;e.drawArraysInstanced(i,l,c,h),n.update(c,i,h)}function a(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,h);let u=0;for(let p=0;p<h;p++)u+=c[p];n.update(u,i,1)}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a}function Zb(e,t,n,i){let r;function s(){if(r!==void 0)return r;if(t.has("EXT_texture_filter_anisotropic")===!0){let T=t.get("EXT_texture_filter_anisotropic");r=e.getParameter(T.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(T){if(T!==Bn&&i.convert(T)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))return!1;return!0}function a(T){let v=T===bn&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));if(T!==Rn&&T!==ni&&!v&&i.convert(T)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))return!1;return!0}function l(T){if(T==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";T="mediump"}if(T==="mediump"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0)return"mediump"}return"lowp"}let c=n.precision!==void 0?n.precision:"highp",h=l(c);if(h!==c)Ie("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h;let f=n.logarithmicDepthBuffer===!0,u=n.reversedDepthBuffer===!0&&t.has("EXT_clip_control");if(n.reversedDepthBuffer===!0&&u===!1)Ie("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),g=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),y=e.getParameter(e.MAX_TEXTURE_SIZE),m=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),d=e.getParameter(e.MAX_VERTEX_ATTRIBS),b=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),S=e.getParameter(e.MAX_VARYING_VECTORS),_=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),w=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:u,maxTextures:p,maxVertexTextures:g,maxTextureSize:y,maxCubemapSize:m,maxAttributes:d,maxVertexUniforms:b,maxVaryings:S,maxFragmentUniforms:_,maxSamples:x,samples:w}}function Jb(e){let t=this,n=null,i=0,r=!1,s=!1,o=new rn,a=new Fe,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,u){let p=f.length!==0||u||i!==0||r;return r=u,i=f.length,p},this.beginShadows=function(){s=!0,h(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(f,u){n=h(f,u,0)},this.setState=function(f,u,p){let{clippingPlanes:g,clipIntersection:y,clipShadows:m}=f,d=e.get(f);if(!r||g===null||g.length===0||s&&!m)if(s)h(null);else c();else{let b=s?0:i,S=b*4,_=d.clippingState||null;l.value=_,_=h(g,u,S,p);for(let x=0;x!==S;++x)_[x]=n[x];d.clippingState=_,this.numIntersection=y?this.numPlanes:0,this.numPlanes+=b}};function c(){if(l.value!==n)l.value=n,l.needsUpdate=i>0;t.numPlanes=i,t.numIntersection=0}function h(f,u,p,g){let y=f!==null?f.length:0,m=null;if(y!==0){if(m=l.value,g!==!0||m===null){let d=p+y*4,b=u.matrixWorldInverse;if(a.getNormalMatrix(b),m===null||m.length<d)m=new Float32Array(d);for(let S=0,_=p;S!==y;++S,_+=4)o.copy(f[S]).applyMatrix4(b,a),o.normal.toArray(m,_),m[_+3]=o.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=y,t.numIntersection=0,m}}var Hr=4,Kb=6,Qb=20,eS=256,Ps=new Zi,wm=new ke,Eh=null,Th=0,Ah=0,Ch=!1,tS=new L,Ji=new L;class Ih{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=0.1,i=100,r={}){let{size:s=256,position:o=tS}=r;Eh=this._renderer.getRenderTarget(),Th=this._renderer.getActiveCubeFace(),Ah=this._renderer.getActiveMipmapLevel(),Ch=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(s);let a=this._allocateTargets();if(a.depthBuffer=!0,this._sceneToCubeUV(e,n,i,a,o),t>0)this._blur(a,0,0,t);return this._applyPMREM(a),this._cleanup(a),a}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){if(this._cubemapMaterial===null)this._cubemapMaterial=Am(),this._compileMaterial(this._cubemapMaterial)}compileEquirectangularShader(){if(this._equirectMaterial===null)this._equirectMaterial=Tm(),this._compileMaterial(this._equirectMaterial)}dispose(){if(this._dispose(),this._cubemapMaterial!==null)this._cubemapMaterial.dispose();if(this._equirectMaterial!==null)this._equirectMaterial.dispose();if(this._backgroundBox!==null)this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){if(this._blurMaterial!==null)this._blurMaterial.dispose();if(this._ggxMaterial!==null)this._ggxMaterial.dispose();if(this._pingPongRenderTarget!==null)this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Eh,Th,Ah),this._renderer.xr.enabled=Ch,e.scissorTest=!1,Gr(e,0,0,e.width,e.height)}_fromTexture(e,t){if(e.mapping===Pr||e.mapping===Fi)this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width);else this._setSize(e.image.width/4);Eh=this._renderer.getRenderTarget(),Th=this._renderer.getActiveCubeFace(),Ah=this._renderer.getActiveMipmapLevel(),Ch=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:on,minFilter:on,generateMipmaps:!1,type:bn,format:Bn,colorSpace:kc,depthBuffer:!1},i=Em(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){if(this._pingPongRenderTarget!==null)this._dispose();this._pingPongRenderTarget=Em(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=nS(r)),this._blurMaterial=rS(r,e,t),this._ggxMaterial=iS(r,e,t)}return i}_compileMaterial(e){let t=new Bt(new Rt,e);this._renderer.compile(t,Ps)}_sceneToCubeUV(e,t,n,i,r){let a=new $t(90,1,t,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,{autoClear:f,toneMapping:u}=h;if(h.getClearColor(wm),h.toneMapping=Cn,h.autoClear=!1,h.state.buffers.depth.getReversed())h.setRenderTarget(i),h.clearDepth(),h.setRenderTarget(null);if(this._backgroundBox===null)this._backgroundBox=new Bt(new Ur,new Or({name:"PMREM.Background",side:Vt,depthWrite:!1,depthTest:!1}));let g=this._backgroundBox,y=g.material,m=!1,d=e.background;if(d){if(d.isColor)y.color.copy(d),e.background=null,m=!0}else y.color.copy(wm),m=!0;for(let b=0;b<6;b++){let S=b%3;if(S===0)a.up.set(0,l[b],0),a.position.set(r.x,r.y,r.z),a.lookAt(r.x+c[b],r.y,r.z);else if(S===1)a.up.set(0,0,l[b]),a.position.set(r.x,r.y,r.z),a.lookAt(r.x,r.y+c[b],r.z);else a.up.set(0,l[b],0),a.position.set(r.x,r.y,r.z),a.lookAt(r.x,r.y,r.z+c[b]);let _=this._cubeSize;if(Gr(i,S*_,b>2?_:0,_,_),h.setRenderTarget(i),m)h.render(g,a);h.render(e,a)}h.toneMapping=u,h.autoClear=f,e.background=d}_textureToCubeUV(e,t){let n=this._renderer,i=e.mapping===Pr||e.mapping===Fi;if(i){if(this._cubemapMaterial===null)this._cubemapMaterial=Am();this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1}else if(this._equirectMaterial===null)this._equirectMaterial=Tm();let r=i?this._cubemapMaterial:this._equirectMaterial,s=this._lodMeshes[0];s.material=r;let o=r.uniforms;o.envMap.value=e;let a=this._cubeSize;Gr(t,0,0,3*a,2*a),n.setRenderTarget(t),n.render(s,Ps)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let i=this._lodMeshes.length;for(let r=1;r<i;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){let i=this._renderer,r=this._pingPongRenderTarget,s=this._ggxMaterial,o=this._lodMeshes[n];o.material=s;let a=s.uniforms,l=n/(this._lodMeshes.length-1),c=t/(this._lodMeshes.length-1),h=Math.sqrt(l*l-c*c),f=l*1.25,u=h*f,{_lodMax:p}=this,g=this._sizeLods[n],y=3*g*(n>p-Hr?n-p+Hr:0),m=4*(this._cubeSize-g);a.envMap.value=e.texture,a.roughness.value=u,a.mipInt.value=p-t,Gr(r,y,m,3*g,2*g),i.setRenderTarget(r),i.render(o,Ps),a.envMap.value=r.texture,a.roughness.value=0,a.mipInt.value=p-n,Gr(e,y,m,3*g,2*g),i.setRenderTarget(e),i.render(o,Ps)}_blur(e,t,n,i){let r=this._pingPongRenderTarget,s=Math.min(i,Math.PI)/Math.SQRT2;this._blurPass(e,r,t,n,s),this._blurPass(r,e,n,n,s)}_blurPass(e,t,n,i,r){let s=this._renderer,o=this._blurMaterial,a=this._lodMeshes[i];a.material=o;let l=o.uniforms;l.envMap.value=e.texture,l.sigma.value=r,l.mipInt.value=this._lodMax-n;let c=this._sizeLods[i],h=3*c*(i>this._lodMax-Hr?i-this._lodMax+Hr:0),f=4*(this._cubeSize-c);Gr(t,h,f,3*c,2*c),s.setRenderTarget(t),s.render(a,Ps)}}function nS(e){let t=[],n=[],i=e,r=e-Hr+1+Kb;for(let s=0;s<r;s++){let o=Math.pow(2,i);t.push(o);let a=1/(o-2),l=-a,c=1+a,h=[l,l,c,l,c,c,l,l,c,c,l,c],f=6,u=6,p=3,g=new Float32Array(p*u*f),y=new Float32Array(p*u*f);for(let d=0;d<f;d++){let b=d%3*2/3-1,S=d>2?0:-1,_=[b,S,0,b+0.6666666666666666,S,0,b+0.6666666666666666,S+1,0,b,S,0,b+0.6666666666666666,S+1,0,b,S+1,0];g.set(_,p*u*d);for(let x=0;x<u;x++){let w=h[x*2]*2-1,T=h[x*2+1]*2-1;if(d===0)Ji.set(1,T,w);else if(d===1)Ji.set(-w,1,-T);else if(d===2)Ji.set(-w,T,1);else if(d===3)Ji.set(-1,T,-w);else if(d===4)Ji.set(-w,-1,T);else Ji.set(w,T,-1);Ji.toArray(y,(d*u+x)*p)}}let m=new Rt;if(m.setAttribute("position",new sn(g,p)),m.setAttribute("outputDirection",new sn(y,p)),n.push(new Bt(m,null)),i>Hr)i--}return{lodMeshes:n,sizeLods:t}}function Em(e,t,n){let i=new Zt(e,t,n);return i.texture.mapping=ms,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Gr(e,t,n,i,r){e.viewport.set(t,n,i,r),e.scissor.set(t,n,i,r)}function iS(e,t,n){return new Jt({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:eS,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:_a(),fragmentShader:`

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
		`,blending:xn,depthTest:!1,depthWrite:!1})}function rS(e,t,n){return new Jt({name:"SphericalGaussianBlur",defines:{SAMPLES:Qb,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:_a(),fragmentShader:`

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
		`,blending:xn,depthTest:!1,depthWrite:!1})}function Tm(){return new Jt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:_a(),fragmentShader:`

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
		`,blending:xn,depthTest:!1,depthWrite:!1})}function Am(){return new Jt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:_a(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:xn,depthTest:!1,depthWrite:!1})}function _a(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}class Nh extends Zt{constructor(e=1,t={}){super(e,e,t);this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];this.texture=new ia(i),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},i=new Ur(5,5,5),r=new Jt({name:"CubemapFromEquirect",uniforms:qi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Vt,blending:xn});r.uniforms.tEquirect.value=t;let s=new Bt(i,r),o=t.minFilter;if(t.minFilter===Bi)t.minFilter=on;return new yh(1,10,this).update(e,s),t.minFilter=o,s.geometry.dispose(),s.material.dispose(),this}clear(e,t=!0,n=!0,i=!0){let r=e.getRenderTarget();for(let s=0;s<6;s++)e.setRenderTarget(this,s),e.clear(t,n,i);e.setRenderTarget(r)}}function sS(e){let t=new WeakMap,n=new WeakMap,i=null;function r(u,p=!1){if(u===null||u===void 0)return null;if(p)return o(u);return s(u)}function s(u){if(u&&u.isTexture){let p=u.mapping;if(p===ko||p===zo)if(t.has(u)){let g=t.get(u).texture;return a(g,u.mapping)}else{let g=u.image;if(g&&g.height>0){let y=new Nh(g.height);return y.fromEquirectangularTexture(e,u),t.set(u,y),u.addEventListener("dispose",c),a(y.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture){let p=u.mapping,g=p===ko||p===zo,y=p===Pr||p===Fi;if(g||y){let m=n.get(u),d=m!==void 0?m.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==d){if(i===null)i=new Ih(e);return m=g?i.fromEquirectangular(u,m):i.fromCubemap(u,m),m.texture.pmremVersion=u.pmremVersion,n.set(u,m),m.texture}else if(m!==void 0)return m.texture;else{let b=u.image;if(g&&b&&b.height>0||y&&b&&l(b)){if(i===null)i=new Ih(e);return m=g?i.fromEquirectangular(u):i.fromCubemap(u),m.texture.pmremVersion=u.pmremVersion,n.set(u,m),u.addEventListener("dispose",h),m.texture}else return null}}}return u}function a(u,p){if(p===ko)u.mapping=Pr;else if(p===zo)u.mapping=Fi;return u}function l(u){let p=0,g=6;for(let y=0;y<g;y++)if(u[y]!==void 0)p++;return p===g}function c(u){let p=u.target;p.removeEventListener("dispose",c);let g=t.get(p);if(g!==void 0)t.delete(p),g.dispose()}function h(u){let p=u.target;p.removeEventListener("dispose",h);let g=n.get(p);if(g!==void 0)n.delete(p),g.dispose()}function f(){if(t=new WeakMap,n=new WeakMap,i!==null)i.dispose(),i=null}return{get:r,dispose:f}}function oS(e){let t={};function n(i){if(t[i]!==void 0)return t[i];let r=e.getExtension(i);return t[i]=r,r}return{has:function(i){return n(i)!==null},init:function(){n("EXT_color_buffer_float"),n("WEBGL_clip_cull_distance"),n("OES_texture_float_linear"),n("EXT_color_buffer_half_float"),n("WEBGL_multisampled_render_to_texture"),n("WEBGL_render_shared_exponent")},get:function(i){let r=n(i);if(r===null)Ui("WebGLRenderer: "+i+" extension not supported.");return r}}}function aS(e,t,n,i){let r={},s=new WeakMap;function o(f){let u=f.target;if(u.index!==null)t.remove(u.index);for(let g in u.attributes)t.remove(u.attributes[g]);u.removeEventListener("dispose",o),delete r[u.id];let p=s.get(u);if(p)t.remove(p),s.delete(u);if(i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0)delete u._maxInstanceCount;n.memory.geometries--}function a(f,u){if(r[u.id]===!0)return u;return u.addEventListener("dispose",o),r[u.id]=!0,n.memory.geometries++,u}function l(f){let u=f.attributes;for(let p in u)t.update(u[p],e.ARRAY_BUFFER)}function c(f){let u=[],p=f.index,g=f.attributes.position,y=0;if(g===void 0)return;if(p!==null){let b=p.array;y=p.version;for(let S=0,_=b.length;S<_;S+=3){let x=b[S+0],w=b[S+1],T=b[S+2];u.push(x,w,w,T,T,x)}}else{let b=g.array;y=g.version;for(let S=0,_=b.length/3-1;S<_;S+=3){let x=S+0,w=S+1,T=S+2;u.push(x,w,w,T,T,x)}}let m=new(g.count>=65535?ea:Qo)(u,1);m.version=y;let d=s.get(f);if(d)t.remove(d);s.set(f,m)}function h(f){let u=s.get(f);if(u){let p=f.index;if(p!==null){if(u.version<p.version)c(f)}}else c(f);return s.get(f)}return{get:a,update:l,getWireframeAttribute:h}}function lS(e,t,n){let i;function r(f){i=f}let s,o;function a(f){s=f.type,o=f.bytesPerElement}function l(f,u){e.drawElements(i,u,s,f*o),n.update(u,i,1)}function c(f,u,p){if(p===0)return;e.drawElementsInstanced(i,u,s,f*o,p),n.update(u,i,p)}function h(f,u,p){if(p===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,s,f,0,p);let y=0;for(let m=0;m<p;m++)y+=u[m];n.update(y,i,1)}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function cS(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(n.calls++,o){case e.TRIANGLES:n.triangles+=a*(s/3);break;case e.LINES:n.lines+=a*(s/2);break;case e.LINE_STRIP:n.lines+=a*(s-1);break;case e.LINE_LOOP:n.lines+=a*s;break;case e.POINTS:n.points+=a*s;break;default:De("WebGLInfo: Unknown draw mode:",o);break}}function r(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:r,update:i}}function hS(e,t,n){let i=new WeakMap,r=new gt;function s(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=h!==void 0?h.length:0,u=i.get(a);if(u===void 0||u.count!==f){let A=function(){T.dispose(),i.delete(a),a.removeEventListener("dispose",A)};if(u!==void 0)u.texture.dispose();let p=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,y=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],d=a.morphAttributes.normal||[],b=a.morphAttributes.color||[],S=0;if(p===!0)S=1;if(g===!0)S=2;if(y===!0)S=3;let _=a.attributes.position.count*S,x=1;if(_>t.maxTextureSize)x=Math.ceil(_/t.maxTextureSize),_=t.maxTextureSize;let w=new Float32Array(_*x*4*f),T=new Jo(w,_,x,f);T.type=ni,T.needsUpdate=!0;let v=S*4;for(let N=0;N<f;N++){let P=m[N],D=d[N],W=b[N],R=_*x*4*N;for(let I=0;I<P.count;I++){let k=I*v;if(p===!0)r.fromBufferAttribute(P,I),w[R+k+0]=r.x,w[R+k+1]=r.y,w[R+k+2]=r.z,w[R+k+3]=0;if(g===!0)r.fromBufferAttribute(D,I),w[R+k+4]=r.x,w[R+k+5]=r.y,w[R+k+6]=r.z,w[R+k+7]=0;if(y===!0)r.fromBufferAttribute(W,I),w[R+k+8]=r.x,w[R+k+9]=r.y,w[R+k+10]=r.z,w[R+k+11]=W.itemSize===4?r.w:1}}u={count:f,texture:T,size:new se(_,x)},i.set(a,u),a.addEventListener("dispose",A)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(e,"morphTexture",o.morphTexture,n);else{let p=0;for(let y=0;y<c.length;y++)p+=c[y];let g=a.morphTargetsRelative?1:1-p;l.getUniforms().setValue(e,"morphTargetBaseInfluence",g),l.getUniforms().setValue(e,"morphTargetInfluences",c)}l.getUniforms().setValue(e,"morphTargetsTexture",u.texture,n),l.getUniforms().setValue(e,"morphTargetsTextureSize",u.size)}return{update:s}}function uS(e,t,n,i,r){let s=new WeakMap;function o(c){let h=r.render.frame,f=c.geometry,u=t.get(c,f);if(s.get(u)!==h)t.update(u),s.set(u,h);if(c.isInstancedMesh){if(c.hasEventListener("dispose",l)===!1)c.addEventListener("dispose",l);if(s.get(c)!==h){if(n.update(c.instanceMatrix,e.ARRAY_BUFFER),c.instanceColor!==null)n.update(c.instanceColor,e.ARRAY_BUFFER);s.set(c,h)}}if(c.isSkinnedMesh){let p=c.skeleton;if(s.get(p)!==h)p.update(),s.set(p,h)}return u}function a(){s=new WeakMap}function l(c){let h=c.target;if(h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),n.remove(h.instanceMatrix),h.instanceColor!==null)n.remove(h.instanceColor)}return{update:o,dispose:a}}var fS={[$l]:"LINEAR_TONE_MAPPING",[Zl]:"REINHARD_TONE_MAPPING",[Jl]:"CINEON_TONE_MAPPING",[Kl]:"ACES_FILMIC_TONE_MAPPING",[ec]:"AGX_TONE_MAPPING",[tc]:"NEUTRAL_TONE_MAPPING",[Ql]:"CUSTOM_TONE_MAPPING"};function dS(e,t,n,i,r,s){let o=new Zt(t,n,{type:e,depthBuffer:r,stencilBuffer:s,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,c=new Rt;c.setAttribute("position",new mt([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new mt([0,2,0,0,2,0],2));let h=new sh({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),f=new Bt(c,h),u=new Zi(-1,1,1,-1,0,1),p=null,g=null,y=!1,m,d=null,b=[],S=!1;this.setSize=function(_,x){if(o.setSize(_,x),a!==null)a.setSize(_,x);if(l!==null)l.setSize(_,x);for(let w=0;w<b.length;w++){let T=b[w];if(T.setSize)T.setSize(_,x)}},this.setEffects=function(_){b=_,S=b.length>0&&b[0].isRenderPass===!0;let{width:x,height:w}=o;if(b.length>0&&a===null)a=new Zt(x,w,{type:bn,depthBuffer:!1,stencilBuffer:!1}),l=new Zt(x,w,{type:bn,depthBuffer:!1,stencilBuffer:!1});for(let T=0;T<b.length;T++){let v=b[T];if(v.setSize)v.setSize(x,w)}},this.begin=function(_,x){if(y)return!1;if(_.toneMapping===Cn&&b.length===0)return!1;if(d=x,x!==null){let{width:w,height:T}=x;if(o.width!==w||o.height!==T)this.setSize(w,T)}if(S===!1)_.setRenderTarget(o);return m=_.toneMapping,_.toneMapping=Cn,!0},this.hasRenderPass=function(){return S},this.end=function(_,x){_.toneMapping=m,y=!0;let w=o,T=a;for(let v=0;v<b.length;v++){let A=b[v];if(A.enabled===!1)continue;if(A.render(_,T,w,x),A.needsSwap!==!1)w=T,T=T===a?l:a}if(p!==_.outputColorSpace||g!==_.toneMapping){if(p=_.outputColorSpace,g=_.toneMapping,h.defines={},qe.getTransfer(p)===ht)h.defines.SRGB_TRANSFER="";let v=fS[g];if(v)h.defines[v]="";h.needsUpdate=!0}h.uniforms.tDiffuse.value=w.texture,_.setRenderTarget(d),_.render(f,u),d=null,y=!1},this.isCompositing=function(){return y},this.dispose=function(){if(o.dispose(),a!==null)a.dispose();if(l!==null)l.dispose();c.dispose(),h.dispose()}}var jm=new Ot,Lh=new Wi(1,1),Ym=new Jo,$m=new qc,Zm=new ia,Cm=[],Rm=[],Pm=new Float32Array(16),Im=new Float32Array(9),Lm=new Float32Array(4);function Vr(e,t,n){let i=e[0];if(i<=0||i>0)return e;let r=t*n,s=Cm[r];if(s===void 0)s=new Float32Array(r),Cm[r]=s;if(t!==0){i.toArray(s,0);for(let o=1,a=0;o!==t;++o)a+=n,e[o].toArray(s,a)}return s}function Pt(e,t){if(e.length!==t.length)return!1;for(let n=0,i=e.length;n<i;n++)if(e[n]!==t[n])return!1;return!0}function It(e,t){for(let n=0,i=t.length;n<i;n++)e[n]=t[n]}function va(e,t){let n=Rm[t];if(n===void 0)n=new Int32Array(t),Rm[t]=n;for(let i=0;i!==t;++i)n[i]=e.allocateTextureUnit();return n}function pS(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1f(this.addr,t),n[0]=t}function mS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Pt(n,t))return;e.uniform2fv(this.addr,t),It(n,t)}}function gS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else if(t.r!==void 0){if(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b}else{if(Pt(n,t))return;e.uniform3fv(this.addr,t),It(n,t)}}function _S(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Pt(n,t))return;e.uniform4fv(this.addr,t),It(n,t)}}function vS(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Pt(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),It(n,t)}else{if(Pt(n,i))return;Lm.set(i),e.uniformMatrix2fv(this.addr,!1,Lm),It(n,i)}}function yS(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Pt(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),It(n,t)}else{if(Pt(n,i))return;Im.set(i),e.uniformMatrix3fv(this.addr,!1,Im),It(n,i)}}function xS(e,t){let n=this.cache,i=t.elements;if(i===void 0){if(Pt(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),It(n,t)}else{if(Pt(n,i))return;Pm.set(i),e.uniformMatrix4fv(this.addr,!1,Pm),It(n,i)}}function bS(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1i(this.addr,t),n[0]=t}function SS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Pt(n,t))return;e.uniform2iv(this.addr,t),It(n,t)}}function MS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else{if(Pt(n,t))return;e.uniform3iv(this.addr,t),It(n,t)}}function wS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Pt(n,t))return;e.uniform4iv(this.addr,t),It(n,t)}}function ES(e,t){let n=this.cache;if(n[0]===t)return;e.uniform1ui(this.addr,t),n[0]=t}function TS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y)e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y}else{if(Pt(n,t))return;e.uniform2uiv(this.addr,t),It(n,t)}}function AS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z}else{if(Pt(n,t))return;e.uniform3uiv(this.addr,t),It(n,t)}}function CS(e,t){let n=this.cache;if(t.x!==void 0){if(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w}else{if(Pt(n,t))return;e.uniform4uiv(this.addr,t),It(n,t)}}function RS(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;let s;if(this.type===e.SAMPLER_2D_SHADOW)Lh.compareFunction=n.isReversedDepthBuffer()?Zo:$o,s=Lh;else s=jm;n.setTexture2D(t||s,r)}function PS(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;n.setTexture3D(t||$m,r)}function IS(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;n.setTextureCube(t||Zm,r)}function LS(e,t,n){let i=this.cache,r=n.allocateTextureUnit();if(i[0]!==r)e.uniform1i(this.addr,r),i[0]=r;n.setTexture2DArray(t||Ym,r)}function DS(e){switch(e){case 5126:return pS;case 35664:return mS;case 35665:return gS;case 35666:return _S;case 35674:return vS;case 35675:return yS;case 35676:return xS;case 5124:case 35670:return bS;case 35667:case 35671:return SS;case 35668:case 35672:return MS;case 35669:case 35673:return wS;case 5125:return ES;case 36294:return TS;case 36295:return AS;case 36296:return CS;case 35678:case 36198:case 36298:case 36306:case 35682:return RS;case 35679:case 36299:case 36307:return PS;case 35680:case 36300:case 36308:case 36293:return IS;case 36289:case 36303:case 36311:case 36292:return LS}}function NS(e,t){e.uniform1fv(this.addr,t)}function OS(e,t){let n=Vr(t,this.size,2);e.uniform2fv(this.addr,n)}function US(e,t){let n=Vr(t,this.size,3);e.uniform3fv(this.addr,n)}function FS(e,t){let n=Vr(t,this.size,4);e.uniform4fv(this.addr,n)}function BS(e,t){let n=Vr(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function kS(e,t){let n=Vr(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function zS(e,t){let n=Vr(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function GS(e,t){e.uniform1iv(this.addr,t)}function HS(e,t){e.uniform2iv(this.addr,t)}function VS(e,t){e.uniform3iv(this.addr,t)}function WS(e,t){e.uniform4iv(this.addr,t)}function XS(e,t){e.uniform1uiv(this.addr,t)}function qS(e,t){e.uniform2uiv(this.addr,t)}function jS(e,t){e.uniform3uiv(this.addr,t)}function YS(e,t){e.uniform4uiv(this.addr,t)}function $S(e,t,n){let i=this.cache,r=t.length,s=va(n,r);if(!Pt(i,s))e.uniform1iv(this.addr,s),It(i,s);let o;if(this.type===e.SAMPLER_2D_SHADOW)o=Lh;else o=jm;for(let a=0;a!==r;++a)n.setTexture2D(t[a]||o,s[a])}function ZS(e,t,n){let i=this.cache,r=t.length,s=va(n,r);if(!Pt(i,s))e.uniform1iv(this.addr,s),It(i,s);for(let o=0;o!==r;++o)n.setTexture3D(t[o]||$m,s[o])}function JS(e,t,n){let i=this.cache,r=t.length,s=va(n,r);if(!Pt(i,s))e.uniform1iv(this.addr,s),It(i,s);for(let o=0;o!==r;++o)n.setTextureCube(t[o]||Zm,s[o])}function KS(e,t,n){let i=this.cache,r=t.length,s=va(n,r);if(!Pt(i,s))e.uniform1iv(this.addr,s),It(i,s);for(let o=0;o!==r;++o)n.setTexture2DArray(t[o]||Ym,s[o])}function QS(e){switch(e){case 5126:return NS;case 35664:return OS;case 35665:return US;case 35666:return FS;case 35674:return BS;case 35675:return kS;case 35676:return zS;case 5124:case 35670:return GS;case 35667:case 35671:return HS;case 35668:case 35672:return VS;case 35669:case 35673:return WS;case 5125:return XS;case 36294:return qS;case 36295:return jS;case 36296:return YS;case 35678:case 36198:case 36298:case 36306:case 35682:return $S;case 35679:case 36299:case 36307:return ZS;case 35680:case 36300:case 36308:case 36293:return JS;case 36289:case 36303:case 36311:case 36292:return KS}}class Jm{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=DS(t.type)}}class Km{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=QS(t.type)}}class Qm{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let i=this.seq;for(let r=0,s=i.length;r!==s;++r){let o=i[r];o.setValue(e,t[o.id],n)}}}var Rh=/(\w+)(\])?(\[|\.)?/g;function Dm(e,t){e.seq.push(t),e.map[t.id]=t}function eM(e,t,n){let i=e.name,r=i.length;Rh.lastIndex=0;while(!0){let s=Rh.exec(i),o=Rh.lastIndex,a=s[1],l=s[2]==="]",c=s[3];if(l)a=a|0;if(c===void 0||c==="["&&o+2===r){Dm(n,c===void 0?new Jm(a,e,t):new Km(a,e,t));break}else{let f=n.map[a];if(f===void 0)f=new Qm(a),Dm(n,f);n=f}}}class Ds{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){let o=e.getActiveUniform(t,s),a=e.getUniformLocation(t,o.name);eM(o,a,this)}let i=[],r=[];for(let s of this.seq)if(s.type===e.SAMPLER_2D_SHADOW||s.type===e.SAMPLER_CUBE_SHADOW||s.type===e.SAMPLER_2D_ARRAY_SHADOW)i.push(s);else r.push(s);if(i.length>0)this.seq=i.concat(r)}setValue(e,t,n,i){let r=this.map[t];if(r!==void 0)r.setValue(e,n,i)}setOptional(e,t,n){let i=t[n];if(i!==void 0)this.setValue(e,n,i)}static upload(e,t,n,i){for(let r=0,s=t.length;r!==s;++r){let o=t[r],a=n[o.id];if(a.needsUpdate!==!1)o.setValue(e,a.value,i)}}static seqWithValue(e,t){let n=[];for(let i=0,r=e.length;i!==r;++i){let s=e[i];if(s.id in t)n.push(s)}return n}}function Nm(e,t,n){let i=e.createShader(t);return e.shaderSource(i,n),e.compileShader(i),i}var tM=37297,nM=0;function iM(e,t){let n=e.split(`
`),i=[],r=Math.max(t-6,0),s=Math.min(t+6,n.length);for(let o=r;o<s;o++){let a=o+1;i.push(`${a===t?">":" "} ${a}: ${n[o]}`)}return i.join(`
`)}var Om=new Fe;function rM(e){qe._getMatrix(Om,qe.workingColorSpace,e);let t=`mat3( ${Om.elements.map((n)=>n.toFixed(4))} )`;switch(qe.getTransfer(e)){case zc:return[t,"LinearTransferOETF"];case ht:return[t,"sRGBTransferOETF"];default:return Ie("WebGLProgram: Unsupported color space: ",e),[t,"LinearTransferOETF"]}}function Um(e,t,n){let i=e.getShaderParameter(t,e.COMPILE_STATUS),s=(e.getShaderInfoLog(t)||"").trim();if(i&&s==="")return"";let o=/ERROR: 0:(\d+)/.exec(s);if(o){let a=parseInt(o[1]);return n.toUpperCase()+`

`+s+`

`+iM(e.getShaderSource(t),a)}else return s}function sM(e,t){let n=rM(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,"}"].join(`
`)}var oM={[$l]:"Linear",[Zl]:"Reinhard",[Jl]:"Cineon",[Kl]:"ACESFilmic",[ec]:"AgX",[tc]:"Neutral",[Ql]:"Custom"};function aM(e,t){let n=oM[t];if(n===void 0)return Ie("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+e+"( vec3 color ) { return LinearToneMapping( color ); }";return"vec3 "+e+"( vec3 color ) { return "+n+"ToneMapping( color ); }"}var ga=new L;function lM(){qe.getLuminanceCoefficients(ga);let e=ga.x.toFixed(4),t=ga.y.toFixed(4),n=ga.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${t}, ${n} );`,"\treturn dot( weights, rgb );","}"].join(`
`)}function cM(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Ls).join(`
`)}function hM(e){let t=[];for(let n in e){let i=e[n];if(i===!1)continue;t.push("#define "+n+" "+i)}return t.join(`
`)}function uM(e,t){let n={},i=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){let s=e.getActiveAttrib(t,r),o=s.name,a=1;if(s.type===e.FLOAT_MAT2)a=2;if(s.type===e.FLOAT_MAT3)a=3;if(s.type===e.FLOAT_MAT4)a=4;n[o]={type:s.type,location:e.getAttribLocation(t,o),locationSize:a}}return n}function Ls(e){return e!==""}function Fm(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Bm(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var fM=/^[ \t]*#include +<([\w\d./]+)>/gm;function Dh(e){return e.replace(fM,pM)}var dM=new Map;function pM(e,t){let n=Ve[t];if(n===void 0){let i=dM.get(t);if(i!==void 0)n=Ve[i],Ie('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return Dh(n)}var mM=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function km(e){return e.replace(mM,gM)}function gM(e,t,n,i){let r="";for(let s=parseInt(t);s<parseInt(n);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function zm(e){let t=`precision ${e.precision} float;
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
#define LOW_PRECISION`;return t}var _M={[ds]:"SHADOWMAP_TYPE_PCF",[Ar]:"SHADOWMAP_TYPE_VSM"};function vM(e){return _M[e.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var yM={[Pr]:"ENVMAP_TYPE_CUBE",[Fi]:"ENVMAP_TYPE_CUBE",[ms]:"ENVMAP_TYPE_CUBE_UV"};function xM(e){if(e.envMap===!1)return"ENVMAP_TYPE_CUBE";return yM[e.envMapMode]||"ENVMAP_TYPE_CUBE"}var bM={[Fi]:"ENVMAP_MODE_REFRACTION"};function SM(e){if(e.envMap===!1)return"ENVMAP_MODE_REFLECTION";return bM[e.envMapMode]||"ENVMAP_MODE_REFLECTION"}var MM={[Yp]:"ENVMAP_BLENDING_MULTIPLY",[$p]:"ENVMAP_BLENDING_MIX",[Zp]:"ENVMAP_BLENDING_ADD"};function wM(e){if(e.envMap===!1)return"ENVMAP_BLENDING_NONE";return MM[e.combine]||"ENVMAP_BLENDING_NONE"}function EM(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,n),112)),texelHeight:i,maxMip:n}}function TM(e,t,n,i){let r=e.getContext(),{defines:s,vertexShader:o,fragmentShader:a}=n,l=vM(n),c=xM(n),h=SM(n),f=wM(n),u=EM(n),p=cM(n),g=hM(s),y=r.createProgram(),m,d,b=n.glslVersion?"#version "+n.glslVersion+`
`:"";if(n.isRawShaderMaterial){if(m=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(Ls).join(`
`),m.length>0)m+=`
`;if(d=["#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g].filter(Ls).join(`
`),d.length>0)d+=`
`}else m=[zm(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",n.batching?"#define USE_BATCHING":"",n.batchingColor?"#define USE_BATCHING_COLOR":"",n.instancing?"#define USE_INSTANCING":"",n.instancingColor?"#define USE_INSTANCING_COLOR":"",n.instancingMorph?"#define USE_INSTANCING_MORPH":"",n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.map?"#define USE_MAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+h:"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.displacementMap?"#define USE_DISPLACEMENTMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.mapUv?"#define MAP_UV "+n.mapUv:"",n.alphaMapUv?"#define ALPHAMAP_UV "+n.alphaMapUv:"",n.lightMapUv?"#define LIGHTMAP_UV "+n.lightMapUv:"",n.aoMapUv?"#define AOMAP_UV "+n.aoMapUv:"",n.emissiveMapUv?"#define EMISSIVEMAP_UV "+n.emissiveMapUv:"",n.bumpMapUv?"#define BUMPMAP_UV "+n.bumpMapUv:"",n.normalMapUv?"#define NORMALMAP_UV "+n.normalMapUv:"",n.displacementMapUv?"#define DISPLACEMENTMAP_UV "+n.displacementMapUv:"",n.metalnessMapUv?"#define METALNESSMAP_UV "+n.metalnessMapUv:"",n.roughnessMapUv?"#define ROUGHNESSMAP_UV "+n.roughnessMapUv:"",n.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+n.anisotropyMapUv:"",n.clearcoatMapUv?"#define CLEARCOATMAP_UV "+n.clearcoatMapUv:"",n.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+n.clearcoatNormalMapUv:"",n.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+n.clearcoatRoughnessMapUv:"",n.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+n.iridescenceMapUv:"",n.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+n.iridescenceThicknessMapUv:"",n.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+n.sheenColorMapUv:"",n.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+n.sheenRoughnessMapUv:"",n.specularMapUv?"#define SPECULARMAP_UV "+n.specularMapUv:"",n.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+n.specularColorMapUv:"",n.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+n.specularIntensityMapUv:"",n.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+n.transmissionMapUv:"",n.thicknessMapUv?"#define THICKNESSMAP_UV "+n.thicknessMapUv:"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexNormals?"#define HAS_NORMAL":"",n.vertexColors?"#define USE_COLOR":"",n.vertexAlphas?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.flatShading?"#define FLAT_SHADED":"",n.skinning?"#define USE_SKINNING":"",n.morphTargets?"#define USE_MORPHTARGETS":"",n.morphNormals&&n.flatShading===!1?"#define USE_MORPHNORMALS":"",n.morphColors?"#define USE_MORPHCOLORS":"",n.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+n.morphTextureStride:"",n.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+n.morphTargetsCount:"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.sizeAttenuation?"#define USE_SIZEATTENUATION":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","\tattribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","\tattribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","\tuniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","\tattribute vec2 uv1;","#endif","#ifdef USE_UV2","\tattribute vec2 uv2;","#endif","#ifdef USE_UV3","\tattribute vec2 uv3;","#endif","#ifdef USE_TANGENT","\tattribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","\tattribute vec4 color;","#elif defined( USE_COLOR )","\tattribute vec3 color;","#endif","#ifdef USE_SKINNING","\tattribute vec4 skinIndex;","\tattribute vec4 skinWeight;","#endif",`
`].filter(Ls).join(`
`),d=[zm(n),"#define SHADER_TYPE "+n.shaderType,"#define SHADER_NAME "+n.shaderName,g,n.useFog&&n.fog?"#define USE_FOG":"",n.useFog&&n.fogExp2?"#define FOG_EXP2":"",n.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",n.map?"#define USE_MAP":"",n.matcap?"#define USE_MATCAP":"",n.envMap?"#define USE_ENVMAP":"",n.envMap?"#define "+c:"",n.envMap?"#define "+h:"",n.envMap?"#define "+f:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",n.lightMap?"#define USE_LIGHTMAP":"",n.aoMap?"#define USE_AOMAP":"",n.bumpMap?"#define USE_BUMPMAP":"",n.normalMap?"#define USE_NORMALMAP":"",n.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",n.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",n.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",n.emissiveMap?"#define USE_EMISSIVEMAP":"",n.anisotropy?"#define USE_ANISOTROPY":"",n.anisotropyMap?"#define USE_ANISOTROPYMAP":"",n.clearcoat?"#define USE_CLEARCOAT":"",n.clearcoatMap?"#define USE_CLEARCOATMAP":"",n.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",n.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",n.dispersion?"#define USE_DISPERSION":"",n.retroreflection?"#define USE_RETROREFLECTION":"",n.iridescence?"#define USE_IRIDESCENCE":"",n.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",n.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",n.specularMap?"#define USE_SPECULARMAP":"",n.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",n.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",n.roughnessMap?"#define USE_ROUGHNESSMAP":"",n.metalnessMap?"#define USE_METALNESSMAP":"",n.alphaMap?"#define USE_ALPHAMAP":"",n.alphaTest?"#define USE_ALPHATEST":"",n.alphaHash?"#define USE_ALPHAHASH":"",n.sheen?"#define USE_SHEEN":"",n.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",n.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",n.transmission?"#define USE_TRANSMISSION":"",n.transmissionMap?"#define USE_TRANSMISSIONMAP":"",n.thicknessMap?"#define USE_THICKNESSMAP":"",n.vertexTangents&&n.flatShading===!1?"#define USE_TANGENT":"",n.vertexColors||n.instancingColor?"#define USE_COLOR":"",n.vertexAlphas||n.batchingColor?"#define USE_COLOR_ALPHA":"",n.vertexUv1s?"#define USE_UV1":"",n.vertexUv2s?"#define USE_UV2":"",n.vertexUv3s?"#define USE_UV3":"",n.pointsUvs?"#define USE_POINTS_UV":"",n.gradientMap?"#define USE_GRADIENTMAP":"",n.flatShading?"#define FLAT_SHADED":"",n.doubleSided?"#define DOUBLE_SIDED":"",n.flipSided?"#define FLIP_SIDED":"",n.shadowMapEnabled?"#define USE_SHADOWMAP":"",n.shadowMapEnabled?"#define "+l:"",n.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",n.numLightProbes>0?"#define USE_LIGHT_PROBES":"",n.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",n.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",n.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",n.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",n.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",n.toneMapping!==Cn?"#define TONE_MAPPING":"",n.toneMapping!==Cn?Ve.tonemapping_pars_fragment:"",n.toneMapping!==Cn?aM("toneMapping",n.toneMapping):"",n.dithering?"#define DITHERING":"",n.opaque?"#define OPAQUE":"",Ve.colorspace_pars_fragment,sM("linearToOutputTexel",n.outputColorSpace),lM(),n.useDepthPacking?"#define DEPTH_PACKING "+n.depthPacking:"",`
`].filter(Ls).join(`
`);if(o=Dh(o),o=Fm(o,n),o=Bm(o,n),a=Dh(a),a=Fm(a,n),a=Bm(a,n),o=km(o),a=km(a),n.isRawShaderMaterial!==!0)b=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,d=["#define varying in",n.glslVersion===Gc?"":"layout(location = 0) out highp vec4 pc_fragColor;",n.glslVersion===Gc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+d;let S=b+m+o,_=b+d+a,x=Nm(r,r.VERTEX_SHADER,S),w=Nm(r,r.FRAGMENT_SHADER,_);if(r.attachShader(y,x),r.attachShader(y,w),n.index0AttributeName!==void 0)r.bindAttribLocation(y,0,n.index0AttributeName);else if(n.hasPositionAttribute===!0)r.bindAttribLocation(y,0,"position");r.linkProgram(y);function T(P){if(e.debug.checkShaderErrors){let D=r.getProgramInfoLog(y)||"",W=r.getShaderInfoLog(x)||"",R=r.getShaderInfoLog(w)||"",I=D.trim(),k=W.trim(),z=R.trim(),te=!0,Y=!0;if(r.getProgramParameter(y,r.LINK_STATUS)===!1)if(te=!1,typeof e.debug.onShaderError==="function")e.debug.onShaderError(r,y,x,w);else{let Q=Um(r,x,"vertex"),G=Um(r,w,"fragment");De("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(y,r.VALIDATE_STATUS)+`

Material Name: `+P.name+`
Material Type: `+P.type+`

Program Info Log: `+I+`
`+Q+`
`+G)}else if(I!=="")Ie("WebGLProgram: Program Info Log:",I);else if(k===""||z==="")Y=!1;if(Y)P.diagnostics={runnable:te,programLog:I,vertexShader:{log:k,prefix:m},fragmentShader:{log:z,prefix:d}}}r.deleteShader(x),r.deleteShader(w),v=new Ds(r,y),A=uM(r,y)}let v;this.getUniforms=function(){if(v===void 0)T(this);return v};let A;this.getAttributes=function(){if(A===void 0)T(this);return A};let N=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){if(N===!1)N=r.getProgramParameter(y,tM);return N},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(y),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=nM++,this.cacheKey=t,this.usedTimes=1,this.program=y,this.vertexShader=x,this.fragmentShader=w,this}var AM=0;class eg{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let i=this._getShaderCacheForMaterial(e);if(i.has(t)===!1)i.add(t),t.usedTimes++;if(i.has(n)===!1)i.add(n),n.usedTimes++;return this}remove(e){let t=this.materialCache.get(e);for(let n of t)if(n.usedTimes--,n.usedTimes===0)this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);if(n===void 0)n=new Set,t.set(e,n);return n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);if(n===void 0)n=new tg(e),t.set(e,n);return n}}class tg{constructor(e){this.id=AM++,this.code=e,this.usedTimes=0}}function CM(e){return e===Gi||e===jo||e===Yo}function RM(e,t,n,i,r,s){let o=new ys,a=new eg,l=new Set,c=[],h=new Map,{logarithmicDepthBuffer:f,precision:u}=i,p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(v){if(l.add(v),v===0)return"uv";return`uv${v}`}function y(v,A,N,P,D,W){let R=P.fog,I=D.geometry,k=v.isMeshStandardMaterial||v.isMeshLambertMaterial||v.isMeshPhongMaterial?P.environment:null,z=v.isMeshStandardMaterial||v.isMeshLambertMaterial&&!v.envMap||v.isMeshPhongMaterial&&!v.envMap,te=t.get(v.envMap||k,z),Y=!!te&&te.mapping===ms?te.image.height:null,Q=p[v.type];if(v.precision!==null){if(u=i.getMaxPrecision(v.precision),u!==v.precision)Ie("WebGLProgram.getParameters:",v.precision,"not supported, using",u,"instead.")}let G=I.morphAttributes.position||I.morphAttributes.normal||I.morphAttributes.color,ee=G!==void 0?G.length:0,oe=0;if(I.morphAttributes.position!==void 0)oe=1;if(I.morphAttributes.normal!==void 0)oe=2;if(I.morphAttributes.color!==void 0)oe=3;let Ue,Re,X,re;if(Q){let ut=Hn[Q];Ue=ut.vertexShader,Re=ut.fragmentShader}else{Ue=v.vertexShader,Re=v.fragmentShader;let ut=a.getVertexShaderStage(v),nt=a.getFragmentShaderStage(v);a.update(v,ut,nt),X=ut.id,re=nt.id}let le=e.getRenderTarget(),Pe=e.state.buffers.depth.getReversed(),Oe=D.isInstancedMesh===!0,Ae=D.isBatchedMesh===!0,Et=!!v.map,Xe=!!v.matcap,je=!!te,rt=!!v.aoMap,Ye=!!v.lightMap,Ut=!!v.bumpMap&&v.wireframe===!1,dt=!!v.normalMap,en=!!v.displacementMap,Tt=!!v.emissiveMap,At=!!v.metalnessMap,U=!!v.roughnessMap,tn=v.anisotropy>0,tt=v.clearcoat>0,yt=v.dispersion>0,C=v.retroreflectivity>0,M=v.iridescence>0,O=v.sheen>0,q=v.transmission>0,ie=tn&&!!v.anisotropyMap,ce=tt&&!!v.clearcoatMap,fe=tt&&!!v.clearcoatNormalMap,Z=tt&&!!v.clearcoatRoughnessMap,K=M&&!!v.iridescenceMap,ve=M&&!!v.iridescenceThicknessMap,Te=O&&!!v.sheenColorMap,de=O&&!!v.sheenRoughnessMap,ae=!!v.specularMap,Ce=!!v.specularColorMap,Le=!!v.specularIntensityMap,Je=q&&!!v.transmissionMap,B=q&&!!v.thicknessMap,he=!!v.gradientMap,J=!!v.alphaMap,ue=v.alphaTest>0,ye=!!v.alphaHash,ne=!!v.extensions,me=Cn;if(v.toneMapped){if(le===null||le.isXRRenderTarget===!0)me=e.toneMapping}let Be={shaderID:Q,shaderType:v.type,shaderName:v.name,vertexShader:Ue,fragmentShader:Re,defines:v.defines,customVertexShaderID:X,customFragmentShaderID:re,isRawShaderMaterial:v.isRawShaderMaterial===!0,glslVersion:v.glslVersion,precision:u,batching:Ae,batchingColor:Ae&&D._colorsTexture!==null,instancing:Oe,instancingColor:Oe&&D.instanceColor!==null,instancingMorph:Oe&&D.morphTexture!==null,outputColorSpace:le===null?e.outputColorSpace:le.isXRRenderTarget===!0?le.texture.colorSpace:qe.workingColorSpace,alphaToCoverage:!!v.alphaToCoverage,map:Et,matcap:Xe,envMap:je,envMapMode:je&&te.mapping,envMapCubeUVHeight:Y,aoMap:rt,lightMap:Ye,bumpMap:Ut,normalMap:dt,displacementMap:en,emissiveMap:Tt,normalMapObjectSpace:dt&&v.normalMapType===am,normalMapTangentSpace:dt&&v.normalMapType===Bc,packedNormalMap:dt&&v.normalMapType===Bc&&CM(v.normalMap.format),metalnessMap:At,roughnessMap:U,anisotropy:tn,anisotropyMap:ie,clearcoat:tt,clearcoatMap:ce,clearcoatNormalMap:fe,clearcoatRoughnessMap:Z,dispersion:yt,retroreflection:C,iridescence:M,iridescenceMap:K,iridescenceThicknessMap:ve,sheen:O,sheenColorMap:Te,sheenRoughnessMap:de,specularMap:ae,specularColorMap:Ce,specularIntensityMap:Le,transmission:q,transmissionMap:Je,thicknessMap:B,gradientMap:he,opaque:v.transparent===!1&&v.blending===ps&&v.alphaToCoverage===!1,alphaMap:J,alphaTest:ue,alphaHash:ye,combine:v.combine,mapUv:Et&&g(v.map.channel),aoMapUv:rt&&g(v.aoMap.channel),lightMapUv:Ye&&g(v.lightMap.channel),bumpMapUv:Ut&&g(v.bumpMap.channel),normalMapUv:dt&&g(v.normalMap.channel),displacementMapUv:en&&g(v.displacementMap.channel),emissiveMapUv:Tt&&g(v.emissiveMap.channel),metalnessMapUv:At&&g(v.metalnessMap.channel),roughnessMapUv:U&&g(v.roughnessMap.channel),anisotropyMapUv:ie&&g(v.anisotropyMap.channel),clearcoatMapUv:ce&&g(v.clearcoatMap.channel),clearcoatNormalMapUv:fe&&g(v.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Z&&g(v.clearcoatRoughnessMap.channel),iridescenceMapUv:K&&g(v.iridescenceMap.channel),iridescenceThicknessMapUv:ve&&g(v.iridescenceThicknessMap.channel),sheenColorMapUv:Te&&g(v.sheenColorMap.channel),sheenRoughnessMapUv:de&&g(v.sheenRoughnessMap.channel),specularMapUv:ae&&g(v.specularMap.channel),specularColorMapUv:Ce&&g(v.specularColorMap.channel),specularIntensityMapUv:Le&&g(v.specularIntensityMap.channel),transmissionMapUv:Je&&g(v.transmissionMap.channel),thicknessMapUv:B&&g(v.thicknessMap.channel),alphaMapUv:J&&g(v.alphaMap.channel),vertexTangents:!!I.attributes.tangent&&(dt||tn),vertexNormals:!!I.attributes.normal,vertexColors:v.vertexColors,vertexAlphas:v.vertexColors===!0&&!!I.attributes.color&&I.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!I.attributes.uv&&(Et||J),fog:!!R,useFog:v.fog===!0,fogExp2:!!R&&R.isFogExp2,flatShading:v.wireframe===!1&&(v.flatShading===!0||I.attributes.normal===void 0&&dt===!1&&(v.isMeshLambertMaterial||v.isMeshPhongMaterial||v.isMeshStandardMaterial||v.isMeshPhysicalMaterial)),sizeAttenuation:v.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:Pe,skinning:D.isSkinnedMesh===!0,hasPositionAttribute:I.attributes.position!==void 0,morphTargets:I.morphAttributes.position!==void 0,morphNormals:I.morphAttributes.normal!==void 0,morphColors:I.morphAttributes.color!==void 0,morphTargetsCount:ee,morphTextureStride:oe,numSunLights:A.sun.length,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numSunLightShadows:A.sunShadowMap.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:W.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:v.dithering,shadowMapEnabled:e.shadowMap.enabled&&N.length>0,shadowMapType:e.shadowMap.type,toneMapping:me,decodeVideoTexture:Et&&v.map.isVideoTexture===!0&&qe.getTransfer(v.map.colorSpace)===ht,decodeVideoTextureEmissive:Tt&&v.emissiveMap.isVideoTexture===!0&&qe.getTransfer(v.emissiveMap.colorSpace)===ht,premultipliedAlpha:v.premultipliedAlpha,doubleSided:v.side===Fn,flipSided:v.side===Vt,useDepthPacking:v.depthPacking>=0,depthPacking:v.depthPacking||0,index0AttributeName:v.index0AttributeName,extensionClipCullDistance:ne&&v.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ne&&v.extensions.multiDraw===!0||Ae)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:v.customProgramCacheKey()};return Be.vertexUv1s=l.has(1),Be.vertexUv2s=l.has(2),Be.vertexUv3s=l.has(3),l.clear(),Be}function m(v){let A=[];if(v.shaderID)A.push(v.shaderID);else A.push(v.customVertexShaderID),A.push(v.customFragmentShaderID);if(v.defines!==void 0)for(let N in v.defines)A.push(N),A.push(v.defines[N]);if(v.isRawShaderMaterial===!1)d(A,v),b(A,v),A.push(e.outputColorSpace);return A.push(v.customProgramCacheKey),A.join()}function d(v,A){v.push(A.precision),v.push(A.outputColorSpace),v.push(A.envMapMode),v.push(A.envMapCubeUVHeight),v.push(A.mapUv),v.push(A.alphaMapUv),v.push(A.lightMapUv),v.push(A.aoMapUv),v.push(A.bumpMapUv),v.push(A.normalMapUv),v.push(A.displacementMapUv),v.push(A.emissiveMapUv),v.push(A.metalnessMapUv),v.push(A.roughnessMapUv),v.push(A.anisotropyMapUv),v.push(A.clearcoatMapUv),v.push(A.clearcoatNormalMapUv),v.push(A.clearcoatRoughnessMapUv),v.push(A.iridescenceMapUv),v.push(A.iridescenceThicknessMapUv),v.push(A.sheenColorMapUv),v.push(A.sheenRoughnessMapUv),v.push(A.specularMapUv),v.push(A.specularColorMapUv),v.push(A.specularIntensityMapUv),v.push(A.transmissionMapUv),v.push(A.thicknessMapUv),v.push(A.combine),v.push(A.fogExp2),v.push(A.sizeAttenuation),v.push(A.morphTargetsCount),v.push(A.morphAttributeCount),v.push(A.numSunLights),v.push(A.numDirLights),v.push(A.numPointLights),v.push(A.numSpotLights),v.push(A.numSpotLightMaps),v.push(A.numHemiLights),v.push(A.numRectAreaLights),v.push(A.numSunLightShadows),v.push(A.numDirLightShadows),v.push(A.numPointLightShadows),v.push(A.numSpotLightShadows),v.push(A.numSpotLightShadowsWithMaps),v.push(A.numLightProbes),v.push(A.shadowMapType),v.push(A.toneMapping),v.push(A.numClippingPlanes),v.push(A.numClipIntersection),v.push(A.depthPacking)}function b(v,A){if(o.disableAll(),A.instancing)o.enable(0);if(A.instancingColor)o.enable(1);if(A.instancingMorph)o.enable(2);if(A.matcap)o.enable(3);if(A.envMap)o.enable(4);if(A.normalMapObjectSpace)o.enable(5);if(A.normalMapTangentSpace)o.enable(6);if(A.clearcoat)o.enable(7);if(A.iridescence)o.enable(8);if(A.alphaTest)o.enable(9);if(A.vertexColors)o.enable(10);if(A.vertexAlphas)o.enable(11);if(A.vertexUv1s)o.enable(12);if(A.vertexUv2s)o.enable(13);if(A.vertexUv3s)o.enable(14);if(A.vertexTangents)o.enable(15);if(A.anisotropy)o.enable(16);if(A.alphaHash)o.enable(17);if(A.batching)o.enable(18);if(A.dispersion)o.enable(19);if(A.retroreflection)o.enable(24);if(A.batchingColor)o.enable(20);if(A.gradientMap)o.enable(21);if(A.packedNormalMap)o.enable(22);if(A.vertexNormals)o.enable(23);if(v.push(o.mask),o.disableAll(),A.fog)o.enable(0);if(A.useFog)o.enable(1);if(A.flatShading)o.enable(2);if(A.logarithmicDepthBuffer)o.enable(3);if(A.reversedDepthBuffer)o.enable(4);if(A.skinning)o.enable(5);if(A.morphTargets)o.enable(6);if(A.morphNormals)o.enable(7);if(A.morphColors)o.enable(8);if(A.premultipliedAlpha)o.enable(9);if(A.shadowMapEnabled)o.enable(10);if(A.doubleSided)o.enable(11);if(A.flipSided)o.enable(12);if(A.useDepthPacking)o.enable(13);if(A.dithering)o.enable(14);if(A.transmission)o.enable(15);if(A.sheen)o.enable(16);if(A.opaque)o.enable(17);if(A.pointsUvs)o.enable(18);if(A.decodeVideoTexture)o.enable(19);if(A.decodeVideoTextureEmissive)o.enable(20);if(A.alphaToCoverage)o.enable(21);if(A.numLightProbeGrids>0)o.enable(22);if(A.hasPositionAttribute)o.enable(23);v.push(o.mask)}function S(v){let A=p[v.type],N;if(A){let P=Hn[A];N=aa.clone(P.uniforms)}else N=v.uniforms;return N}function _(v,A){let N=h.get(A);if(N!==void 0)++N.usedTimes;else N=new TM(e,A,v,r),c.push(N),h.set(A,N);return N}function x(v){if(--v.usedTimes===0){let A=c.indexOf(v);c[A]=c[c.length-1],c.pop(),h.delete(v.cacheKey),v.destroy()}}function w(v){a.remove(v)}function T(){a.dispose()}return{getParameters:y,getProgramCacheKey:m,getUniforms:S,acquireProgram:_,releaseProgram:x,releaseShaderCache:w,programs:c,dispose:T}}function PM(){let e=new WeakMap;function t(o){return e.has(o)}function n(o){let a=e.get(o);if(a===void 0)a={},e.set(o,a);return a}function i(o){e.delete(o)}function r(o,a,l){e.get(o)[a]=l}function s(){e=new WeakMap}return{has:t,get:n,remove:i,update:r,dispose:s}}function IM(e,t){if(e.groupOrder!==t.groupOrder)return e.groupOrder-t.groupOrder;else if(e.renderOrder!==t.renderOrder)return e.renderOrder-t.renderOrder;else if(e.material.id!==t.material.id)return e.material.id-t.material.id;else if(e.materialVariant!==t.materialVariant)return e.materialVariant-t.materialVariant;else if(e.z!==t.z)return e.z-t.z;else return e.id-t.id}function Gm(e,t){if(e.groupOrder!==t.groupOrder)return e.groupOrder-t.groupOrder;else if(e.renderOrder!==t.renderOrder)return e.renderOrder-t.renderOrder;else if(e.z!==t.z)return t.z-e.z;else return e.id-t.id}function Hm(){let e=[],t=0,n=[],i=[],r=[];function s(){t=0,n.length=0,i.length=0,r.length=0}function o(u){let p=0;if(u.isInstancedMesh)p+=2;if(u.isSkinnedMesh)p+=1;return p}function a(u,p,g,y,m,d){let b=e[t];if(b===void 0)b={id:u.id,object:u,geometry:p,material:g,materialVariant:o(u),groupOrder:y,renderOrder:u.renderOrder,z:m,group:d},e[t]=b;else b.id=u.id,b.object=u,b.geometry=p,b.material=g,b.materialVariant=o(u),b.groupOrder=y,b.renderOrder=u.renderOrder,b.z=m,b.group=d;return t++,b}function l(u,p,g,y,m,d,b){if(b.reversedDepth===!0)m=-m;let S=a(u,p,g,y,m,d);if(g.transmission>0)i.push(S);else if(g.transparent===!0)r.push(S);else n.push(S)}function c(u,p,g,y,m,d){let b=a(u,p,g,y,m,d);if(g.transmission>0)i.unshift(b);else if(g.transparent===!0)r.unshift(b);else n.unshift(b)}function h(u,p){if(n.length>1)n.sort(u||IM);if(i.length>1)i.sort(p||Gm);if(r.length>1)r.sort(p||Gm)}function f(){for(let u=t,p=e.length;u<p;u++){let g=e[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:n,transmissive:i,transparent:r,init:s,push:l,unshift:c,finish:f,sort:h}}function LM(){let e=new WeakMap;function t(i,r){let s=e.get(i),o;if(s===void 0)o=new Hm,e.set(i,[o]);else if(r>=s.length)o=new Hm,s.push(o);else o=s[r];return o}function n(){e=new WeakMap}return{get:t,dispose:n}}function DM(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"SunLight":case"DirectionalLight":n={direction:new L,color:new ke};break;case"SpotLight":n={position:new L,direction:new L,color:new ke,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":n={position:new L,color:new ke,distance:0,decay:0};break;case"HemisphereLight":n={direction:new L,skyColor:new ke,groundColor:new ke};break;case"RectAreaLight":n={color:new ke,position:new L,halfWidth:new L,halfHeight:new L};break}return e[t.id]=n,n}}}function NM(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case"SunLight":case"DirectionalLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new se};break;case"SpotLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new se};break;case"PointLight":n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new se,shadowCameraNear:1,shadowCameraFar:1000};break}return e[t.id]=n,n}}}var OM=0;function UM(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+(t.map?1:0)-(e.map?1:0)}function FM(e){let t=new DM,n=NM(),i={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new L);let r=new L,s=new Ke,o=new Ke;function a(c){let h=0,f=0,u=0;for(let D=0;D<9;D++)i.probe[D].set(0,0,0);let p=0,g=0,y=0,m=0,d=0,b=0,S=0,_=0,x=0,w=0,T=0,v=0,A=0,N=0;c.sort(UM);for(let D=0,W=c.length;D<W;D++){let R=c[D],{color:I,intensity:k,distance:z}=R,te=null;if(R.shadow&&R.shadow.map)if(R.shadow.map.texture.format===Gi)te=R.shadow.map.texture;else te=R.shadow.map.depthTexture||R.shadow.map.texture;if(R.isAmbientLight)h+=I.r*k,f+=I.g*k,u+=I.b*k;else if(R.isLightProbe){for(let Y=0;Y<9;Y++)i.probe[Y].addScaledVector(R.sh.coefficients[Y],k);N++}else if(R.isSunLight){let Y=t.get(R);if(Y.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){let Q=R.shadow,G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize.copy(Q.mapSize).multiply(Q.getFrameExtents()),i.sunShadow[g]=G,i.sunShadowMap[g]=te;let ee=Q.getViewportCount();for(let oe=0;oe<ee;oe++)i.sunShadowMatrix[y+oe]=Q.getMatrix(oe),i.sunShadowCascade[y+oe]=Q._cascadeData[oe];y+=ee,g++}i.sun[p]=Y,p++}else if(R.isDirectionalLight){let Y=t.get(R);if(Y.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){let Q=R.shadow,G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize=Q.mapSize,i.directionalShadow[m]=G,i.directionalShadowMap[m]=te,i.directionalShadowMatrix[m]=R.shadow.matrix,x++}i.directional[m]=Y,m++}else if(R.isSpotLight){let Y=t.get(R);Y.position.setFromMatrixPosition(R.matrixWorld),Y.color.copy(I).multiplyScalar(k),Y.distance=z,Y.coneCos=Math.cos(R.angle),Y.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),Y.decay=R.decay,i.spot[b]=Y;let Q=R.shadow;if(R.map){if(i.spotLightMap[v]=R.map,v++,Q.updateMatrices(R),R.castShadow)A++}if(i.spotLightMatrix[b]=Q.matrix,R.castShadow){let G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize=Q.mapSize,i.spotShadow[b]=G,i.spotShadowMap[b]=te,T++}b++}else if(R.isRectAreaLight){let Y=t.get(R);Y.color.copy(I).multiplyScalar(k),Y.halfWidth.set(R.width*0.5,0,0),Y.halfHeight.set(0,R.height*0.5,0),i.rectArea[S]=Y,S++}else if(R.isPointLight){let Y=t.get(R);if(Y.color.copy(R.color).multiplyScalar(R.intensity),Y.distance=R.distance,Y.decay=R.decay,R.castShadow){let Q=R.shadow,G=n.get(R);G.shadowIntensity=Q.intensity,G.shadowBias=Q.bias,G.shadowNormalBias=Q.normalBias,G.shadowRadius=Q.radius,G.shadowMapSize=Q.mapSize,G.shadowCameraNear=Q.camera.near,G.shadowCameraFar=Q.camera.far,i.pointShadow[d]=G,i.pointShadowMap[d]=te,i.pointShadowMatrix[d]=R.shadow.matrix,w++}i.point[d]=Y,d++}else if(R.isHemisphereLight){let Y=t.get(R);Y.skyColor.copy(R.color).multiplyScalar(k),Y.groundColor.copy(R.groundColor).multiplyScalar(k),i.hemi[_]=Y,_++}}if(S>0)if(e.has("OES_texture_float_linear")===!0)i.rectAreaLTC1=pe.LTC_FLOAT_1,i.rectAreaLTC2=pe.LTC_FLOAT_2;else i.rectAreaLTC1=pe.LTC_HALF_1,i.rectAreaLTC2=pe.LTC_HALF_2;i.ambient[0]=h,i.ambient[1]=f,i.ambient[2]=u;let P=i.hash;if(P.sunLength!==p||P.directionalLength!==m||P.pointLength!==d||P.spotLength!==b||P.rectAreaLength!==S||P.hemiLength!==_||P.numSunShadows!==g||P.numDirectionalShadows!==x||P.numPointShadows!==w||P.numSpotShadows!==T||P.numSpotMaps!==v||P.numLightProbes!==N)i.sun.length=p,i.directional.length=m,i.spot.length=b,i.rectArea.length=S,i.point.length=d,i.hemi.length=_,i.sunShadow.length=g,i.sunShadowMap.length=g,i.sunShadowMatrix.length=y,i.sunShadowCascade.length=y,i.directionalShadow.length=x,i.directionalShadowMap.length=x,i.directionalShadowMatrix.length=x,i.pointShadow.length=w,i.pointShadowMap.length=w,i.pointShadowMatrix.length=w,i.spotShadow.length=T,i.spotShadowMap.length=T,i.spotLightMatrix.length=T+v-A,i.spotLightMap.length=v,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=N,P.sunLength=p,P.directionalLength=m,P.pointLength=d,P.spotLength=b,P.rectAreaLength=S,P.hemiLength=_,P.numSunShadows=g,P.numDirectionalShadows=x,P.numPointShadows=w,P.numSpotShadows=T,P.numSpotMaps=v,P.numLightProbes=N,i.version=OM++}function l(c,h){let f=0,u=0,p=0,g=0,y=0,m=0,d=h.matrixWorldInverse;for(let b=0,S=c.length;b<S;b++){let _=c[b];if(_.isSunLight){let x=i.sun[f];x.direction.setFromMatrixPosition(_.matrixWorld),x.direction.transformDirection(d),f++}else if(_.isDirectionalLight){let x=i.directional[u];x.direction.setFromMatrixPosition(_.matrixWorld),r.setFromMatrixPosition(_.target.matrixWorld),x.direction.sub(r),x.direction.transformDirection(d),u++}else if(_.isSpotLight){let x=i.spot[g];x.position.setFromMatrixPosition(_.matrixWorld),x.position.applyMatrix4(d),x.direction.setFromMatrixPosition(_.matrixWorld),r.setFromMatrixPosition(_.target.matrixWorld),x.direction.sub(r),x.direction.transformDirection(d),g++}else if(_.isRectAreaLight){let x=i.rectArea[y];x.position.setFromMatrixPosition(_.matrixWorld),x.position.applyMatrix4(d),o.identity(),s.copy(_.matrixWorld),s.premultiply(d),o.extractRotation(s),x.halfWidth.set(_.width*0.5,0,0),x.halfHeight.set(0,_.height*0.5,0),x.halfWidth.applyMatrix4(o),x.halfHeight.applyMatrix4(o),y++}else if(_.isPointLight){let x=i.point[p];x.position.setFromMatrixPosition(_.matrixWorld),x.position.applyMatrix4(d),p++}else if(_.isHemisphereLight){let x=i.hemi[m];x.direction.setFromMatrixPosition(_.matrixWorld),x.direction.transformDirection(d),m++}}}return{setup:a,setupView:l,state:i}}function Vm(e){let t=new FM(e),n=[],i=[],r=[];function s(u){f.camera=u,n.length=0,i.length=0,r.length=0}function o(u){n.push(u)}function a(u){i.push(u)}function l(u){r.push(u)}function c(){t.setup(n)}function h(u){t.setupView(n,u)}let f={lightsArray:n,shadowsArray:i,lightProbeGridArray:r,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:f,setupLights:c,setupLightsView:h,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function BM(e){let t=new WeakMap;function n(r,s=0){let o=t.get(r),a;if(o===void 0)a=new Vm(e),t.set(r,[a]);else if(s>=o.length)a=new Vm(e),o.push(a);else a=o[s];return a}function i(){t=new WeakMap}return{get:n,dispose:i}}var kM=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,zM=`uniform sampler2D shadow_pass;
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
}`,GM=[new L(1,0,0),new L(-1,0,0),new L(0,1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1)],HM=[new L(0,-1,0),new L(0,-1,0),new L(0,0,1),new L(0,0,-1),new L(0,-1,0),new L(0,-1,0)],Wm=new Ke,Is=new L,Ph=new L;function VM(e,t,n){let i=new Ss,r=new se,s=new se,o=new gt,a=new oh,l=new ah,c={},h=n.maxTextureSize,f={[Cr]:Vt,[Vt]:Cr,[Fn]:Fn},u=new Jt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new se},radius:{value:4}},vertexShader:kM,fragmentShader:zM}),p=u.clone();p.defines.HORIZONTAL_PASS=1;let g=new Rt;g.setAttribute("position",new sn(new Float32Array([-1,-1,0.5,3,-1,0.5,-1,3,0.5]),3));let y=new Bt(g,u),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=ds;let d=this.type;this.render=function(w,T,v){if(m.enabled===!1)return;if(m.autoUpdate===!1&&m.needsUpdate===!1)return;if(w.length===0)return;if(this.type===xp)Ie("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=ds;let A=e.getRenderTarget(),N=e.getActiveCubeFace(),P=e.getActiveMipmapLevel(),D=e.state;if(D.setBlending(xn),D.buffers.depth.getReversed()===!0)D.buffers.color.setClear(0,0,0,0);else D.buffers.color.setClear(1,1,1,1);D.buffers.depth.setTest(!0),D.setScissorTest(!1);let W=d!==this.type;if(W)T.traverse(function(R){if(R.material)if(Array.isArray(R.material))R.material.forEach((I)=>I.needsUpdate=!0);else R.material.needsUpdate=!0});for(let R=0,I=w.length;R<I;R++){let k=w[R],z=k.shadow;if(z===void 0){Ie("WebGLShadowMap:",k,"has no shadow.");continue}if(z.autoUpdate===!1&&z.needsUpdate===!1)continue;r.copy(z.mapSize);let te=z.getFrameExtents();if(r.multiply(te),s.copy(z.mapSize),r.x>h||r.y>h){if(r.x>h)s.x=Math.floor(h/te.x),r.x=s.x*te.x,z.mapSize.x=s.x;if(r.y>h)s.y=Math.floor(h/te.y),r.y=s.y*te.y,z.mapSize.y=s.y}let Y=e.state.buffers.depth.getReversed();if(z.camera._reversedDepth=Y,z.map===null||W===!0){if(z.map!==null){if(z.map.depthTexture!==null)z.map.depthTexture.dispose(),z.map.depthTexture=null;z.map.dispose()}if(this.type===Ar){if(k.isPointLight){Ie("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}z.map=new Zt(r.x,r.y,{format:Gi,type:bn,minFilter:on,magFilter:on,generateMipmaps:!1}),z.map.texture.name=k.name+".shadowMap",z.map.depthTexture=new Wi(r.x,r.y,ni),z.map.depthTexture.name=k.name+".shadowMapDepth",z.map.depthTexture.format=ki,z.map.depthTexture.compareFunction=null,z.map.depthTexture.minFilter=gi,z.map.depthTexture.magFilter=gi}else{if(k.isPointLight)z.map=new Nh(r.x),z.map.depthTexture=new $c(r.x,_i);else z.map=new Zt(r.x,r.y),z.map.depthTexture=new Wi(r.x,r.y,_i);if(z.map.depthTexture.name=k.name+".shadowMap",z.map.depthTexture.format=ki,this.type===ds)z.map.depthTexture.compareFunction=Y?Zo:$o,z.map.depthTexture.minFilter=on,z.map.depthTexture.magFilter=on;else z.map.depthTexture.compareFunction=null,z.map.depthTexture.minFilter=gi,z.map.depthTexture.magFilter=gi}z.camera.updateProjectionMatrix()}if(z.map.isWebGLCubeRenderTarget!==!0&&(z.map.width!==r.x||z.map.height!==r.y))z.map.setSize(r.x,r.y);let Q=z.map.isWebGLCubeRenderTarget?6:z.getViewportCount();if(k.isPointLight!==!0)z.updateMatrices(k,v);for(let G=0;G<Q;G++){let ee=z.getCamera(G);if(k.isPointLight){let{camera:oe,matrix:Ue}=z,Re=k.distance||oe.far;if(Re!==oe.far)oe.far=Re,oe.updateProjectionMatrix();Is.setFromMatrixPosition(k.matrixWorld),oe.position.copy(Is),Ph.copy(oe.position),Ph.add(GM[G]),oe.up.copy(HM[G]),oe.lookAt(Ph),oe.updateMatrixWorld(),Ue.makeTranslation(-Is.x,-Is.y,-Is.z),Wm.multiplyMatrices(oe.projectionMatrix,oe.matrixWorldInverse),z._frustum.setFromProjectionMatrix(Wm,oe.coordinateSystem,oe.reversedDepth)}if(z.map.isWebGLCubeRenderTarget)e.setRenderTarget(z.map,G),e.clear();else{if(G===0)e.setRenderTarget(z.map),e.clear();let oe=z.getViewport(G);o.set(s.x*oe.x,s.y*oe.y,s.x*oe.z,s.y*oe.w),D.viewport(o)}i=z.getFrustum(G),_(T,v,ee,k,this.type)}if(z.isPointLightShadow!==!0&&this.type===Ar)b(z,v);z.needsUpdate=!1}d=this.type,m.needsUpdate=!1,e.setRenderTarget(A,N,P)};function b(w,T){let v=t.update(y);if(u.defines.VSM_SAMPLES!==w.blurSamples)u.defines.VSM_SAMPLES=w.blurSamples,p.defines.VSM_SAMPLES=w.blurSamples,u.needsUpdate=!0,p.needsUpdate=!0;if(w.mapPass===null)w.mapPass=new Zt(r.x,r.y,{format:Gi,type:bn});else if(w.mapPass.width!==w.map.width||w.mapPass.height!==w.map.height)w.mapPass.setSize(w.map.width,w.map.height);u.uniforms.shadow_pass.value=w.map.depthTexture,u.uniforms.resolution.value.set(w.map.width,w.map.height),u.uniforms.radius.value=w.radius,e.setRenderTarget(w.mapPass),e.clear(),e.renderBufferDirect(T,null,v,u,y,null),p.uniforms.shadow_pass.value=w.mapPass.texture,p.uniforms.resolution.value.set(w.map.width,w.map.height),p.uniforms.radius.value=w.radius,e.setRenderTarget(w.map),e.clear(),e.renderBufferDirect(T,null,v,p,y,null)}function S(w,T,v,A){let N=null,P=v.isPointLight===!0?w.customDistanceMaterial:w.customDepthMaterial;if(P!==void 0)N=P;else if(N=v.isPointLight===!0?l:a,e.localClippingEnabled&&T.clipShadows===!0&&Array.isArray(T.clippingPlanes)&&T.clippingPlanes.length!==0||T.displacementMap&&T.displacementScale!==0||T.alphaMap&&T.alphaTest>0||T.map&&T.alphaTest>0||T.alphaToCoverage===!0){let D=N.uuid,W=T.uuid,R=c[D];if(R===void 0)R={},c[D]=R;let I=R[W];if(I===void 0)I=N.clone(),R[W]=I,T.addEventListener("dispose",x);N=I}if(N.visible=T.visible,N.wireframe=T.wireframe,A===Ar)N.side=T.shadowSide!==null?T.shadowSide:T.side;else N.side=T.shadowSide!==null?T.shadowSide:f[T.side];if(N.alphaMap=T.alphaMap,N.alphaTest=T.alphaToCoverage===!0?0.5:T.alphaTest,N.map=T.map,N.clipShadows=T.clipShadows,N.clippingPlanes=T.clippingPlanes,N.clipIntersection=T.clipIntersection,N.displacementMap=T.displacementMap,N.displacementScale=T.displacementScale,N.displacementBias=T.displacementBias,N.wireframeLinewidth=T.wireframeLinewidth,N.linewidth=T.linewidth,v.isPointLight===!0&&N.isMeshDistanceMaterial===!0){let D=e.properties.get(N);D.light=v}return N}function _(w,T,v,A,N){if(w.visible===!1)return;if(w.layers.test(T.layers)&&(w.isMesh||w.isLine||w.isPoints)){if((w.castShadow||w.receiveShadow&&N===Ar)&&(!w.frustumCulled||w.intersectsFrustum(i))){w.modelViewMatrix.multiplyMatrices(v.matrixWorldInverse,w.matrixWorld);let W=t.update(w),R=w.material;if(Array.isArray(R)){let I=W.groups;for(let k=0,z=I.length;k<z;k++){let te=I[k],Y=R[te.materialIndex];if(Y&&Y.visible){let Q=S(w,Y,A,N);w.onBeforeShadow(e,w,T,v,W,Q,te),e.renderBufferDirect(v,null,W,Q,w,te),w.onAfterShadow(e,w,T,v,W,Q,te)}}}else if(R.visible){let I=S(w,R,A,N);w.onBeforeShadow(e,w,T,v,W,I,null),e.renderBufferDirect(v,null,W,I,w,null),w.onAfterShadow(e,w,T,v,W,I,null)}}}let D=w.children;for(let W=0,R=D.length;W<R;W++)_(D[W],T,v,A,N)}function x(w){w.target.removeEventListener("dispose",x);for(let v in c){let A=c[v],N=w.target.uuid;if(N in A)A[N].dispose(),delete A[N]}}}function WM(e,t){function n(){let B=!1,he=new gt,J=null,ue=new gt(0,0,0,0);return{setMask:function(ye){if(J!==ye&&!B)e.colorMask(ye,ye,ye,ye),J=ye},setLocked:function(ye){B=ye},setClear:function(ye,ne,me,Be,ut){if(ut===!0)ye*=Be,ne*=Be,me*=Be;if(he.set(ye,ne,me,Be),ue.equals(he)===!1)e.clearColor(ye,ne,me,Be),ue.copy(he)},reset:function(){B=!1,J=null,ue.set(-1,0,0,0)}}}function i(){let B=!1,he=!1,J=null,ue=null,ye=null;return{setReversed:function(ne){if(he!==ne){let me=t.get("EXT_clip_control");if(ne)me.clipControlEXT(me.LOWER_LEFT_EXT,me.ZERO_TO_ONE_EXT);else me.clipControlEXT(me.LOWER_LEFT_EXT,me.NEGATIVE_ONE_TO_ONE_EXT);he=ne;let Be=ye;ye=null,this.setClear(Be)}},getReversed:function(){return he},setTest:function(ne){if(ne)le(e.DEPTH_TEST);else Pe(e.DEPTH_TEST)},setMask:function(ne){if(J!==ne&&!B)e.depthMask(ne),J=ne},setFunc:function(ne){if(he)ne=_m[ne];if(ue!==ne){switch(ne){case Gp:e.depthFunc(e.NEVER);break;case Hp:e.depthFunc(e.ALWAYS);break;case Vp:e.depthFunc(e.LESS);break;case Yl:e.depthFunc(e.LEQUAL);break;case Wp:e.depthFunc(e.EQUAL);break;case Xp:e.depthFunc(e.GEQUAL);break;case qp:e.depthFunc(e.GREATER);break;case jp:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}ue=ne}},setLocked:function(ne){B=ne},setClear:function(ne){if(ye!==ne){if(ye=ne,he)ne=1-ne;e.clearDepth(ne)}},reset:function(){B=!1,J=null,ue=null,ye=null,he=!1}}}function r(){let B=!1,he=null,J=null,ue=null,ye=null,ne=null,me=null,Be=null,ut=null;return{setTest:function(nt){if(!B)if(nt)le(e.STENCIL_TEST);else Pe(e.STENCIL_TEST)},setMask:function(nt){if(he!==nt&&!B)e.stencilMask(nt),he=nt},setFunc:function(nt,Nn,qn){if(J!==nt||ue!==Nn||ye!==qn)e.stencilFunc(nt,Nn,qn),J=nt,ue=Nn,ye=qn},setOp:function(nt,Nn,qn){if(ne!==nt||me!==Nn||Be!==qn)e.stencilOp(nt,Nn,qn),ne=nt,me=Nn,Be=qn},setLocked:function(nt){B=nt},setClear:function(nt){if(ut!==nt)e.clearStencil(nt),ut=nt},reset:function(){B=!1,he=null,J=null,ue=null,ye=null,ne=null,me=null,Be=null,ut=null}}}let s=new n,o=new i,a=new r,l=new WeakMap,c=new WeakMap,h={},f={},u={},p=new WeakMap,g=[],y=null,m=!1,d=null,b=null,S=null,_=null,x=null,w=null,T=null,v=new ke(0,0,0),A=0,N=!1,P=null,D=null,W=null,R=null,I=null,k=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),z=!1,te=0,Y=e.getParameter(e.VERSION);if(Y.indexOf("WebGL")!==-1)te=parseFloat(/^WebGL (\d)/.exec(Y)[1]),z=te>=1;else if(Y.indexOf("OpenGL ES")!==-1)te=parseFloat(/^OpenGL ES (\d)/.exec(Y)[1]),z=te>=2;let Q=null,G={},ee=e.getParameter(e.SCISSOR_BOX),oe=e.getParameter(e.VIEWPORT),Ue=new gt().fromArray(ee),Re=new gt().fromArray(oe);function X(B,he,J,ue){let ye=new Uint8Array(4),ne=e.createTexture();e.bindTexture(B,ne),e.texParameteri(B,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(B,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let me=0;me<J;me++)if(B===e.TEXTURE_3D||B===e.TEXTURE_2D_ARRAY)e.texImage3D(he,0,e.RGBA,1,1,ue,0,e.RGBA,e.UNSIGNED_BYTE,ye);else e.texImage2D(he+me,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,ye);return ne}let re={};re[e.TEXTURE_2D]=X(e.TEXTURE_2D,e.TEXTURE_2D,1),re[e.TEXTURE_CUBE_MAP]=X(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),re[e.TEXTURE_2D_ARRAY]=X(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),re[e.TEXTURE_3D]=X(e.TEXTURE_3D,e.TEXTURE_3D,1,1),s.setClear(0,0,0,1),o.setClear(1),a.setClear(0),le(e.DEPTH_TEST),o.setFunc(Yl),Ut(!1),dt(Wl),le(e.CULL_FACE),rt(xn);function le(B){if(h[B]!==!0)e.enable(B),h[B]=!0}function Pe(B){if(h[B]!==!1)e.disable(B),h[B]=!1}function Oe(B,he){if(u[B]!==he){if(e.bindFramebuffer(B,he),u[B]=he,B===e.DRAW_FRAMEBUFFER)u[e.FRAMEBUFFER]=he;if(B===e.FRAMEBUFFER)u[e.DRAW_FRAMEBUFFER]=he;return!0}return!1}function Ae(B,he){let J=g,ue=!1;if(B){if(J=p.get(he),J===void 0)J=[],p.set(he,J);let ye=B.textures;if(J.length!==ye.length||J[0]!==e.COLOR_ATTACHMENT0){for(let ne=0,me=ye.length;ne<me;ne++)J[ne]=e.COLOR_ATTACHMENT0+ne;J.length=ye.length,ue=!0}}else if(J[0]!==e.BACK)J[0]=e.BACK,ue=!0;if(ue)e.drawBuffers(J)}function Et(B){if(y!==B)return e.useProgram(B),y=B,!0;return!1}let Xe={[Rr]:e.FUNC_ADD,[Sp]:e.FUNC_SUBTRACT,[Mp]:e.FUNC_REVERSE_SUBTRACT};Xe[wp]=e.MIN,Xe[Ep]=e.MAX;let je={[Tp]:e.ZERO,[Ap]:e.ONE,[Cp]:e.SRC_COLOR,[Pp]:e.SRC_ALPHA,[Up]:e.SRC_ALPHA_SATURATE,[Np]:e.DST_COLOR,[Lp]:e.DST_ALPHA,[Rp]:e.ONE_MINUS_SRC_COLOR,[Ip]:e.ONE_MINUS_SRC_ALPHA,[Op]:e.ONE_MINUS_DST_COLOR,[Dp]:e.ONE_MINUS_DST_ALPHA,[Fp]:e.CONSTANT_COLOR,[Bp]:e.ONE_MINUS_CONSTANT_COLOR,[kp]:e.CONSTANT_ALPHA,[zp]:e.ONE_MINUS_CONSTANT_ALPHA};function rt(B,he,J,ue,ye,ne,me,Be,ut,nt){if(B===xn){if(m===!0)Pe(e.BLEND),m=!1;return}if(m===!1)le(e.BLEND),m=!0;if(B!==bp){if(B!==d||nt!==N){if(b!==Rr||x!==Rr)e.blendEquation(e.FUNC_ADD),b=Rr,x=Rr;if(nt)switch(B){case ps:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Xl:e.blendFunc(e.ONE,e.ONE);break;case ql:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case jl:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:De("WebGLState: Invalid blending: ",B);break}else switch(B){case ps:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Xl:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case ql:De("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case jl:De("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:De("WebGLState: Invalid blending: ",B);break}S=null,_=null,w=null,T=null,v.set(0,0,0),A=0,d=B,N=nt}return}if(ye=ye||he,ne=ne||J,me=me||ue,he!==b||ye!==x)e.blendEquationSeparate(Xe[he],Xe[ye]),b=he,x=ye;if(J!==S||ue!==_||ne!==w||me!==T)e.blendFuncSeparate(je[J],je[ue],je[ne],je[me]),S=J,_=ue,w=ne,T=me;if(Be.equals(v)===!1||ut!==A)e.blendColor(Be.r,Be.g,Be.b,ut),v.copy(Be),A=ut;d=B,N=!1}function Ye(B,he){B.side===Fn?Pe(e.CULL_FACE):le(e.CULL_FACE);let J=B.side===Vt;if(he)J=!J;Ut(J),B.blending===ps&&B.transparent===!1?rt(xn):rt(B.blending,B.blendEquation,B.blendSrc,B.blendDst,B.blendEquationAlpha,B.blendSrcAlpha,B.blendDstAlpha,B.blendColor,B.blendAlpha,B.premultipliedAlpha),o.setFunc(B.depthFunc),o.setTest(B.depthTest),o.setMask(B.depthWrite),s.setMask(B.colorWrite);let ue=B.stencilWrite;if(a.setTest(ue),ue)a.setMask(B.stencilWriteMask),a.setFunc(B.stencilFunc,B.stencilRef,B.stencilFuncMask),a.setOp(B.stencilFail,B.stencilZFail,B.stencilZPass);Tt(B.polygonOffset,B.polygonOffsetFactor,B.polygonOffsetUnits),B.alphaToCoverage===!0?le(e.SAMPLE_ALPHA_TO_COVERAGE):Pe(e.SAMPLE_ALPHA_TO_COVERAGE)}function Ut(B){if(P!==B){if(B)e.frontFace(e.CW);else e.frontFace(e.CCW);P=B}}function dt(B){if(B!==vp){if(le(e.CULL_FACE),B!==D)if(B===Wl)e.cullFace(e.BACK);else if(B===yp)e.cullFace(e.FRONT);else e.cullFace(e.FRONT_AND_BACK)}else Pe(e.CULL_FACE);D=B}function en(B){if(B!==W){if(z)e.lineWidth(B);W=B}}function Tt(B,he,J){if(B){if(le(e.POLYGON_OFFSET_FILL),R!==he||I!==J){if(R=he,I=J,o.getReversed())he=-he;e.polygonOffset(he,J)}}else Pe(e.POLYGON_OFFSET_FILL)}function At(B){if(B)le(e.SCISSOR_TEST);else Pe(e.SCISSOR_TEST)}function U(B){if(B===void 0)B=e.TEXTURE0+k-1;if(Q!==B)e.activeTexture(B),Q=B}function tn(B,he,J){if(J===void 0)if(Q===null)J=e.TEXTURE0+k-1;else J=Q;let ue=G[J];if(ue===void 0)ue={type:void 0,texture:void 0},G[J]=ue;if(ue.type!==B||ue.texture!==he){if(Q!==J)e.activeTexture(J),Q=J;e.bindTexture(B,he||re[B]),ue.type=B,ue.texture=he}}function tt(){let B=G[Q];if(B!==void 0&&B.type!==void 0)e.bindTexture(B.type,null),B.type=void 0,B.texture=void 0}function yt(){try{e.compressedTexImage2D(...arguments)}catch(B){De("WebGLState:",B)}}function C(){try{e.compressedTexImage3D(...arguments)}catch(B){De("WebGLState:",B)}}function M(){try{e.texSubImage2D(...arguments)}catch(B){De("WebGLState:",B)}}function O(){try{e.texSubImage3D(...arguments)}catch(B){De("WebGLState:",B)}}function q(){try{e.compressedTexSubImage2D(...arguments)}catch(B){De("WebGLState:",B)}}function ie(){try{e.compressedTexSubImage3D(...arguments)}catch(B){De("WebGLState:",B)}}function ce(){try{e.texStorage2D(...arguments)}catch(B){De("WebGLState:",B)}}function fe(){try{e.texStorage3D(...arguments)}catch(B){De("WebGLState:",B)}}function Z(){try{e.texImage2D(...arguments)}catch(B){De("WebGLState:",B)}}function K(){try{e.texImage3D(...arguments)}catch(B){De("WebGLState:",B)}}function ve(B){if(f[B]!==void 0)return f[B];else return e.getParameter(B)}function Te(B,he){if(f[B]!==he)e.pixelStorei(B,he),f[B]=he}function de(B){if(Ue.equals(B)===!1)e.scissor(B.x,B.y,B.z,B.w),Ue.copy(B)}function ae(B){if(Re.equals(B)===!1)e.viewport(B.x,B.y,B.z,B.w),Re.copy(B)}function Ce(B,he){let J=c.get(he);if(J===void 0)J=new WeakMap,c.set(he,J);let ue=J.get(B);if(ue===void 0)ue=e.getUniformBlockIndex(he,B.name),J.set(B,ue)}function Le(B,he){let ue=c.get(he).get(B);if(l.get(he)!==ue)e.uniformBlockBinding(he,ue,B.__bindingPointIndex),l.set(he,ue)}function Je(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),h={},f={},Q=null,G={},u={},p=new WeakMap,g=[],y=null,m=!1,d=null,b=null,S=null,_=null,x=null,w=null,T=null,v=new ke(0,0,0),A=0,N=!1,P=null,D=null,W=null,R=null,I=null,Ue.set(0,0,e.canvas.width,e.canvas.height),Re.set(0,0,e.canvas.width,e.canvas.height),s.reset(),o.reset(),a.reset()}return{buffers:{color:s,depth:o,stencil:a},enable:le,disable:Pe,bindFramebuffer:Oe,drawBuffers:Ae,useProgram:Et,setBlending:rt,setMaterial:Ye,setFlipSided:Ut,setCullFace:dt,setLineWidth:en,setPolygonOffset:Tt,setScissorTest:At,activeTexture:U,bindTexture:tn,unbindTexture:tt,compressedTexImage2D:yt,compressedTexImage3D:C,texImage2D:Z,texImage3D:K,pixelStorei:Te,getParameter:ve,updateUBOMapping:Ce,uniformBlockBinding:Le,texStorage2D:ce,texStorage3D:fe,texSubImage2D:M,texSubImage3D:O,compressedTexSubImage2D:q,compressedTexSubImage3D:ie,scissor:de,viewport:ae,reset:Je}}function XM(e,t,n,i,r,s,o){let a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new se,h=new WeakMap,f=new Set,u,p=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch(C){}function y(C,M){return g?new OffscreenCanvas(C,M):wr("canvas")}function m(C,M,O){let q=1,ie=yt(C);if(ie.width>O||ie.height>O)q=O/Math.max(ie.width,ie.height);if(q<1)if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&C instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&C instanceof ImageBitmap||typeof VideoFrame<"u"&&C instanceof VideoFrame){let ce=Math.floor(q*ie.width),fe=Math.floor(q*ie.height);if(u===void 0)u=y(ce,fe);let Z=M?y(ce,fe):u;return Z.width=ce,Z.height=fe,Z.getContext("2d").drawImage(C,0,0,ce,fe),Ie("WebGLRenderer: Texture has been resized from ("+ie.width+"x"+ie.height+") to ("+ce+"x"+fe+")."),Z}else{if("data"in C)Ie("WebGLRenderer: Image in DataTexture is too big ("+ie.width+"x"+ie.height+").");return C}return C}function d(C){return C.generateMipmaps}function b(C){e.generateMipmap(C)}function S(C){if(C.isWebGLCubeRenderTarget)return e.TEXTURE_CUBE_MAP;if(C.isWebGL3DRenderTarget)return e.TEXTURE_3D;if(C.isWebGLArrayRenderTarget||C.isCompressedArrayTexture)return e.TEXTURE_2D_ARRAY;return e.TEXTURE_2D}function _(C,M,O,q,ie,ce=!1){if(C!==null){if(e[C]!==void 0)return e[C];Ie("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+C+"'")}let fe;if(q){if(fe=t.get("EXT_texture_norm16"),!fe)Ie("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension")}let Z=M;if(M===e.RED){if(O===e.FLOAT)Z=e.R32F;if(O===e.HALF_FLOAT)Z=e.R16F;if(O===e.UNSIGNED_BYTE)Z=e.R8;if(O===e.UNSIGNED_SHORT&&fe)Z=fe.R16_EXT;if(O===e.SHORT&&fe)Z=fe.R16_SNORM_EXT}if(M===e.RED_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.R8UI;if(O===e.UNSIGNED_SHORT)Z=e.R16UI;if(O===e.UNSIGNED_INT)Z=e.R32UI;if(O===e.BYTE)Z=e.R8I;if(O===e.SHORT)Z=e.R16I;if(O===e.INT)Z=e.R32I}if(M===e.RG){if(O===e.FLOAT)Z=e.RG32F;if(O===e.HALF_FLOAT)Z=e.RG16F;if(O===e.UNSIGNED_BYTE)Z=e.RG8;if(O===e.UNSIGNED_SHORT&&fe)Z=fe.RG16_EXT;if(O===e.SHORT&&fe)Z=fe.RG16_SNORM_EXT}if(M===e.RG_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.RG8UI;if(O===e.UNSIGNED_SHORT)Z=e.RG16UI;if(O===e.UNSIGNED_INT)Z=e.RG32UI;if(O===e.BYTE)Z=e.RG8I;if(O===e.SHORT)Z=e.RG16I;if(O===e.INT)Z=e.RG32I}if(M===e.RGB_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.RGB8UI;if(O===e.UNSIGNED_SHORT)Z=e.RGB16UI;if(O===e.UNSIGNED_INT)Z=e.RGB32UI;if(O===e.BYTE)Z=e.RGB8I;if(O===e.SHORT)Z=e.RGB16I;if(O===e.INT)Z=e.RGB32I}if(M===e.RGBA_INTEGER){if(O===e.UNSIGNED_BYTE)Z=e.RGBA8UI;if(O===e.UNSIGNED_SHORT)Z=e.RGBA16UI;if(O===e.UNSIGNED_INT)Z=e.RGBA32UI;if(O===e.BYTE)Z=e.RGBA8I;if(O===e.SHORT)Z=e.RGBA16I;if(O===e.INT)Z=e.RGBA32I}if(M===e.RGB){if(O===e.UNSIGNED_SHORT&&fe)Z=fe.RGB16_EXT;if(O===e.SHORT&&fe)Z=fe.RGB16_SNORM_EXT;if(O===e.UNSIGNED_INT_5_9_9_9_REV)Z=e.RGB9_E5;if(O===e.UNSIGNED_INT_10F_11F_11F_REV)Z=e.R11F_G11F_B10F}if(M===e.RGBA){let K=ce?zc:qe.getTransfer(ie);if(O===e.FLOAT)Z=e.RGBA32F;if(O===e.HALF_FLOAT)Z=e.RGBA16F;if(O===e.UNSIGNED_BYTE)Z=K===ht?e.SRGB8_ALPHA8:e.RGBA8;if(O===e.UNSIGNED_SHORT&&fe)Z=fe.RGBA16_EXT;if(O===e.SHORT&&fe)Z=fe.RGBA16_SNORM_EXT;if(O===e.UNSIGNED_SHORT_4_4_4_4)Z=e.RGBA4;if(O===e.UNSIGNED_SHORT_5_5_5_1)Z=e.RGB5_A1}if(Z===e.R16F||Z===e.R32F||Z===e.RG16F||Z===e.RG32F||Z===e.RGBA16F||Z===e.RGBA32F)t.get("EXT_color_buffer_float");return Z}function x(C,M){let O;if(C){if(M===null||M===_i||M===Ir)O=e.DEPTH24_STENCIL8;else if(M===ni)O=e.DEPTH32F_STENCIL8;else if(M===_s)O=e.DEPTH24_STENCIL8,Ie("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")}else if(M===null||M===_i||M===Ir)O=e.DEPTH_COMPONENT24;else if(M===ni)O=e.DEPTH_COMPONENT32F;else if(M===_s)O=e.DEPTH_COMPONENT16;return O}function w(C,M){if(d(C)===!0||C.isFramebufferTexture&&C.minFilter!==gi&&C.minFilter!==on)return Math.log2(Math.max(M.width,M.height))+1;else if(C.mipmaps!==void 0&&C.mipmaps.length>0)return C.mipmaps.length;else if(C.isCompressedTexture&&Array.isArray(C.image))return M.mipmaps.length;else return 1}function T(C){let M=C.target;if(M.removeEventListener("dispose",T),A(M),M.isVideoTexture)h.delete(M);if(M.isHTMLTexture)f.delete(M)}function v(C){let M=C.target;M.removeEventListener("dispose",v),P(M)}function A(C){let M=i.get(C);if(M.__webglInit===void 0)return;let O=C.source,q=p.get(O);if(q){let ie=q[M.__cacheKey];if(ie.usedTimes--,ie.usedTimes===0)N(C);if(Object.keys(q).length===0)p.delete(O)}i.remove(C)}function N(C){let M=i.get(C);e.deleteTexture(M.__webglTexture);let O=C.source,q=p.get(O);delete q[M.__cacheKey],o.memory.textures--}function P(C){let M=i.get(C);if(C.depthTexture)C.depthTexture.dispose(),i.remove(C.depthTexture);if(C.isWebGLCubeRenderTarget)for(let q=0;q<6;q++){if(Array.isArray(M.__webglFramebuffer[q]))for(let ie=0;ie<M.__webglFramebuffer[q].length;ie++)e.deleteFramebuffer(M.__webglFramebuffer[q][ie]);else e.deleteFramebuffer(M.__webglFramebuffer[q]);if(M.__webglDepthbuffer)e.deleteRenderbuffer(M.__webglDepthbuffer[q])}else{if(Array.isArray(M.__webglFramebuffer))for(let q=0;q<M.__webglFramebuffer.length;q++)e.deleteFramebuffer(M.__webglFramebuffer[q]);else e.deleteFramebuffer(M.__webglFramebuffer);if(M.__webglDepthbuffer)e.deleteRenderbuffer(M.__webglDepthbuffer);if(M.__webglMultisampledFramebuffer)e.deleteFramebuffer(M.__webglMultisampledFramebuffer);if(M.__webglColorRenderbuffer){for(let q=0;q<M.__webglColorRenderbuffer.length;q++)if(M.__webglColorRenderbuffer[q])e.deleteRenderbuffer(M.__webglColorRenderbuffer[q])}if(M.__webglDepthRenderbuffer)e.deleteRenderbuffer(M.__webglDepthRenderbuffer)}let O=C.textures;for(let q=0,ie=O.length;q<ie;q++){let ce=i.get(O[q]);if(ce.__webglTexture)e.deleteTexture(ce.__webglTexture),o.memory.textures--;i.remove(O[q])}i.remove(C)}let D=0;function W(){D=0}function R(){return D}function I(C){D=C}function k(){let C=D;if(C>=r.maxTextures)Ie("WebGLTextures: Trying to use "+(C+1)+" texture units while this GPU supports only "+r.maxTextures);return D+=1,C}function z(C){let M=[];return M.push(C.wrapS),M.push(C.wrapT),M.push(C.wrapR||0),M.push(C.magFilter),M.push(C.minFilter),M.push(C.anisotropy),M.push(C.internalFormat),M.push(C.format),M.push(C.type),M.push(C.generateMipmaps),M.push(C.premultiplyAlpha),M.push(C.flipY),M.push(C.unpackAlignment),M.push(C.colorSpace),M.join()}function te(C,M){let O=i.get(C);if(C.isVideoTexture)tn(C);if(C.isRenderTargetTexture===!1&&C.isExternalTexture!==!0&&C.version>0&&O.__version!==C.version){let q=C.image;if(q===null)Ie("WebGLRenderer: Texture marked for update but no image data found.");else if(q.complete===!1)Ie("WebGLRenderer: Texture marked for update but image is incomplete");else{Pe(O,C,M);return}}else if(C.isExternalTexture)O.__webglTexture=C.sourceTexture?C.sourceTexture:null;n.bindTexture(e.TEXTURE_2D,O.__webglTexture,e.TEXTURE0+M)}function Y(C,M){let O=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&O.__version!==C.version){Pe(O,C,M);return}else if(C.isExternalTexture)O.__webglTexture=C.sourceTexture?C.sourceTexture:null;n.bindTexture(e.TEXTURE_2D_ARRAY,O.__webglTexture,e.TEXTURE0+M)}function Q(C,M){let O=i.get(C);if(C.isRenderTargetTexture===!1&&C.version>0&&O.__version!==C.version){Pe(O,C,M);return}n.bindTexture(e.TEXTURE_3D,O.__webglTexture,e.TEXTURE0+M)}function G(C,M){let O=i.get(C);if(C.isCubeDepthTexture!==!0&&C.version>0&&O.__version!==C.version){Oe(O,C,M);return}n.bindTexture(e.TEXTURE_CUBE_MAP,O.__webglTexture,e.TEXTURE0+M)}let ee={[Jp]:e.REPEAT,[Go]:e.CLAMP_TO_EDGE,[Kp]:e.MIRRORED_REPEAT},oe={[gi]:e.NEAREST,[Qp]:e.NEAREST_MIPMAP_NEAREST,[gs]:e.NEAREST_MIPMAP_LINEAR,[on]:e.LINEAR,[Ho]:e.LINEAR_MIPMAP_NEAREST,[Bi]:e.LINEAR_MIPMAP_LINEAR},Ue={[lm]:e.NEVER,[dm]:e.ALWAYS,[cm]:e.LESS,[$o]:e.LEQUAL,[hm]:e.EQUAL,[Zo]:e.GEQUAL,[um]:e.GREATER,[fm]:e.NOTEQUAL};function Re(C,M){if(M.type===ni&&t.has("OES_texture_float_linear")===!1&&(M.magFilter===on||M.magFilter===Ho||M.magFilter===gs||M.magFilter===Bi||M.minFilter===on||M.minFilter===Ho||M.minFilter===gs||M.minFilter===Bi))Ie("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.");if(e.texParameteri(C,e.TEXTURE_WRAP_S,ee[M.wrapS]),e.texParameteri(C,e.TEXTURE_WRAP_T,ee[M.wrapT]),C===e.TEXTURE_3D||C===e.TEXTURE_2D_ARRAY)e.texParameteri(C,e.TEXTURE_WRAP_R,ee[M.wrapR]);if(e.texParameteri(C,e.TEXTURE_MAG_FILTER,oe[M.magFilter]),e.texParameteri(C,e.TEXTURE_MIN_FILTER,oe[M.minFilter]),M.compareFunction)e.texParameteri(C,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(C,e.TEXTURE_COMPARE_FUNC,Ue[M.compareFunction]);if(t.has("EXT_texture_filter_anisotropic")===!0){if(M.magFilter===gi)return;if(M.minFilter!==gs&&M.minFilter!==Bi)return;if(M.type===ni&&t.has("OES_texture_float_linear")===!1)return;if(M.anisotropy>1||i.get(M).__currentAnisotropy){let O=t.get("EXT_texture_filter_anisotropic");e.texParameterf(C,O.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(M.anisotropy,r.getMaxAnisotropy())),i.get(M).__currentAnisotropy=M.anisotropy}}}function X(C,M){let O=!1;if(C.__webglInit===void 0)C.__webglInit=!0,M.addEventListener("dispose",T);let q=M.source,ie=p.get(q);if(ie===void 0)ie={},p.set(q,ie);let ce=z(M);if(ce!==C.__cacheKey){if(ie[ce]===void 0)ie[ce]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,O=!0;ie[ce].usedTimes++;let fe=ie[C.__cacheKey];if(fe!==void 0){if(ie[C.__cacheKey].usedTimes--,fe.usedTimes===0)N(M)}C.__cacheKey=ce,C.__webglTexture=ie[ce].texture}return O}function re(C,M,O){return Math.floor(Math.floor(C/O)/M)}function le(C,M,O,q){let ce=C.updateRanges;if(ce.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,M.width,M.height,O,q,M.data);else{ce.sort((Te,de)=>Te.start-de.start);let fe=0;for(let Te=1;Te<ce.length;Te++){let de=ce[fe],ae=ce[Te],Ce=de.start+de.count,Le=re(ae.start,M.width,4),Je=re(de.start,M.width,4);if(ae.start<=Ce+1&&Le===Je&&re(ae.start+ae.count-1,M.width,4)===Le)de.count=Math.max(de.count,ae.start+ae.count-de.start);else++fe,ce[fe]=ae}ce.length=fe+1;let Z=n.getParameter(e.UNPACK_ROW_LENGTH),K=n.getParameter(e.UNPACK_SKIP_PIXELS),ve=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,M.width);for(let Te=0,de=ce.length;Te<de;Te++){let ae=ce[Te],Ce=Math.floor(ae.start/4),Le=Math.ceil(ae.count/4),Je=Ce%M.width,B=Math.floor(Ce/M.width),he=Le,J=1;n.pixelStorei(e.UNPACK_SKIP_PIXELS,Je),n.pixelStorei(e.UNPACK_SKIP_ROWS,B),n.texSubImage2D(e.TEXTURE_2D,0,Je,B,he,1,O,q,M.data)}C.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,Z),n.pixelStorei(e.UNPACK_SKIP_PIXELS,K),n.pixelStorei(e.UNPACK_SKIP_ROWS,ve)}}function Pe(C,M,O){let q=e.TEXTURE_2D;if(M.isDataArrayTexture||M.isCompressedArrayTexture)q=e.TEXTURE_2D_ARRAY;if(M.isData3DTexture)q=e.TEXTURE_3D;let ie=X(C,M),ce=M.source;n.bindTexture(q,C.__webglTexture,e.TEXTURE0+O);let fe=i.get(ce);if(ce.version!==fe.__version||ie===!0){if(n.activeTexture(e.TEXTURE0+O),(typeof ImageBitmap<"u"&&M.image instanceof ImageBitmap)===!1){let J=qe.getPrimaries(qe.workingColorSpace),ue=M.colorSpace===Hi?null:qe.getPrimaries(M.colorSpace),ye=M.colorSpace===Hi||J===ue?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,ye)}n.pixelStorei(e.UNPACK_ALIGNMENT,M.unpackAlignment);let K=m(M.image,!1,r.maxTextureSize);K=tt(M,K);let ve=s.convert(M.format,M.colorSpace),Te=s.convert(M.type),de=_(M.internalFormat,ve,Te,M.normalized,M.colorSpace,M.isVideoTexture);Re(q,M);let ae,Ce=M.mipmaps,Le=M.isVideoTexture!==!0,Je=fe.__version===void 0||ie===!0,B=ce.dataReady,he=w(M,K);if(M.isDepthTexture){if(de=x(M.format===zi,M.type),Je)if(Le)n.texStorage2D(e.TEXTURE_2D,1,de,K.width,K.height);else n.texImage2D(e.TEXTURE_2D,0,de,K.width,K.height,0,ve,Te,null)}else if(M.isDataTexture)if(Ce.length>0){if(Le&&Je)n.texStorage2D(e.TEXTURE_2D,he,de,Ce[0].width,Ce[0].height);for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],Le){if(B)n.texSubImage2D(e.TEXTURE_2D,J,0,0,ae.width,ae.height,ve,Te,ae.data)}else n.texImage2D(e.TEXTURE_2D,J,de,ae.width,ae.height,0,ve,Te,ae.data);M.generateMipmaps=!1}else if(Le){if(Je)n.texStorage2D(e.TEXTURE_2D,he,de,K.width,K.height);if(B)le(M,K,ve,Te)}else n.texImage2D(e.TEXTURE_2D,0,de,K.width,K.height,0,ve,Te,K.data);else if(M.isCompressedTexture)if(M.isCompressedArrayTexture){if(Le&&Je)n.texStorage3D(e.TEXTURE_2D_ARRAY,he,de,Ce[0].width,Ce[0].height,K.depth);for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],M.format!==Bn)if(ve!==null)if(Le){if(B)if(M.layerUpdates.size>0){let ye=wh(ae.width,ae.height,M.format,M.type);for(let ne of M.layerUpdates){let me=ae.data.subarray(ne*ye/ae.data.BYTES_PER_ELEMENT,(ne+1)*ye/ae.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,J,0,0,ne,ae.width,ae.height,1,ve,me)}}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,J,0,0,0,ae.width,ae.height,K.depth,ve,ae.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,J,de,ae.width,ae.height,K.depth,0,ae.data,0,0);else Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(Le){if(B)n.texSubImage3D(e.TEXTURE_2D_ARRAY,J,0,0,0,ae.width,ae.height,K.depth,ve,Te,ae.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,J,de,ae.width,ae.height,K.depth,0,ve,Te,ae.data);if(M.layerUpdates.size>0)M.clearLayerUpdates()}else{if(Le&&Je)n.texStorage2D(e.TEXTURE_2D,he,de,Ce[0].width,Ce[0].height);for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],M.format!==Bn)if(ve!==null)if(Le){if(B)n.compressedTexSubImage2D(e.TEXTURE_2D,J,0,0,ae.width,ae.height,ve,ae.data)}else n.compressedTexImage2D(e.TEXTURE_2D,J,de,ae.width,ae.height,0,ae.data);else Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(Le){if(B)n.texSubImage2D(e.TEXTURE_2D,J,0,0,ae.width,ae.height,ve,Te,ae.data)}else n.texImage2D(e.TEXTURE_2D,J,de,ae.width,ae.height,0,ve,Te,ae.data)}else if(M.isDataArrayTexture)if(Le){if(Je)n.texStorage3D(e.TEXTURE_2D_ARRAY,he,de,K.width,K.height,K.depth);if(B)if(M.layerUpdates.size>0){let J=wh(K.width,K.height,M.format,M.type);for(let ue of M.layerUpdates){let ye=K.data.subarray(ue*J/K.data.BYTES_PER_ELEMENT,(ue+1)*J/K.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,ue,K.width,K.height,1,ve,Te,ye)}M.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,K.width,K.height,K.depth,ve,Te,K.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,de,K.width,K.height,K.depth,0,ve,Te,K.data);else if(M.isData3DTexture)if(Le){if(Je)n.texStorage3D(e.TEXTURE_3D,he,de,K.width,K.height,K.depth);if(B)n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,K.width,K.height,K.depth,ve,Te,K.data)}else n.texImage3D(e.TEXTURE_3D,0,de,K.width,K.height,K.depth,0,ve,Te,K.data);else if(M.isFramebufferTexture){if(Je)if(Le)n.texStorage2D(e.TEXTURE_2D,he,de,K.width,K.height);else{let J=K.width,ue=K.height;for(let ye=0;ye<he;ye++)n.texImage2D(e.TEXTURE_2D,ye,de,J,ue,0,ve,Te,null),J>>=1,ue>>=1}}else if(M.isHTMLTexture){if("texElementImage2D"in e){let J=e.canvas;if(!J.hasAttribute("layoutsubtree"))J.setAttribute("layoutsubtree","true");if(K.parentNode!==J){J.appendChild(K),f.add(M),J.onpaint=(ue)=>{let ye=ue.changedElements;for(let ne of f)if(ye.includes(ne.image))ne.needsUpdate=!0},J.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,K);else{let{RGBA:ye,RGBA:ne,UNSIGNED_BYTE:me}=e;e.texElementImage2D(e.TEXTURE_2D,0,ye,ne,me,K)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(Ce.length>0){if(Le&&Je){let J=yt(Ce[0]);n.texStorage2D(e.TEXTURE_2D,he,de,J.width,J.height)}for(let J=0,ue=Ce.length;J<ue;J++)if(ae=Ce[J],Le){if(B)n.texSubImage2D(e.TEXTURE_2D,J,0,0,ve,Te,ae)}else n.texImage2D(e.TEXTURE_2D,J,de,ve,Te,ae);M.generateMipmaps=!1}else if(Le){if(Je){let J=yt(K);n.texStorage2D(e.TEXTURE_2D,he,de,J.width,J.height)}if(B)n.texSubImage2D(e.TEXTURE_2D,0,0,0,ve,Te,K)}else n.texImage2D(e.TEXTURE_2D,0,de,ve,Te,K);if(d(M))b(q);if(fe.__version=ce.version,M.onUpdate)M.onUpdate(M)}C.__version=M.version}function Oe(C,M,O){if(M.image.length!==6)return;let q=X(C,M),ie=M.source;n.bindTexture(e.TEXTURE_CUBE_MAP,C.__webglTexture,e.TEXTURE0+O);let ce=i.get(ie);if(ie.version!==ce.__version||q===!0){n.activeTexture(e.TEXTURE0+O);let fe=qe.getPrimaries(qe.workingColorSpace),Z=M.colorSpace===Hi?null:qe.getPrimaries(M.colorSpace),K=M.colorSpace===Hi||fe===Z?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,M.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,K);let ve=M.isCompressedTexture||M.image[0].isCompressedTexture,Te=M.image[0]&&M.image[0].isDataTexture,de=[];for(let ne=0;ne<6;ne++){if(!ve&&!Te)de[ne]=m(M.image[ne],!0,r.maxCubemapSize);else de[ne]=Te?M.image[ne].image:M.image[ne];de[ne]=tt(M,de[ne])}let ae=de[0],Ce=s.convert(M.format,M.colorSpace),Le=s.convert(M.type),Je=_(M.internalFormat,Ce,Le,M.normalized,M.colorSpace),B=M.isVideoTexture!==!0,he=ce.__version===void 0||q===!0,J=ie.dataReady,ue=w(M,ae);Re(e.TEXTURE_CUBE_MAP,M);let ye;if(ve){if(B&&he)n.texStorage2D(e.TEXTURE_CUBE_MAP,ue,Je,ae.width,ae.height);for(let ne=0;ne<6;ne++){ye=de[ne].mipmaps;for(let me=0;me<ye.length;me++){let Be=ye[me];if(M.format!==Bn)if(Ce!==null)if(B){if(J)n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me,0,0,Be.width,Be.height,Ce,Be.data)}else n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me,Je,Be.width,Be.height,0,Be.data);else Ie("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()");else if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me,0,0,Be.width,Be.height,Ce,Le,Be.data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me,Je,Be.width,Be.height,0,Ce,Le,Be.data)}}}else{if(ye=M.mipmaps,B&&he){if(ye.length>0)ue++;let ne=yt(de[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,ue,Je,ne.width,ne.height)}for(let ne=0;ne<6;ne++)if(Te){if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,0,0,de[ne].width,de[ne].height,Ce,Le,de[ne].data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,Je,de[ne].width,de[ne].height,0,Ce,Le,de[ne].data);for(let me=0;me<ye.length;me++){let ut=ye[me].image[ne].image;if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me+1,0,0,ut.width,ut.height,Ce,Le,ut.data)}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me+1,Je,ut.width,ut.height,0,Ce,Le,ut.data)}}else{if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,0,0,Ce,Le,de[ne])}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,0,Je,Ce,Le,de[ne]);for(let me=0;me<ye.length;me++){let Be=ye[me];if(B){if(J)n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me+1,0,0,Ce,Le,Be.image[ne])}else n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ne,me+1,Je,Ce,Le,Be.image[ne])}}}if(d(M))b(e.TEXTURE_CUBE_MAP);if(ce.__version=ie.version,M.onUpdate)M.onUpdate(M)}C.__version=M.version}function Ae(C,M,O,q,ie,ce){let fe=s.convert(O.format,O.colorSpace),Z=s.convert(O.type),K=_(O.internalFormat,fe,Z,O.normalized,O.colorSpace),ve=i.get(M),Te=i.get(O);if(Te.__renderTarget=M,!ve.__hasExternalTextures){let de=Math.max(1,M.width>>ce),ae=Math.max(1,M.height>>ce);if(ie===e.TEXTURE_3D||ie===e.TEXTURE_2D_ARRAY)n.texImage3D(ie,ce,K,de,ae,M.depth,0,fe,Z,null);else n.texImage2D(ie,ce,K,de,ae,0,fe,Z,null)}if(n.bindFramebuffer(e.FRAMEBUFFER,C),U(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,q,ie,Te.__webglTexture,0,At(M));else if(ie===e.TEXTURE_2D||ie>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&ie<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)e.framebufferTexture2D(e.FRAMEBUFFER,q,ie,Te.__webglTexture,ce);n.bindFramebuffer(e.FRAMEBUFFER,null)}function Et(C,M,O){if(e.bindRenderbuffer(e.RENDERBUFFER,C),M.depthBuffer){let q=M.depthTexture,ie=q&&q.isDepthTexture?q.type:null,ce=x(M.stencilBuffer,ie),fe=M.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(U(M))a.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,At(M),ce,M.width,M.height);else if(O)e.renderbufferStorageMultisample(e.RENDERBUFFER,At(M),ce,M.width,M.height);else e.renderbufferStorage(e.RENDERBUFFER,ce,M.width,M.height);e.framebufferRenderbuffer(e.FRAMEBUFFER,fe,e.RENDERBUFFER,C)}else{let q=M.textures;for(let ie=0;ie<q.length;ie++){let ce=q[ie],fe=s.convert(ce.format,ce.colorSpace),Z=s.convert(ce.type),K=_(ce.internalFormat,fe,Z,ce.normalized,ce.colorSpace);if(U(M))a.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,At(M),K,M.width,M.height);else if(O)e.renderbufferStorageMultisample(e.RENDERBUFFER,At(M),K,M.width,M.height);else e.renderbufferStorage(e.RENDERBUFFER,K,M.width,M.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function Xe(C,M,O){let q=M.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,C),!(M.depthTexture&&M.depthTexture.isDepthTexture))throw Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let ie=i.get(M.depthTexture);if(ie.__renderTarget=M,!ie.__webglTexture||M.depthTexture.image.width!==M.width||M.depthTexture.image.height!==M.height)M.depthTexture.image.width=M.width,M.depthTexture.image.height=M.height,M.depthTexture.needsUpdate=!0;if(q){if(ie.__webglInit===void 0)ie.__webglInit=!0,M.depthTexture.addEventListener("dispose",T);if(ie.__webglTexture===void 0){ie.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,ie.__webglTexture),Re(e.TEXTURE_CUBE_MAP,M.depthTexture);let ve=s.convert(M.depthTexture.format),Te=s.convert(M.depthTexture.type),de;if(M.depthTexture.format===ki)de=e.DEPTH_COMPONENT24;else if(M.depthTexture.format===zi)de=e.DEPTH24_STENCIL8;for(let ae=0;ae<6;ae++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+ae,0,de,M.width,M.height,0,ve,Te,null)}}else te(M.depthTexture,0);let ce=ie.__webglTexture,fe=At(M),Z=q?e.TEXTURE_CUBE_MAP_POSITIVE_X+O:e.TEXTURE_2D,K=M.depthTexture.format===zi?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(M.depthTexture.format===ki)if(U(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,K,Z,ce,0,fe);else e.framebufferTexture2D(e.FRAMEBUFFER,K,Z,ce,0);else if(M.depthTexture.format===zi)if(U(M))a.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,K,Z,ce,0,fe);else e.framebufferTexture2D(e.FRAMEBUFFER,K,Z,ce,0);else throw Error("THREE.WebGLTextures: Unknown depthTexture format.")}function je(C){let M=i.get(C),O=C.isWebGLCubeRenderTarget===!0;if(M.__boundDepthTexture!==C.depthTexture){let q=C.depthTexture;if(M.__depthDisposeCallback)M.__depthDisposeCallback();if(q){let ie=()=>{delete M.__boundDepthTexture,delete M.__depthDisposeCallback,q.removeEventListener("dispose",ie)};q.addEventListener("dispose",ie),M.__depthDisposeCallback=ie}M.__boundDepthTexture=q}if(C.depthTexture&&!M.__autoAllocateDepthBuffer)if(O)for(let q=0;q<6;q++)Xe(M.__webglFramebuffer[q],C,q);else{let q=C.texture.mipmaps;if(q&&q.length>0)Xe(M.__webglFramebuffer[0],C,0);else Xe(M.__webglFramebuffer,C,0)}else if(O){M.__webglDepthbuffer=[];for(let q=0;q<6;q++)if(n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer[q]),M.__webglDepthbuffer[q]===void 0)M.__webglDepthbuffer[q]=e.createRenderbuffer(),Et(M.__webglDepthbuffer[q],C,!1);else{let ie=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ce=M.__webglDepthbuffer[q];e.bindRenderbuffer(e.RENDERBUFFER,ce),e.framebufferRenderbuffer(e.FRAMEBUFFER,ie,e.RENDERBUFFER,ce)}}else{let q=C.texture.mipmaps;if(q&&q.length>0)n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer[0]);else n.bindFramebuffer(e.FRAMEBUFFER,M.__webglFramebuffer);if(M.__webglDepthbuffer===void 0)M.__webglDepthbuffer=e.createRenderbuffer(),Et(M.__webglDepthbuffer,C,!1);else{let ie=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,ce=M.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,ce),e.framebufferRenderbuffer(e.FRAMEBUFFER,ie,e.RENDERBUFFER,ce)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function rt(C,M,O){let q=i.get(C);if(M!==void 0)Ae(q.__webglFramebuffer,C,C.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0);if(O!==void 0)je(C)}function Ye(C){let M=C.texture,O=i.get(C),q=i.get(M);C.addEventListener("dispose",v);let ie=C.textures,ce=C.isWebGLCubeRenderTarget===!0,fe=ie.length>1;if(!fe){if(q.__webglTexture===void 0)q.__webglTexture=e.createTexture();q.__version=M.version,o.memory.textures++}if(ce){O.__webglFramebuffer=[];for(let Z=0;Z<6;Z++)if(M.mipmaps&&M.mipmaps.length>0){O.__webglFramebuffer[Z]=[];for(let K=0;K<M.mipmaps.length;K++)O.__webglFramebuffer[Z][K]=e.createFramebuffer()}else O.__webglFramebuffer[Z]=e.createFramebuffer()}else{if(M.mipmaps&&M.mipmaps.length>0){O.__webglFramebuffer=[];for(let Z=0;Z<M.mipmaps.length;Z++)O.__webglFramebuffer[Z]=e.createFramebuffer()}else O.__webglFramebuffer=e.createFramebuffer();if(fe)for(let Z=0,K=ie.length;Z<K;Z++){let ve=i.get(ie[Z]);if(ve.__webglTexture===void 0)ve.__webglTexture=e.createTexture(),o.memory.textures++}if(C.samples>0&&U(C)===!1){O.__webglMultisampledFramebuffer=e.createFramebuffer(),O.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,O.__webglMultisampledFramebuffer);for(let Z=0;Z<ie.length;Z++){let K=ie[Z];O.__webglColorRenderbuffer[Z]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,O.__webglColorRenderbuffer[Z]);let ve=s.convert(K.format,K.colorSpace),Te=s.convert(K.type),de=_(K.internalFormat,ve,Te,K.normalized,K.colorSpace,C.isXRRenderTarget===!0),ae=At(C);e.renderbufferStorageMultisample(e.RENDERBUFFER,ae,de,C.width,C.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+Z,e.RENDERBUFFER,O.__webglColorRenderbuffer[Z])}if(e.bindRenderbuffer(e.RENDERBUFFER,null),C.depthBuffer)O.__webglDepthRenderbuffer=e.createRenderbuffer(),Et(O.__webglDepthRenderbuffer,C,!0);n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(ce){n.bindTexture(e.TEXTURE_CUBE_MAP,q.__webglTexture),Re(e.TEXTURE_CUBE_MAP,M);for(let Z=0;Z<6;Z++)if(M.mipmaps&&M.mipmaps.length>0)for(let K=0;K<M.mipmaps.length;K++)Ae(O.__webglFramebuffer[Z][K],C,M,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,K);else Ae(O.__webglFramebuffer[Z],C,M,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0);if(d(M))b(e.TEXTURE_CUBE_MAP);n.unbindTexture()}else if(fe){for(let Z=0,K=ie.length;Z<K;Z++){let ve=ie[Z],Te=i.get(ve),de=e.TEXTURE_2D;if(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)de=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY;if(n.bindTexture(de,Te.__webglTexture),Re(de,ve),Ae(O.__webglFramebuffer,C,ve,e.COLOR_ATTACHMENT0+Z,de,0),d(ve))b(de)}n.unbindTexture()}else{let Z=e.TEXTURE_2D;if(C.isWebGL3DRenderTarget||C.isWebGLArrayRenderTarget)Z=C.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY;if(n.bindTexture(Z,q.__webglTexture),Re(Z,M),M.mipmaps&&M.mipmaps.length>0)for(let K=0;K<M.mipmaps.length;K++)Ae(O.__webglFramebuffer[K],C,M,e.COLOR_ATTACHMENT0,Z,K);else Ae(O.__webglFramebuffer,C,M,e.COLOR_ATTACHMENT0,Z,0);if(d(M))b(Z);n.unbindTexture()}if(C.depthBuffer)je(C)}function Ut(C){let M=C.textures;for(let O=0,q=M.length;O<q;O++){let ie=M[O];if(d(ie)){let ce=S(C),fe=i.get(ie).__webglTexture;n.bindTexture(ce,fe),b(ce),n.unbindTexture()}}}let dt=[],en=[];function Tt(C){if(C.samples>0){if(U(C)===!1){let{textures:M,width:O,height:q}=C,ie=e.COLOR_BUFFER_BIT,ce=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,fe=i.get(C),Z=M.length>1;if(Z)for(let ve=0;ve<M.length;ve++)n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,fe.__webglMultisampledFramebuffer);let K=C.texture.mipmaps;if(K&&K.length>0)n.bindFramebuffer(e.DRAW_FRAMEBUFFER,fe.__webglFramebuffer[0]);else n.bindFramebuffer(e.DRAW_FRAMEBUFFER,fe.__webglFramebuffer);for(let ve=0;ve<M.length;ve++){if(C.resolveDepthBuffer){if(C.depthBuffer)ie|=e.DEPTH_BUFFER_BIT;if(C.stencilBuffer&&C.resolveStencilBuffer)ie|=e.STENCIL_BUFFER_BIT}if(Z){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,fe.__webglColorRenderbuffer[ve]);let Te=i.get(M[ve]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,Te,0)}if(e.blitFramebuffer(0,0,O,q,0,0,O,q,ie,e.NEAREST),l===!0){if(dt.length=0,en.length=0,dt.push(e.COLOR_ATTACHMENT0+ve),C.depthBuffer&&C.storeMultisampledDepthBuffer===!1)dt.push(ce),en.push(ce),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,en);e.invalidateFramebuffer(e.READ_FRAMEBUFFER,dt)}}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),Z)for(let ve=0;ve<M.length;ve++){n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.RENDERBUFFER,fe.__webglColorRenderbuffer[ve]);let Te=i.get(M[ve]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,fe.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ve,e.TEXTURE_2D,Te,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,fe.__webglMultisampledFramebuffer)}else if(C.depthBuffer&&C.storeMultisampledDepthBuffer===!1&&l){let M=C.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[M])}}}function At(C){return Math.min(r.maxSamples,C.samples)}function U(C){let M=i.get(C);return C.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&M.__useRenderToTexture!==!1}function tn(C){let M=o.render.frame;if(h.get(C)!==M)h.set(C,M),C.update()}function tt(C,M){let{colorSpace:O,format:q,type:ie}=C;if(C.isCompressedTexture===!0||C.isVideoTexture===!0)return M;if(O!==kc&&O!==Hi)if(qe.getTransfer(O)===ht){if(q!==Bn||ie!==Rn)Ie("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.")}else De("WebGLTextures: Unsupported texture color space:",O);return M}function yt(C){if(typeof HTMLImageElement<"u"&&C instanceof HTMLImageElement)c.width=C.naturalWidth||C.width,c.height=C.naturalHeight||C.height;else if(typeof VideoFrame<"u"&&C instanceof VideoFrame)c.width=C.displayWidth,c.height=C.displayHeight;else c.width=C.width,c.height=C.height;return c}this.allocateTextureUnit=k,this.resetTextureUnits=W,this.getTextureUnits=R,this.setTextureUnits=I,this.setTexture2D=te,this.setTexture2DArray=Y,this.setTexture3D=Q,this.setTextureCube=G,this.rebindTextures=rt,this.setupRenderTarget=Ye,this.updateRenderTargetMipmap=Ut,this.updateMultisampleRenderTarget=Tt,this.setupDepthRenderbuffer=je,this.setupFrameBufferTexture=Ae,this.useMultisampledRTT=U,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function qM(e,t){function n(i,r=Hi){let s,o=qe.getTransfer(r);if(i===Rn)return e.UNSIGNED_BYTE;if(i===ic)return e.UNSIGNED_SHORT_4_4_4_4;if(i===rc)return e.UNSIGNED_SHORT_5_5_5_1;if(i===nm)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===im)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===em)return e.BYTE;if(i===tm)return e.SHORT;if(i===_s)return e.UNSIGNED_SHORT;if(i===nc)return e.INT;if(i===_i)return e.UNSIGNED_INT;if(i===ni)return e.FLOAT;if(i===bn)return e.HALF_FLOAT;if(i===rm)return e.ALPHA;if(i===sm)return e.RGB;if(i===Bn)return e.RGBA;if(i===ki)return e.DEPTH_COMPONENT;if(i===zi)return e.DEPTH_STENCIL;if(i===om)return e.RED;if(i===sc)return e.RED_INTEGER;if(i===Gi)return e.RG;if(i===oc)return e.RG_INTEGER;if(i===ac)return e.RGBA_INTEGER;if(i===Vo||i===Wo||i===Xo||i===qo)if(o===ht)if(s=t.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===Vo)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Wo)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Xo)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===qo)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=t.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===Vo)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Wo)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Xo)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===qo)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===lc||i===cc||i===hc||i===uc)if(s=t.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===lc)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===cc)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===hc)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===uc)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===fc||i===dc||i===pc||i===mc||i===gc||i===jo||i===_c)if(s=t.get("WEBGL_compressed_texture_etc"),s!==null){if(i===fc||i===dc)return o===ht?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===pc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(i===mc)return s.COMPRESSED_R11_EAC;if(i===gc)return s.COMPRESSED_SIGNED_R11_EAC;if(i===jo)return s.COMPRESSED_RG11_EAC;if(i===_c)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===vc||i===yc||i===xc||i===bc||i===Sc||i===Mc||i===wc||i===Ec||i===Tc||i===Ac||i===Cc||i===Rc||i===Pc||i===Ic)if(s=t.get("WEBGL_compressed_texture_astc"),s!==null){if(i===vc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===yc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===xc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===bc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Sc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Mc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===wc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Ec)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Tc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Ac)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Cc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Rc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Pc)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Ic)return o===ht?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Lc||i===Dc||i===Nc)if(s=t.get("EXT_texture_compression_bptc"),s!==null){if(i===Lc)return o===ht?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Dc)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Nc)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Oc||i===Uc||i===Yo||i===Fc)if(s=t.get("EXT_texture_compression_rgtc"),s!==null){if(i===Oc)return s.COMPRESSED_RED_RGTC1_EXT;if(i===Uc)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Yo)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Fc)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;if(i===Ir)return e.UNSIGNED_INT_24_8;return e[i]!==void 0?e[i]:null}return{convert:n}}var jM=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,YM=`
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

}`;class ng{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new sa(e.texture);if(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)this.depthNear=e.depthNear,this.depthFar=e.depthFar;this.texture=n}}getMesh(e){if(this.texture!==null){if(this.mesh===null){let t=e.cameras[0].viewport,n=new Jt({vertexShader:jM,fragmentShader:YM,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Bt(new Ts(20,20),n)}}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class ig extends kn{constructor(e,t){super();let n=this,i=null,r=1,s=null,o="local-floor",a=1,l=null,c=null,h=null,f=null,u=null,p=null,g=typeof XRWebGLBinding<"u",y=new ng,m={},d=t.getContextAttributes(),b=null,S=null,_=[],x=[],w=new se,T=null,v=null,A=new $t;A.viewport=new gt;let N=new $t;N.viewport=new gt;let P=[A,N],D=new xh,W=null,R=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(X){let re=_[X];if(re===void 0)re=new xs,_[X]=re;return re.getTargetRaySpace()},this.getControllerGrip=function(X){let re=_[X];if(re===void 0)re=new xs,_[X]=re;return re.getGripSpace()},this.getHand=function(X){let re=_[X];if(re===void 0)re=new xs,_[X]=re;return re.getHandSpace()};function I(X){let re=x.indexOf(X.inputSource);if(re===-1)return;let le=_[re];if(le!==void 0)le.update(X.inputSource,X.frame,l||s),le.dispatchEvent({type:X.type,data:X.inputSource})}function k(){i.removeEventListener("select",I),i.removeEventListener("selectstart",I),i.removeEventListener("selectend",I),i.removeEventListener("squeeze",I),i.removeEventListener("squeezestart",I),i.removeEventListener("squeezeend",I),i.removeEventListener("end",k),i.removeEventListener("inputsourceschange",z);for(let X=0;X<_.length;X++){let re=x[X];if(re===null)continue;x[X]=null,_[X].disconnect(re)}W=null,R=null,y.reset();for(let X in m)delete m[X];if(e.setRenderTarget(b),u=null,f=null,h=null,i=null,S=null,Re.stop(),n.isPresenting=!1,e.setPixelRatio(T),e.setSize(w.width,w.height,!1),v!==null){let X=v.camera;X.fov=v.fov,X.zoom=v.zoom,X.updateProjectionMatrix(),v=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(X){if(r=X,n.isPresenting===!0)Ie("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(X){if(o=X,n.isPresenting===!0)Ie("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||s},this.setReferenceSpace=function(X){l=X},this.getBaseLayer=function(){return f!==null?f:u},this.getBinding=function(){if(h===null&&g)h=new XRWebGLBinding(i,t);return h},this.getFrame=function(){return p},this.getSession=function(){return i},this.setSession=async function(X){if(i=X,i!==null){if(b=e.getRenderTarget(),i.addEventListener("select",I),i.addEventListener("selectstart",I),i.addEventListener("selectend",I),i.addEventListener("squeeze",I),i.addEventListener("squeezestart",I),i.addEventListener("squeezeend",I),i.addEventListener("end",k),i.addEventListener("inputsourceschange",z),d.xrCompatible!==!0)await t.makeXRCompatible();if(T=e.getPixelRatio(),e.getSize(w),!(g&&("createProjectionLayer"in XRWebGLBinding.prototype))){let le={antialias:d.antialias,alpha:!0,depth:d.depth,stencil:d.stencil,framebufferScaleFactor:r};u=new XRWebGLLayer(i,t,le),i.updateRenderState({baseLayer:u}),e.setPixelRatio(1),e.setSize(u.framebufferWidth,u.framebufferHeight,!1),S=new Zt(u.framebufferWidth,u.framebufferHeight,{format:Bn,type:Rn,colorSpace:e.outputColorSpace,stencilBuffer:d.stencil,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}else{let le=null,Pe=null,Oe=null;if(d.depth)Oe=d.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,le=d.stencil?zi:ki,Pe=d.stencil?Ir:_i;let Ae={colorFormat:t.RGBA8,depthFormat:Oe,scaleFactor:r};h=this.getBinding(),f=h.createProjectionLayer(Ae),i.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),S=new Zt(f.textureWidth,f.textureHeight,{format:Bn,type:Rn,depthTexture:new Wi(f.textureWidth,f.textureHeight,Pe,void 0,void 0,void 0,void 0,void 0,void 0,le),stencilBuffer:d.stencil,colorSpace:e.outputColorSpace,samples:d.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(a),l=null,s=await i.requestReferenceSpace(o),Re.setContext(i),Re.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return y.getDepthTexture()};function z(X){for(let re=0;re<X.removed.length;re++){let le=X.removed[re],Pe=x.indexOf(le);if(Pe>=0)x[Pe]=null,_[Pe].disconnect(le)}for(let re=0;re<X.added.length;re++){let le=X.added[re],Pe=x.indexOf(le);if(Pe===-1){for(let Ae=0;Ae<_.length;Ae++)if(Ae>=x.length){x.push(le),Pe=Ae;break}else if(x[Ae]===null){x[Ae]=le,Pe=Ae;break}if(Pe===-1)break}let Oe=_[Pe];if(Oe)Oe.connect(le)}}let te=new L,Y=new L;function Q(X,re,le){te.setFromMatrixPosition(re.matrixWorld),Y.setFromMatrixPosition(le.matrixWorld);let Pe=te.distanceTo(Y),Oe=re.projectionMatrix.elements,Ae=le.projectionMatrix.elements,Et=Oe[14]/(Oe[10]-1),Xe=Oe[14]/(Oe[10]+1),je=(Oe[9]+1)/Oe[5],rt=(Oe[9]-1)/Oe[5],Ye=(Oe[8]-1)/Oe[0],Ut=(Ae[8]+1)/Ae[0],dt=Et*Ye,en=Et*Ut,Tt=Pe/(-Ye+Ut),At=Tt*-Ye;if(re.matrixWorld.decompose(X.position,X.quaternion,X.scale),X.translateX(At),X.translateZ(Tt),X.matrixWorld.compose(X.position,X.quaternion,X.scale),X.matrixWorldInverse.copy(X.matrixWorld).invert(),Oe[10]===-1)X.projectionMatrix.copy(re.projectionMatrix),X.projectionMatrixInverse.copy(re.projectionMatrixInverse);else{let U=Et+Tt,tn=Xe+Tt,tt=dt-At,yt=en+(Pe-At),C=je*Xe/tn*U,M=rt*Xe/tn*U;X.projectionMatrix.makePerspective(tt,yt,C,M,U,tn),X.projectionMatrixInverse.copy(X.projectionMatrix).invert()}}function G(X,re){if(re===null)X.matrixWorld.copy(X.matrix);else X.matrixWorld.multiplyMatrices(re.matrixWorld,X.matrix);X.matrixWorldInverse.copy(X.matrixWorld).invert()}this.updateCamera=function(X){if(i===null)return;let{near:re,far:le}=X;if(y.texture!==null){if(y.depthNear>0)re=y.depthNear;if(y.depthFar>0)le=y.depthFar}if(D.near=N.near=A.near=re,D.far=N.far=A.far=le,W!==D.near||R!==D.far)i.updateRenderState({depthNear:D.near,depthFar:D.far}),W=D.near,R=D.far;D.layers.mask=X.layers.mask|6,A.layers.mask=D.layers.mask&-5,N.layers.mask=D.layers.mask&-3;let Pe=X.parent,Oe=D.cameras;G(D,Pe);for(let Ae=0;Ae<Oe.length;Ae++)G(Oe[Ae],Pe);if(Oe.length===2)Q(D,A,N);else D.projectionMatrix.copy(A.projectionMatrix);if(v===null&&X.isPerspectiveCamera)v={camera:X,fov:X.fov,zoom:X.zoom};ee(X,D,Pe)};function ee(X,re,le){if(le===null)X.matrix.copy(re.matrixWorld);else X.matrix.copy(le.matrixWorld),X.matrix.invert(),X.matrix.multiply(re.matrixWorld);if(X.matrix.decompose(X.position,X.quaternion,X.scale),X.updateMatrixWorld(!0),X.projectionMatrix.copy(re.projectionMatrix),X.projectionMatrixInverse.copy(re.projectionMatrixInverse),X.isPerspectiveCamera)X.fov=Tr*2*Math.atan(1/X.projectionMatrix.elements[5]),X.zoom=1}this.getCamera=function(){return D},this.getFoveation=function(){if(f===null&&u===null)return;return a},this.setFoveation=function(X){if(a=X,f!==null)f.fixedFoveation=X;if(u!==null&&u.fixedFoveation!==void 0)u.fixedFoveation=X},this.hasDepthSensing=function(){return y.texture!==null},this.getDepthSensingMesh=function(){return y.getMesh(D)},this.getCameraTexture=function(X){return m[X]};let oe=null;function Ue(X,re){if(c=re.getViewerPose(l||s),p=re,c!==null){let le=c.views;if(u!==null)e.setRenderTargetFramebuffer(S,u.framebuffer),e.setRenderTarget(S);let Pe=!1;if(le.length!==D.cameras.length)D.cameras.length=0,Pe=!0;for(let Xe=0;Xe<le.length;Xe++){let je=le[Xe],rt=null;if(u!==null)rt=u.getViewport(je);else{let Ut=h.getViewSubImage(f,je);if(rt=Ut.viewport,Xe===0)e.setRenderTargetTextures(S,Ut.colorTexture,Ut.depthStencilTexture),e.setRenderTarget(S)}let Ye=P[Xe];if(Ye===void 0)Ye=new $t,Ye.layers.enable(Xe),Ye.viewport=new gt,P[Xe]=Ye;if(Ye.matrix.fromArray(je.transform.matrix),Ye.matrix.decompose(Ye.position,Ye.quaternion,Ye.scale),Ye.projectionMatrix.fromArray(je.projectionMatrix),Ye.projectionMatrixInverse.copy(Ye.projectionMatrix).invert(),Ye.viewport.set(rt.x,rt.y,rt.width,rt.height),Xe===0)D.matrix.copy(Ye.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale);if(Pe===!0)D.cameras.push(Ye)}let Oe=i.enabledFeatures;if(Oe&&Oe.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&g){h=n.getBinding();let Xe=h.getDepthInformation(le[0]);if(Xe&&Xe.isValid&&Xe.texture)y.init(Xe,i.renderState)}if(Oe&&Oe.includes("camera-access")&&g){e.state.unbindTexture(),h=n.getBinding();for(let Xe=0;Xe<le.length;Xe++){let je=le[Xe].camera;if(je){let rt=m[je];if(!rt)rt=new sa,m[je]=rt;let Ye=h.getCameraImage(je);rt.sourceTexture=Ye}}}}for(let le=0;le<_.length;le++){let Pe=x[le],Oe=_[le];if(Pe!==null&&Oe!==void 0)Oe.update(Pe,re,l||s)}if(oe)oe(X,re);if(re.detectedPlanes)n.dispatchEvent({type:"planesdetected",data:re});p=null}let Re=new Xm;Re.setAnimationLoop(Ue),this.setAnimationLoop=function(X){oe=X},this.dispose=function(){}}}var $M=new Ke,rg=new Fe;rg.set(-1,0,0,0,1,0,0,0,1);function ZM(e,t){function n(m,d){if(m.matrixAutoUpdate===!0)m.updateMatrix();d.value.copy(m.matrix)}function i(m,d){if(d.color.getRGB(m.fogColor.value,rh(e)),d.isFog)m.fogNear.value=d.near,m.fogFar.value=d.far;else if(d.isFogExp2)m.fogDensity.value=d.density}function r(m,d,b,S,_){if(d.isNodeMaterial)d.uniformsNeedUpdate=!1;else if(d.isMeshBasicMaterial)s(m,d);else if(d.isMeshLambertMaterial){if(s(m,d),d.envMap)m.envMapIntensity.value=d.envMapIntensity}else if(d.isMeshToonMaterial)s(m,d),f(m,d);else if(d.isMeshPhongMaterial){if(s(m,d),h(m,d),d.envMap)m.envMapIntensity.value=d.envMapIntensity}else if(d.isMeshStandardMaterial){if(s(m,d),u(m,d),d.isMeshPhysicalMaterial)p(m,d,_)}else if(d.isMeshMatcapMaterial)s(m,d),g(m,d);else if(d.isMeshDepthMaterial)s(m,d);else if(d.isMeshDistanceMaterial)s(m,d),y(m,d);else if(d.isMeshNormalMaterial)s(m,d);else if(d.isLineBasicMaterial){if(o(m,d),d.isLineDashedMaterial)a(m,d)}else if(d.isPointsMaterial)l(m,d,b,S);else if(d.isSpriteMaterial)c(m,d);else if(d.isShadowMaterial)m.color.value.copy(d.color),m.opacity.value=d.opacity;else if(d.isShaderMaterial)d.uniformsNeedUpdate=!1}function s(m,d){if(m.opacity.value=d.opacity,d.color)m.diffuse.value.copy(d.color);if(d.emissive)m.emissive.value.copy(d.emissive).multiplyScalar(d.emissiveIntensity);if(d.map)m.map.value=d.map,n(d.map,m.mapTransform);if(d.alphaMap)m.alphaMap.value=d.alphaMap,n(d.alphaMap,m.alphaMapTransform);if(d.bumpMap){if(m.bumpMap.value=d.bumpMap,n(d.bumpMap,m.bumpMapTransform),m.bumpScale.value=d.bumpScale,d.side===Vt)m.bumpScale.value*=-1}if(d.normalMap){if(m.normalMap.value=d.normalMap,n(d.normalMap,m.normalMapTransform),m.normalScale.value.copy(d.normalScale),d.side===Vt)m.normalScale.value.negate()}if(d.displacementMap)m.displacementMap.value=d.displacementMap,n(d.displacementMap,m.displacementMapTransform),m.displacementScale.value=d.displacementScale,m.displacementBias.value=d.displacementBias;if(d.emissiveMap)m.emissiveMap.value=d.emissiveMap,n(d.emissiveMap,m.emissiveMapTransform);if(d.specularMap)m.specularMap.value=d.specularMap,n(d.specularMap,m.specularMapTransform);if(d.alphaTest>0)m.alphaTest.value=d.alphaTest;let b=t.get(d),{envMap:S,envMapRotation:_}=b;if(S){if(m.envMap.value=S,m.envMapRotation.value.setFromMatrix4($M.makeRotationFromEuler(_)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1)m.envMapRotation.value.premultiply(rg);m.reflectivity.value=d.reflectivity,m.ior.value=d.ior,m.refractionRatio.value=d.refractionRatio}if(d.lightMap)m.lightMap.value=d.lightMap,m.lightMapIntensity.value=d.lightMapIntensity,n(d.lightMap,m.lightMapTransform);if(d.aoMap)m.aoMap.value=d.aoMap,m.aoMapIntensity.value=d.aoMapIntensity,n(d.aoMap,m.aoMapTransform)}function o(m,d){if(m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,d.map)m.map.value=d.map,n(d.map,m.mapTransform)}function a(m,d){m.dashSize.value=d.dashSize,m.totalSize.value=d.dashSize+d.gapSize,m.scale.value=d.scale}function l(m,d,b,S){if(m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.size.value=d.size*b,m.scale.value=S*0.5,d.map)m.map.value=d.map,n(d.map,m.uvTransform);if(d.alphaMap)m.alphaMap.value=d.alphaMap,n(d.alphaMap,m.alphaMapTransform);if(d.alphaTest>0)m.alphaTest.value=d.alphaTest}function c(m,d){if(m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.rotation.value=d.rotation,d.map)m.map.value=d.map,n(d.map,m.mapTransform);if(d.alphaMap)m.alphaMap.value=d.alphaMap,n(d.alphaMap,m.alphaMapTransform);if(d.alphaTest>0)m.alphaTest.value=d.alphaTest}function h(m,d){m.specular.value.copy(d.specular),m.shininess.value=Math.max(d.shininess,0.0001)}function f(m,d){if(d.gradientMap)m.gradientMap.value=d.gradientMap}function u(m,d){if(m.metalness.value=d.metalness,d.metalnessMap)m.metalnessMap.value=d.metalnessMap,n(d.metalnessMap,m.metalnessMapTransform);if(m.roughness.value=d.roughness,d.roughnessMap)m.roughnessMap.value=d.roughnessMap,n(d.roughnessMap,m.roughnessMapTransform);if(d.envMap)m.envMapIntensity.value=d.envMapIntensity}function p(m,d,b){if(m.ior.value=d.ior,d.sheen>0){if(m.sheenColor.value.copy(d.sheenColor).multiplyScalar(d.sheen),m.sheenRoughness.value=d.sheenRoughness,d.sheenColorMap)m.sheenColorMap.value=d.sheenColorMap,n(d.sheenColorMap,m.sheenColorMapTransform);if(d.sheenRoughnessMap)m.sheenRoughnessMap.value=d.sheenRoughnessMap,n(d.sheenRoughnessMap,m.sheenRoughnessMapTransform)}if(d.clearcoat>0){if(m.clearcoat.value=d.clearcoat,m.clearcoatRoughness.value=d.clearcoatRoughness,d.clearcoatMap)m.clearcoatMap.value=d.clearcoatMap,n(d.clearcoatMap,m.clearcoatMapTransform);if(d.clearcoatRoughnessMap)m.clearcoatRoughnessMap.value=d.clearcoatRoughnessMap,n(d.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform);if(d.clearcoatNormalMap){if(m.clearcoatNormalMap.value=d.clearcoatNormalMap,n(d.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(d.clearcoatNormalScale),d.side===Vt)m.clearcoatNormalScale.value.negate()}}if(d.dispersion>0)m.dispersion.value=d.dispersion;if(d.retroreflectivity>0)m.retroreflectivity.value=d.retroreflectivity;if(d.iridescence>0){if(m.iridescence.value=d.iridescence,m.iridescenceIOR.value=d.iridescenceIOR,m.iridescenceThicknessMinimum.value=d.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=d.iridescenceThicknessRange[1],d.iridescenceMap)m.iridescenceMap.value=d.iridescenceMap,n(d.iridescenceMap,m.iridescenceMapTransform);if(d.iridescenceThicknessMap)m.iridescenceThicknessMap.value=d.iridescenceThicknessMap,n(d.iridescenceThicknessMap,m.iridescenceThicknessMapTransform)}if(d.transmission>0){if(m.transmission.value=d.transmission,m.transmissionSamplerMap.value=b.texture,m.transmissionSamplerSize.value.set(b.width,b.height),d.transmissionMap)m.transmissionMap.value=d.transmissionMap,n(d.transmissionMap,m.transmissionMapTransform);if(m.thickness.value=d.thickness,d.thicknessMap)m.thicknessMap.value=d.thicknessMap,n(d.thicknessMap,m.thicknessMapTransform);m.attenuationDistance.value=d.attenuationDistance,m.attenuationColor.value.copy(d.attenuationColor)}if(d.anisotropy>0){if(m.anisotropyVector.value.set(d.anisotropy*Math.cos(d.anisotropyRotation),d.anisotropy*Math.sin(d.anisotropyRotation)),d.anisotropyMap)m.anisotropyMap.value=d.anisotropyMap,n(d.anisotropyMap,m.anisotropyMapTransform)}if(m.specularIntensity.value=d.specularIntensity,m.specularColor.value.copy(d.specularColor),d.specularColorMap)m.specularColorMap.value=d.specularColorMap,n(d.specularColorMap,m.specularColorMapTransform);if(d.specularIntensityMap)m.specularIntensityMap.value=d.specularIntensityMap,n(d.specularIntensityMap,m.specularIntensityMapTransform)}function g(m,d){if(d.matcap)m.matcap.value=d.matcap}function y(m,d){let b=t.get(d).light;m.referencePosition.value.setFromMatrixPosition(b.matrixWorld),m.nearDistance.value=b.shadow.camera.near,m.farDistance.value=b.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function JM(e,t,n,i){let r={},s={},o=[],a=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function l(_,x){let w=x.program;i.uniformBlockBinding(_,w)}function c(_,x){let w=r[_.id];if(w===void 0)m(_),w=h(_),r[_.id]=w,_.addEventListener("dispose",b);let T=x.program;i.updateUBOMapping(_,T);let v=t.render.frame;if(s[_.id]!==v)u(_),s[_.id]=v}function h(_){let x=f();_.__bindingPointIndex=x;let w=e.createBuffer(),{__size:T,usage:v}=_;return e.bindBuffer(e.UNIFORM_BUFFER,w),e.bufferData(e.UNIFORM_BUFFER,T,v),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,x,w),w}function f(){for(let _=0;_<a;_++)if(o.indexOf(_)===-1)return o.push(_),_;return De("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(_){let x=r[_.id],{uniforms:w,__cache:T}=_;e.bindBuffer(e.UNIFORM_BUFFER,x);for(let v=0,A=w.length;v<A;v++){let N=w[v];if(Array.isArray(N))for(let P=0,D=N.length;P<D;P++)p(N[P],v,P,T);else p(N,v,0,T)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(_,x,w,T){if(y(_,x,w,T)===!0){let{__offset:v,value:A}=_;if(Array.isArray(A)){let N=0;for(let P=0;P<A.length;P++){let D=A[P],W=d(D);if(g(D,_.__data,N),typeof D!=="number"&&typeof D!=="boolean"&&!D.isMatrix3&&!ArrayBuffer.isView(D))N+=W.storage/Float32Array.BYTES_PER_ELEMENT}}else g(A,_.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,v,_.__data)}}function g(_,x,w){if(typeof _==="number"||typeof _==="boolean")x[0]=_;else if(_.isMatrix3)x[0]=_.elements[0],x[1]=_.elements[1],x[2]=_.elements[2],x[3]=0,x[4]=_.elements[3],x[5]=_.elements[4],x[6]=_.elements[5],x[7]=0,x[8]=_.elements[6],x[9]=_.elements[7],x[10]=_.elements[8],x[11]=0;else if(ArrayBuffer.isView(_))x.set(new _.constructor(_.buffer,_.byteOffset,x.length));else _.toArray(x,w)}function y(_,x,w,T){let v=_.value,A=x+"_"+w;if(T[A]===void 0){if(typeof v==="number"||typeof v==="boolean")T[A]=v;else if(ArrayBuffer.isView(v))T[A]=v.slice();else T[A]=v.clone();return!0}else{let N=T[A];if(typeof v==="number"||typeof v==="boolean"){if(N!==v)return T[A]=v,!0}else if(ArrayBuffer.isView(v))return!0;else if(N.equals(v)===!1)return N.copy(v),!0}return!1}function m(_){let x=_.uniforms,w=0,T=16;for(let A=0,N=x.length;A<N;A++){let P=Array.isArray(x[A])?x[A]:[x[A]];for(let D=0,W=P.length;D<W;D++){let R=P[D],I=Array.isArray(R.value)?R.value:[R.value];for(let k=0,z=I.length;k<z;k++){let te=I[k],Y=d(te),Q=w%T,G=Q%Y.boundary,ee=Q+G;if(w+=G,ee!==0&&T-ee<Y.storage)w+=T-ee;R.__data=new Float32Array(Y.storage/Float32Array.BYTES_PER_ELEMENT),R.__offset=w,w+=Y.storage}}}let v=w%T;if(v>0)w+=T-v;return _.__size=w,_.__cache={},this}function d(_){let x={boundary:0,storage:0};if(typeof _==="number"||typeof _==="boolean")x.boundary=4,x.storage=4;else if(_.isVector2)x.boundary=8,x.storage=8;else if(_.isVector3||_.isColor)x.boundary=16,x.storage=12;else if(_.isVector4)x.boundary=16,x.storage=16;else if(_.isMatrix3)x.boundary=48,x.storage=48;else if(_.isMatrix4)x.boundary=64,x.storage=64;else if(_.isTexture)Ie("WebGLRenderer: Texture samplers can not be part of an uniforms group.");else if(ArrayBuffer.isView(_))x.boundary=16,x.storage=_.byteLength;else Ie("WebGLRenderer: Unsupported uniform value type.",_);return x}function b(_){let x=_.target;x.removeEventListener("dispose",b);let w=o.indexOf(x.__bindingPointIndex);o.splice(w,1),e.deleteBuffer(r[x.id]),delete r[x.id],delete s[x.id]}function S(){for(let _ in r)e.deleteBuffer(r[_]);o=[],r={},s={}}return{bind:l,update:c,dispose:S}}var KM=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Gn=null;function QM(){if(Gn===null)Gn=new Yc(KM,16,16,Gi,bn),Gn.name="DFG_LUT",Gn.minFilter=on,Gn.magFilter=on,Gn.wrapS=Go,Gn.wrapT=Go,Gn.generateMipmaps=!1,Gn.needsUpdate=!0;return Gn}class Oh{constructor(e={}){let{canvas:t=pm(),context:n=null,depth:i=!0,stencil:r=!1,alpha:s=!1,antialias:o=!1,premultipliedAlpha:a=!0,preserveDrawingBuffer:l=!1,powerPreference:c="default",failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:f=!1,outputBufferType:u=Rn}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=s;let g=u,y=new Set([ac,oc,sc]),m=new Set([Rn,_i,_s,Ir,ic,rc]),d=new Uint32Array(4),b=new Int32Array(4),S=new L,_=null,x=null,w=[],T=[],v=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Cn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let A=this,N=!1,P=null,D=null,W=null,R=null;this._outputColorSpace=Lr;let I=0,k=0,z=null,te=-1,Y=null,Q=new gt,G=new gt,ee=null,oe=new ke(0),Ue=0,{width:Re,height:X}=t,re=1,le=null,Pe=null,Oe=new gt(0,0,Re,X),Ae=new gt(0,0,Re,X),Et=!1,Xe=new Ss,je=!1,rt=!1,Ye=new Ke,Ut=new L,dt=new gt,en={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Tt=!1;function At(){return z===null?re:1}let U=n;function tn(E,F){return t.getContext(E,F)}let tt,yt,C,M,O,q,ie,ce,fe,Z,K,ve,Te,de,ae,Ce,Le,Je,B,he,J,ue,ye;try{let E={alpha:!0,depth:i,stencil:r,antialias:o,premultipliedAlpha:a,preserveDrawingBuffer:l,powerPreference:c,failIfMajorPerformanceCaveat:h};if("setAttribute"in t)t.setAttribute("data-engine",`three.js r${Bo}`);if(t.addEventListener("webglcontextlost",Be,!1),t.addEventListener("webglcontextrestored",ut,!1),t.addEventListener("webglcontextcreationerror",nt,!1),U===null){if(U=tn("webgl2",E),U===null)if(tn("webgl2"))throw Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.");else throw Error("THREE.WebGLRenderer: Error creating WebGL context.")}ne()}catch(E){throw t.removeEventListener("webglcontextlost",Be,!1),t.removeEventListener("webglcontextrestored",ut,!1),t.removeEventListener("webglcontextcreationerror",nt,!1),De("WebGLRenderer: "+E.message),E}function ne(){if(tt=new oS(U),tt.init(),J=new qM(U,tt),yt=new Zb(U,tt,e,J),C=new WM(U,tt),yt.reversedDepthBuffer&&f)C.buffers.depth.setReversed(!0);D=U.createFramebuffer(),W=U.createFramebuffer(),R=U.createFramebuffer(),M=new cS(U),O=new PM,q=new XM(U,tt,C,O,yt,J,M),ie=new sS(A),ce=new uy(U),ue=new Yb(U,ce),fe=new aS(U,ce,M,ue),Z=new uS(U,fe,ce,ue,M),Je=new hS(U,yt,q),ae=new Jb(O),K=new RM(A,ie,tt,yt,ue,ae),ve=new ZM(A,O),Te=new LM,de=new BM(tt),Le=new jb(A,ie,C,Z,p,a),Ce=new VM(A,Z,yt),ye=new JM(U,M,yt,C),B=new $b(U,tt,M),he=new lS(U,tt,M),M.programs=K.programs,A.capabilities=yt,A.extensions=tt,A.properties=O,A.renderLists=Te,A.shadowMap=Ce,A.state=C,A.info=M}if(g!==Rn)v=new dS(g,t.width,t.height,o,i,r);let me=new ig(A,U);this.xr=me,this.getContext=function(){return U},this.getContextAttributes=function(){return U.getContextAttributes()},this.forceContextLoss=function(){let E=tt.get("WEBGL_lose_context");if(E)E.loseContext()},this.forceContextRestore=function(){let E=tt.get("WEBGL_lose_context");if(E)E.restoreContext()},this.getPixelRatio=function(){return re},this.setPixelRatio=function(E){if(E===void 0)return;re=E,this.setSize(Re,X,!1)},this.getSize=function(E){return E.set(Re,X)},this.setSize=function(E,F,j=!0){if(me.isPresenting){Ie("WebGLRenderer: Can't change size while VR device is presenting.");return}if(Re=E,X=F,t.width=Math.floor(E*re),t.height=Math.floor(F*re),j===!0)t.style.width=E+"px",t.style.height=F+"px";if(v!==null)v.setSize(t.width,t.height);this.setViewport(0,0,E,F)},this.getDrawingBufferSize=function(E){return E.set(Re*re,X*re).floor()},this.setDrawingBufferSize=function(E,F,j){Re=E,X=F,re=j,t.width=Math.floor(E*j),t.height=Math.floor(F*j),this.setViewport(0,0,E,F)},this.setEffects=function(E){if(g===Rn){De("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(E){for(let F=0;F<E.length;F++)if(E[F].isOutputPass===!0){Ie("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}v.setEffects(E||[])},this.getCurrentViewport=function(E){return E.copy(Q)},this.getViewport=function(E){return E.copy(Oe)},this.setViewport=function(E,F,j,H){if(E.isVector4)Oe.set(E.x,E.y,E.z,E.w);else Oe.set(E,F,j,H);C.viewport(Q.copy(Oe).multiplyScalar(re).round())},this.getScissor=function(E){return E.copy(Ae)},this.setScissor=function(E,F,j,H){if(E.isVector4)Ae.set(E.x,E.y,E.z,E.w);else Ae.set(E,F,j,H);C.scissor(G.copy(Ae).multiplyScalar(re).round())},this.getScissorTest=function(){return Et},this.setScissorTest=function(E){C.setScissorTest(Et=E)},this.setOpaqueSort=function(E){le=E},this.setTransparentSort=function(E){Pe=E},this.getClearColor=function(E){return E.copy(Le.getClearColor())},this.setClearColor=function(){Le.setClearColor(...arguments)},this.getClearAlpha=function(){return Le.getClearAlpha()},this.setClearAlpha=function(){Le.setClearAlpha(...arguments)},this.clear=function(E=!0,F=!0,j=!0){let H=0;if(E){let V=!1;if(z!==null){let _e=z.texture.format;V=y.has(_e)}if(V){let _e=z.texture.type,be=m.has(_e),ge=Le.getClearColor(),Se=Le.getClearAlpha(),{r:we,g:Ge,b:We}=ge;if(be)d[0]=we,d[1]=Ge,d[2]=We,d[3]=Se,U.clearBufferuiv(U.COLOR,0,d);else b[0]=we,b[1]=Ge,b[2]=We,b[3]=Se,U.clearBufferiv(U.COLOR,0,b)}else H|=U.COLOR_BUFFER_BIT}if(F)H|=U.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0);if(j)H|=U.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295);if(H!==0)U.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(E){E.setRenderer(this),P=E},this.dispose=function(){t.removeEventListener("webglcontextlost",Be,!1),t.removeEventListener("webglcontextrestored",ut,!1),t.removeEventListener("webglcontextcreationerror",nt,!1),Le.dispose(),Te.dispose(),de.dispose(),O.dispose(),ie.dispose(),Z.dispose(),ue.dispose(),ye.dispose(),K.dispose(),me.dispose(),me.removeEventListener("sessionstart",Rd),me.removeEventListener("sessionend",Pd),Ii.stop()};function Be(E){E.preventDefault(),us("WebGLRenderer: Context Lost."),N=!0}function ut(){us("WebGLRenderer: Context Restored."),N=!1;let E=M.autoReset,F=Ce.enabled,j=Ce.autoUpdate,H=Ce.needsUpdate,V=Ce.type;ne(),M.autoReset=E,Ce.enabled=F,Ce.autoUpdate=j,Ce.needsUpdate=H,Ce.type=V}function nt(E){De("WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function Nn(E){let F=E.target;F.removeEventListener("dispose",Nn),qn(F)}function qn(E){j0(E),O.remove(E)}function j0(E){let F=O.get(E).programs;if(F!==void 0){if(F.forEach(function(j){K.releaseProgram(j)}),E.isShaderMaterial)K.releaseShaderCache(E)}}this.renderBufferDirect=function(E,F,j,H,V,_e){if(F===null)F=en;let be=V.isMesh&&V.matrixWorld.determinantAffine()<0,ge=Z0(E,F,j,H,V);C.setMaterial(H,be);let Se=j.index,we=1;if(H.wireframe===!0){if(Se=fe.getWireframeAttribute(j),Se===void 0)return;we=2}let Ge=j.drawRange,We=j.attributes.position,Me=Ge.start*we,it=(Ge.start+Ge.count)*we;if(_e!==null)Me=Math.max(Me,_e.start*we),it=Math.min(it,(_e.start+_e.count)*we);if(Se!==null)Me=Math.max(Me,0),it=Math.min(it,Se.count);else if(We!==void 0&&We!==null)Me=Math.max(Me,0),it=Math.min(it,We.count);let Mt=it-Me;if(Mt<0||Mt===1/0)return;ue.setup(V,H,ge,j,Se);let pt,ct=B;if(Se!==null)pt=ce.get(Se),ct=he,ct.setIndex(pt);if(V.isMesh)if(H.wireframe===!0)C.setLineWidth(H.wireframeLinewidth*At()),ct.setMode(U.LINES);else ct.setMode(U.TRIANGLES);else if(V.isLine){let zt=H.linewidth;if(zt===void 0)zt=1;if(C.setLineWidth(zt*At()),V.isLineSegments)ct.setMode(U.LINES);else if(V.isLineLoop)ct.setMode(U.LINE_LOOP);else ct.setMode(U.LINE_STRIP)}else if(V.isPoints)ct.setMode(U.POINTS);else if(V.isSprite)ct.setMode(U.TRIANGLES);if(V.isBatchedMesh)if(!tt.get("WEBGL_multi_draw")){let{_multiDrawStarts:zt,_multiDrawCounts:xe,_multiDrawCount:jt}=V,Ze=Se?ce.get(Se).bytesPerElement:1,_n=O.get(H).currentProgram.getUniforms();for(let On=0;On<jt;On++)_n.setValue(U,"_gl_DrawID",On),ct.render(zt[On]/Ze,xe[On])}else ct.renderMultiDraw(V._multiDrawStarts,V._multiDrawCounts,V._multiDrawCount);else if(V.isInstancedMesh)ct.renderInstances(Me,Mt,V.count);else if(j.isInstancedBufferGeometry){let zt=j._maxInstanceCount!==void 0?j._maxInstanceCount:1/0,xe=Math.min(j.instanceCount,zt);ct.renderInstances(Me,Mt,xe)}else ct.render(Me,Mt)};function Cd(E,F,j,H){if(P!==null&&E.isNodeMaterial)P.setObject(H,E);if(je===!0)ae.setState(E,j,!1);if(E.transparent===!0&&E.side===Fn&&E.forceSinglePass===!1)E.side=Vt,E.needsUpdate=!0,co(E,F,H),E.side=Cr,E.needsUpdate=!0,co(E,F,H),E.side=Fn;else co(E,F,H)}this.compile=function(E,F,j=null){if(j===null)j=E;if(P!==null)P.renderStart(E,F,j);if(x=de.get(j),x.init(F),T.push(x),j.traverseVisible(function(V){if(V.isLight&&V.layers.test(F.layers)){if(x.pushLight(V),V.castShadow)x.pushShadow(V)}}),E!==j)E.traverseVisible(function(V){if(V.isLight&&V.layers.test(F.layers)){if(x.pushLight(V),V.castShadow)x.pushShadow(V)}});if(x.setupLights(),P!==null)P.updateLights(x.state.lightsArray);if(rt=this.localClippingEnabled,je=ae.init(this.clippingPlanes,rt),je===!0)ae.setGlobalState(this.clippingPlanes,F);if(P!==null)Ce.render(x.state.shadowsArray,j,F);let H=new Set;if(E.traverse(function(V){if(!(V.isMesh||V.isPoints||V.isLine||V.isSprite))return;let _e=V.material;if(_e)if(Array.isArray(_e))for(let be=0;be<_e.length;be++){let ge=_e[be];Cd(ge,j,F,V),H.add(ge)}else Cd(_e,j,F,V),H.add(_e)}),x=T.pop(),P!==null)P.renderEnd();return H},this.compileAsync=function(E,F,j=null){let H=this.compile(E,F,j);return new Promise((V)=>{function _e(){if(H.forEach(function(be){let Se=O.get(be).currentProgram;if(Se===void 0||Se.isReady())H.delete(be)}),H.size===0){V(E);return}setTimeout(_e,10)}if(tt.get("KHR_parallel_shader_compile")!==null)_e();else setTimeout(_e,10)})};let ml=null;function Y0(E){if(ml)ml(E)}function Rd(){Ii.stop()}function Pd(){Ii.start()}let Ii=new Xm;if(Ii.setAnimationLoop(Y0),typeof self<"u")Ii.setContext(self);this.setAnimationLoop=function(E){ml=E,me.setAnimationLoop(E),E===null?Ii.stop():Ii.start()},me.addEventListener("sessionstart",Rd),me.addEventListener("sessionend",Pd),this.render=function(E,F){if(F!==void 0&&F.isCamera!==!0){De("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(N===!0)return;if(P!==null)P.renderStart(E,F);let j=me.enabled===!0&&me.isPresenting===!0,H=v!==null&&(z===null||j)&&v.begin(A,z);if(E.matrixWorldAutoUpdate===!0)E.updateMatrixWorld();if(F.parent===null&&F.matrixWorldAutoUpdate===!0)F.updateMatrixWorld();if(me.enabled===!0&&me.isPresenting===!0&&(v===null||v.isCompositing()===!1)){if(me.cameraAutoUpdate===!0)me.updateCamera(F);F=me.getCamera()}if(E.isScene===!0)E.onBeforeRender(A,E,F,z);if(x=de.get(E,T.length),x.init(F),x.state.textureUnits=q.getTextureUnits(),T.push(x),Ye.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),Xe.setFromProjectionMatrix(Ye,Hc,F.reversedDepth),rt=this.localClippingEnabled,je=ae.init(this.clippingPlanes,rt),_=Te.get(E,w.length),_.init(),w.push(_),me.enabled===!0&&me.isPresenting===!0){let be=A.xr.getDepthSensingMesh();if(be!==null)gl(be,F,-1/0,A.sortObjects)}if(gl(E,F,0,A.sortObjects),_.finish(),P!==null)P.updateLights(x.state.lightsArray);if(A.sortObjects===!0)_.sort(le,Pe);if(Tt=me.enabled===!1||me.isPresenting===!1||me.hasDepthSensing()===!1,Tt)Le.addToRenderList(_,E);if(this.info.render.frame++,this.info.autoReset===!0)this.info.reset();if(je===!0)ae.beginShadows();let V=x.state.shadowsArray;if(Ce.render(V,E,F),je===!0)ae.endShadows();if((H&&v.hasRenderPass())===!1){let be=_.opaque,ge=_.transmissive;if(x.setupLights(),F.isArrayCamera){let Se=F.cameras;if(ge.length>0)for(let we=0,Ge=Se.length;we<Ge;we++){let We=Se[we];Ld(be,ge,E,We)}if(Tt)Le.render(E);for(let we=0,Ge=Se.length;we<Ge;we++){let We=Se[we];Id(_,E,We,We.viewport)}}else{if(ge.length>0)Ld(be,ge,E,F);if(Tt)Le.render(E);Id(_,E,F)}}if(z!==null&&k===0)q.updateMultisampleRenderTarget(z),q.updateRenderTargetMipmap(z);if(H)v.end(A);if(E.isScene===!0)E.onAfterRender(A,E,F);if(ue.resetDefaultState(),te=-1,Y=null,T.pop(),T.length>0){if(x=T[T.length-1],q.setTextureUnits(x.state.textureUnits),je===!0)ae.setGlobalState(A.clippingPlanes,x.state.camera)}else x=null;if(w.pop(),w.length>0)_=w[w.length-1];else _=null;if(P!==null)P.renderEnd()};function gl(E,F,j,H){if(E.visible===!1)return;if(E.layers.test(F.layers)){if(E.isGroup)j=E.renderOrder;else if(E.isLOD){if(E.autoUpdate===!0)E.update(F)}else if(E.isLightProbeGrid)x.pushLightProbeGrid(E);else if(E.isLight){if(x.pushLight(E),E.castShadow)x.pushShadow(E)}else if(E.isSprite){if(!E.frustumCulled||E.intersectsFrustum(Xe)){if(H)dt.setFromMatrixPosition(E.matrixWorld).applyMatrix4(Ye);let be=Z.update(E),ge=E.material;if(ge.visible)_.push(E,be,ge,j,dt.z,null,F)}}else if(E.isMesh||E.isLine||E.isPoints){if(!E.frustumCulled||E.intersectsFrustum(Xe)){let be=Z.update(E),ge=E.material;if(H){if(E.boundingSphere!==void 0){if(E.boundingSphere===null)E.computeBoundingSphere();dt.copy(E.boundingSphere.center)}else{if(be.boundingSphere===null)be.computeBoundingSphere();dt.copy(be.boundingSphere.center)}dt.applyMatrix4(E.matrixWorld).applyMatrix4(Ye)}if(Array.isArray(ge)){let Se=be.groups;for(let we=0,Ge=Se.length;we<Ge;we++){let We=Se[we],Me=ge[We.materialIndex];if(Me&&Me.visible)_.push(E,be,Me,j,dt.z,We,F)}}else if(ge.visible)_.push(E,be,ge,j,dt.z,null,F)}}}let _e=E.children;for(let be=0,ge=_e.length;be<ge;be++)gl(_e[be],F,j,H)}function Id(E,F,j,H){let{opaque:V,transmissive:_e,transparent:be}=E;if(x.setupLightsView(j),je===!0)ae.setGlobalState(A.clippingPlanes,j);if(H)C.viewport(Q.copy(H));if(V.length>0)lo(V,F,j);if(_e.length>0)lo(_e,F,j);if(be.length>0)lo(be,F,j);C.buffers.depth.setTest(!0),C.buffers.depth.setMask(!0),C.buffers.color.setMask(!0),C.setPolygonOffset(!1)}function Ld(E,F,j,H){if((j.isScene===!0?j.overrideMaterial:null)!==null)return;if(x.state.transmissionRenderTarget[H.id]===void 0){let Me=tt.has("EXT_color_buffer_half_float")||tt.has("EXT_color_buffer_float");x.state.transmissionRenderTarget[H.id]=new Zt(1,1,{generateMipmaps:!0,type:Me?bn:Rn,minFilter:Bi,samples:Math.max(4,yt.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:qe.workingColorSpace})}let _e=x.state.transmissionRenderTarget[H.id],be=H.viewport||Q;_e.setSize(be.z*A.transmissionResolutionScale,be.w*A.transmissionResolutionScale);let ge=A.getRenderTarget(),Se=A.getActiveCubeFace(),we=A.getActiveMipmapLevel();if(A.setRenderTarget(_e),A.getClearColor(oe),Ue=A.getClearAlpha(),Ue<1)A.setClearColor(16777215,0.5);if(A.clear(),Tt)Le.render(j);let Ge=A.toneMapping;A.toneMapping=Cn;let We=H.viewport;if(H.viewport!==void 0)H.viewport=void 0;if(x.setupLightsView(H),je===!0)ae.setGlobalState(A.clippingPlanes,H);if(lo(E,j,H),q.updateMultisampleRenderTarget(_e),q.updateRenderTargetMipmap(_e),tt.has("WEBGL_multisampled_render_to_texture")===!1){let Me=!1;for(let it=0,Mt=F.length;it<Mt;it++){let pt=F[it],{object:ct,geometry:zt,material:xe,group:jt}=pt;if(xe.side===Fn&&ct.layers.test(H.layers)){let Ze=xe.side;xe.side=Vt,xe.needsUpdate=!0,Dd(ct,j,H,zt,xe,jt),xe.side=Ze,xe.needsUpdate=!0,Me=!0}}if(Me===!0)q.updateMultisampleRenderTarget(_e),q.updateRenderTargetMipmap(_e)}if(A.setRenderTarget(ge,Se,we),A.setClearColor(oe,Ue),We!==void 0)H.viewport=We;A.toneMapping=Ge}function lo(E,F,j){let H=F.isScene===!0?F.overrideMaterial:null;for(let V=0,_e=E.length;V<_e;V++){let be=E[V],{object:ge,geometry:Se,group:we}=be,Ge=be.material;if(Ge.allowOverride===!0&&H!==null)Ge=H;if(ge.layers.test(j.layers))Dd(ge,F,j,Se,Ge,we)}}function Dd(E,F,j,H,V,_e){if(P!==null&&V.isNodeMaterial)P.setObject(E,V);if(E.onBeforeRender(A,F,j,H,V,_e),E.modelViewMatrix.multiplyMatrices(j.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),V.onBeforeRender(A,F,j,H,E,_e),V.transparent===!0&&V.side===Fn&&V.forceSinglePass===!1)V.side=Vt,V.needsUpdate=!0,A.renderBufferDirect(j,F,H,V,E,_e),V.side=Cr,V.needsUpdate=!0,A.renderBufferDirect(j,F,H,V,E,_e),V.side=Fn;else A.renderBufferDirect(j,F,H,V,E,_e);E.onAfterRender(A,F,j,H,V,_e)}function co(E,F,j){if(F.isScene!==!0)F=en;let H=O.get(E),V=x.state.lights,_e=x.state.shadowsArray,be=V.state.version,ge=K.getParameters(E,V.state,_e,F,j,x.state.lightProbeGridArray),Se=K.getProgramCacheKey(ge),we=H.programs;H.environment=E.isMeshStandardMaterial||E.isMeshLambertMaterial||E.isMeshPhongMaterial?F.environment:null,H.fog=F.fog;let Ge=E.isMeshStandardMaterial||E.isMeshLambertMaterial&&!E.envMap||E.isMeshPhongMaterial&&!E.envMap;if(H.envMap=ie.get(E.envMap||H.environment,Ge),H.envMapRotation=H.environment!==null&&E.envMap===null?F.environmentRotation:E.envMapRotation,we===void 0)E.addEventListener("dispose",Nn),we=new Map,H.programs=we;let We=we.get(Se);if(We!==void 0){if(H.currentProgram===We&&H.lightsStateVersion===be)return Od(E,ge),We}else{if(ge.uniforms=K.getUniforms(E),P!==null&&E.isNodeMaterial)P.build(E,j,ge);E.onBeforeCompile(ge,A),We=K.acquireProgram(ge,Se),we.set(Se,We),H.uniforms=ge.uniforms}let Me=H.uniforms;if(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)Me.clippingPlanes=ae.uniform;if(Od(E,ge),H.needsLights=K0(E),H.lightsStateVersion=be,H.needsLights)Me.ambientLightColor.value=V.state.ambient,Me.lightProbe.value=V.state.probe,Me.sunLights.value=V.state.sun,Me.sunLightShadows.value=V.state.sunShadow,Me.directionalLights.value=V.state.directional,Me.directionalLightShadows.value=V.state.directionalShadow,Me.spotLights.value=V.state.spot,Me.spotLightShadows.value=V.state.spotShadow,Me.rectAreaLights.value=V.state.rectArea,Me.ltc_1.value=V.state.rectAreaLTC1,Me.ltc_2.value=V.state.rectAreaLTC2,Me.pointLights.value=V.state.point,Me.pointLightShadows.value=V.state.pointShadow,Me.hemisphereLights.value=V.state.hemi,Me.sunShadowMatrix.value=V.state.sunShadowMatrix,Me.sunShadowCascade.value=V.state.sunShadowCascade,Me.directionalShadowMatrix.value=V.state.directionalShadowMatrix,Me.spotLightMatrix.value=V.state.spotLightMatrix,Me.spotLightMap.value=V.state.spotLightMap,Me.pointShadowMatrix.value=V.state.pointShadowMatrix;return H.lightProbeGrid=x.state.lightProbeGridArray.length>0,H.currentProgram=We,H.uniformsList=null,We}function Nd(E){if(E.uniformsList===null){let F=E.currentProgram.getUniforms();E.uniformsList=Ds.seqWithValue(F.seq,E.uniforms)}return E.uniformsList}function Od(E,F){let j=O.get(E);j.outputColorSpace=F.outputColorSpace,j.batching=F.batching,j.batchingColor=F.batchingColor,j.instancing=F.instancing,j.instancingColor=F.instancingColor,j.instancingMorph=F.instancingMorph,j.skinning=F.skinning,j.morphTargets=F.morphTargets,j.morphNormals=F.morphNormals,j.morphColors=F.morphColors,j.morphTargetsCount=F.morphTargetsCount,j.numClippingPlanes=F.numClippingPlanes,j.numIntersection=F.numClipIntersection,j.vertexAlphas=F.vertexAlphas,j.vertexTangents=F.vertexTangents,j.toneMapping=F.toneMapping}function $0(E,F){if(E.length===0)return null;if(E.length===1)return E[0].texture!==null?E[0]:null;S.setFromMatrixPosition(F.matrixWorld);for(let j=0,H=E.length;j<H;j++){let V=E[j];if(V.texture!==null&&V.boundingBox.containsPoint(S))return V}return null}function Z0(E,F,j,H,V){if(F.isScene!==!0)F=en;q.resetTextureUnits();let _e=F.fog,be=H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial?F.environment:null,ge=z===null?A.outputColorSpace:z.isXRRenderTarget===!0?z.texture.colorSpace:qe.workingColorSpace,Se=H.isMeshStandardMaterial||H.isMeshLambertMaterial&&!H.envMap||H.isMeshPhongMaterial&&!H.envMap,we=ie.get(H.envMap||be,Se),Ge=H.vertexColors===!0&&!!j.attributes.color&&j.attributes.color.itemSize===4,We=!!j.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Me=!!j.morphAttributes.position,it=!!j.morphAttributes.normal,Mt=!!j.morphAttributes.color,pt=Cn;if(H.toneMapped){if(z===null||z.isXRRenderTarget===!0)pt=A.toneMapping}let ct=j.morphAttributes.position||j.morphAttributes.normal||j.morphAttributes.color,zt=ct!==void 0?ct.length:0,xe=O.get(H),jt=x.state.lights;if(je===!0){if(rt===!0||E!==Y){let ft=E===Y&&H.id===te;ae.setState(H,E,ft)}}let Ze=!1;if(H.version===xe.__version){if(xe.needsLights&&xe.lightsStateVersion!==jt.state.version)Ze=!0;else if(xe.outputColorSpace!==ge)Ze=!0;else if(V.isBatchedMesh&&xe.batching===!1)Ze=!0;else if(!V.isBatchedMesh&&xe.batching===!0)Ze=!0;else if(V.isBatchedMesh&&xe.batchingColor===!0&&V._colorsTexture===null)Ze=!0;else if(V.isBatchedMesh&&xe.batchingColor===!1&&V._colorsTexture!==null)Ze=!0;else if(V.isInstancedMesh&&xe.instancing===!1)Ze=!0;else if(!V.isInstancedMesh&&xe.instancing===!0)Ze=!0;else if(V.isSkinnedMesh&&xe.skinning===!1)Ze=!0;else if(!V.isSkinnedMesh&&xe.skinning===!0)Ze=!0;else if(V.isInstancedMesh&&xe.instancingColor===!0&&V.instanceColor===null)Ze=!0;else if(V.isInstancedMesh&&xe.instancingColor===!1&&V.instanceColor!==null)Ze=!0;else if(V.isInstancedMesh&&xe.instancingMorph===!0&&V.morphTexture===null)Ze=!0;else if(V.isInstancedMesh&&xe.instancingMorph===!1&&V.morphTexture!==null)Ze=!0;else if(xe.envMap!==we)Ze=!0;else if(H.fog===!0&&xe.fog!==_e)Ze=!0;else if(xe.numClippingPlanes!==void 0&&(xe.numClippingPlanes!==ae.numPlanes||xe.numIntersection!==ae.numIntersection))Ze=!0;else if(xe.vertexAlphas!==Ge)Ze=!0;else if(xe.vertexTangents!==We)Ze=!0;else if(xe.morphTargets!==Me)Ze=!0;else if(xe.morphNormals!==it)Ze=!0;else if(xe.morphColors!==Mt)Ze=!0;else if(xe.toneMapping!==pt)Ze=!0;else if(xe.morphTargetsCount!==zt)Ze=!0;else if(!!xe.lightProbeGrid!==x.state.lightProbeGridArray.length>0)Ze=!0}else Ze=!0,xe.__version=H.version;let _n=xe.currentProgram;if(Ze===!0){if(_n=co(H,F,V),P&&H.isNodeMaterial)P.onUpdateProgram(H,_n,xe)}let On=!1,li=!1,ir=!1,lt=_n.getUniforms(),bt=xe.uniforms;if(C.useProgram(_n.program))On=!0,li=!0,ir=!0;if(H.id!==te)te=H.id,li=!0;if(xe.needsLights){let ft=$0(x.state.lightProbeGridArray,V);if(xe.lightProbeGrid!==ft)xe.lightProbeGrid=ft,li=!0}if(On||Y!==E){if(C.buffers.depth.getReversed()&&E.reversedDepth!==!0)E._reversedDepth=!0,E.updateProjectionMatrix();lt.setValue(U,"projectionMatrix",E.projectionMatrix),lt.setValue(U,"viewMatrix",E.matrixWorldInverse);let hi=lt.map.cameraPosition;if(hi!==void 0)hi.setValue(U,Ut.setFromMatrixPosition(E.matrixWorld));if(yt.logarithmicDepthBuffer)lt.setValue(U,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2));if(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)lt.setValue(U,"isOrthographic",E.isOrthographicCamera===!0);if(Y!==E)Y=E,li=!0,ir=!0}if(xe.needsLights){if(jt.state.sunShadowMap.length>0)lt.setValue(U,"sunShadowMap",jt.state.sunShadowMap,q);if(jt.state.directionalShadowMap.length>0)lt.setValue(U,"directionalShadowMap",jt.state.directionalShadowMap,q);if(jt.state.spotShadowMap.length>0)lt.setValue(U,"spotShadowMap",jt.state.spotShadowMap,q);if(jt.state.pointShadowMap.length>0)lt.setValue(U,"pointShadowMap",jt.state.pointShadowMap,q)}if(V.isSkinnedMesh){lt.setOptional(U,V,"bindMatrix"),lt.setOptional(U,V,"bindMatrixInverse");let ft=V.skeleton;if(ft){if(ft.boneTexture===null)ft.computeBoneTexture();lt.setValue(U,"boneTexture",ft.boneTexture,q)}}if(V.isBatchedMesh){if(lt.setOptional(U,V,"batchingTexture"),lt.setValue(U,"batchingTexture",V._matricesTexture,q),lt.setOptional(U,V,"batchingIdTexture"),lt.setValue(U,"batchingIdTexture",V._indirectTexture,q),lt.setOptional(U,V,"batchingColorTexture"),V._colorsTexture!==null)lt.setValue(U,"batchingColorTexture",V._colorsTexture,q)}let ci=j.morphAttributes;if(ci.position!==void 0||ci.normal!==void 0||ci.color!==void 0)Je.update(V,j,_n);if(li||xe.receiveShadow!==V.receiveShadow)xe.receiveShadow=V.receiveShadow,lt.setValue(U,"receiveShadow",V.receiveShadow);if((H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial)&&H.envMap===null&&F.environment!==null)bt.envMapIntensity.value=F.environmentIntensity;if(bt.dfgLUT!==void 0)bt.dfgLUT.value=QM();if(li){if(lt.setValue(U,"toneMappingExposure",A.toneMappingExposure),xe.needsLights)J0(bt,ir);if(_e&&H.fog===!0)ve.refreshFogUniforms(bt,_e);if(ve.refreshMaterialUniforms(bt,H,re,X,x.state.transmissionRenderTarget[E.id]),xe.needsLights&&xe.lightProbeGrid){let ft=xe.lightProbeGrid;bt.probesSH.value=ft.texture,bt.probesMin.value.copy(ft.boundingBox.min),bt.probesMax.value.copy(ft.boundingBox.max),bt.probesResolution.value.copy(ft.resolution)}Ds.upload(U,Nd(xe),bt,q)}if(H.isShaderMaterial&&H.uniformsNeedUpdate===!0)Ds.upload(U,Nd(xe),bt,q),H.uniformsNeedUpdate=!1;if(H.isSpriteMaterial)lt.setValue(U,"center",V.center);if(lt.setValue(U,"modelViewMatrix",V.modelViewMatrix),lt.setValue(U,"normalMatrix",V.normalMatrix),lt.setValue(U,"modelMatrix",V.matrixWorld),H.uniformsGroups!==void 0){let ft=H.uniformsGroups;for(let hi=0,rr=ft.length;hi<rr;hi++){let Fd=ft[hi];ye.update(Fd,_n),ye.bind(Fd,_n)}}return _n}function J0(E,F){E.ambientLightColor.needsUpdate=F,E.lightProbe.needsUpdate=F,E.sunLights.needsUpdate=F,E.sunLightShadows.needsUpdate=F,E.directionalLights.needsUpdate=F,E.directionalLightShadows.needsUpdate=F,E.pointLights.needsUpdate=F,E.pointLightShadows.needsUpdate=F,E.spotLights.needsUpdate=F,E.spotLightShadows.needsUpdate=F,E.rectAreaLights.needsUpdate=F,E.hemisphereLights.needsUpdate=F}function K0(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return I},this.getActiveMipmapLevel=function(){return k},this.getRenderTarget=function(){return z},this.setRenderTargetTextures=function(E,F,j){let H=O.get(E);if(H.__autoAllocateDepthBuffer=E.resolveDepthBuffer===!1,H.__autoAllocateDepthBuffer===!1)H.__useRenderToTexture=!1;O.get(E.texture).__webglTexture=F,O.get(E.depthTexture).__webglTexture=H.__autoAllocateDepthBuffer?void 0:j,H.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(E,F){let j=O.get(E);j.__webglFramebuffer=F,j.__useDefaultFramebuffer=F===void 0},this.setRenderTarget=function(E,F=0,j=0){z=E,I=F,k=j;let H=null,V=!1,_e=!1;if(E){let ge=O.get(E);if(ge.__useDefaultFramebuffer!==void 0){C.bindFramebuffer(U.FRAMEBUFFER,ge.__webglFramebuffer),Q.copy(E.viewport),G.copy(E.scissor),ee=E.scissorTest,C.viewport(Q),C.scissor(G),C.setScissorTest(ee),te=-1;return}else if(ge.__webglFramebuffer===void 0)q.setupRenderTarget(E);else if(ge.__hasExternalTextures)q.rebindTextures(E,O.get(E.texture).__webglTexture,O.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){let Ge=E.depthTexture;if(ge.__boundDepthTexture!==Ge){if(Ge!==null&&O.has(Ge)&&(E.width!==Ge.image.width||E.height!==Ge.image.height))throw Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");q.setupDepthRenderbuffer(E)}}let Se=E.texture;if(Se.isData3DTexture||Se.isDataArrayTexture||Se.isCompressedArrayTexture)_e=!0;let we=O.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget){if(Array.isArray(we[F]))H=we[F][j];else H=we[F];V=!0}else if(E.samples>0&&q.useMultisampledRTT(E)===!1)H=O.get(E).__webglMultisampledFramebuffer;else if(Array.isArray(we))H=we[j];else H=we;Q.copy(E.viewport),G.copy(E.scissor),ee=E.scissorTest}else Q.copy(Oe).multiplyScalar(re).floor(),G.copy(Ae).multiplyScalar(re).floor(),ee=Et;if(j!==0)H=D;if(C.bindFramebuffer(U.FRAMEBUFFER,H))C.drawBuffers(E,H);if(C.viewport(Q),C.scissor(G),C.setScissorTest(ee),V){let ge=O.get(E.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_CUBE_MAP_POSITIVE_X+F,ge.__webglTexture,j)}else if(_e){let ge=F;for(let Se=0;Se<E.textures.length;Se++){let we=O.get(E.textures[Se]);U.framebufferTextureLayer(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0+Se,we.__webglTexture,j,ge)}}else if(E!==null&&j!==0){let ge=O.get(E.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,ge.__webglTexture,j)}te=-1};function Ud(E){let F=O.get(E);if(F.__readFormat!==E.format||F.__readType!==E.type)F.__readFormat=E.format,F.__readType=E.type,F.__formatReadable=yt.textureFormatReadable(E.format),F.__typeReadable=yt.textureTypeReadable(E.type);return F}if(this.readRenderTargetPixels=function(E,F,j,H,V,_e,be,ge=0){if(!(E&&E.isWebGLRenderTarget)){De("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Se=O.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&be!==void 0)Se=Se[be];if(Se){C.bindFramebuffer(U.FRAMEBUFFER,Se);try{let we=E.textures[ge],{format:Ge,type:We}=we;if(E.textures.length>1)U.readBuffer(U.COLOR_ATTACHMENT0+ge);let Me=Ud(we);if(Me.__formatReadable===!1){De("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Me.__typeReadable===!1){De("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}if(F>=0&&F<=E.width-H&&(j>=0&&j<=E.height-V))U.readPixels(F,j,H,V,J.convert(Ge),J.convert(We),_e)}finally{let we=z!==null?O.get(z).__webglFramebuffer:null;C.bindFramebuffer(U.FRAMEBUFFER,we)}}},this.readRenderTargetPixelsAsync=async function(E,F,j,H,V,_e,be,ge=0){if(!(E&&E.isWebGLRenderTarget))throw Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Se=O.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&be!==void 0)Se=Se[be];if(Se)if(F>=0&&F<=E.width-H&&(j>=0&&j<=E.height-V)){C.bindFramebuffer(U.FRAMEBUFFER,Se);let we=E.textures[ge],{format:Ge,type:We}=we;if(E.textures.length>1)U.readBuffer(U.COLOR_ATTACHMENT0+ge);let Me=Ud(we);if(Me.__formatReadable===!1)throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Me.__typeReadable===!1)throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let it=U.createBuffer();U.bindBuffer(U.PIXEL_PACK_BUFFER,it),U.bufferData(U.PIXEL_PACK_BUFFER,_e.byteLength,U.STREAM_READ),U.readPixels(F,j,H,V,J.convert(Ge),J.convert(We),0),U.bindBuffer(U.PIXEL_PACK_BUFFER,null);let Mt=z!==null?O.get(z).__webglFramebuffer:null;C.bindFramebuffer(U.FRAMEBUFFER,Mt);let pt=U.fenceSync(U.SYNC_GPU_COMMANDS_COMPLETE,0);return U.flush(),await gm(U,pt,4),U.bindBuffer(U.PIXEL_PACK_BUFFER,it),U.getBufferSubData(U.PIXEL_PACK_BUFFER,0,_e),U.bindBuffer(U.PIXEL_PACK_BUFFER,null),U.deleteBuffer(it),U.deleteSync(pt),_e}else throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(E,F=null,j=0){let H=Math.pow(2,-j),V=Math.floor(E.image.width*H),_e=Math.floor(E.image.height*H),be=F!==null?F.x:0,ge=F!==null?F.y:0;q.setTexture2D(E,0),U.copyTexSubImage2D(U.TEXTURE_2D,j,0,0,be,ge,V,_e),C.unbindTexture()},this.copyTextureToTexture=function(E,F,j=null,H=null,V=0,_e=0){let be,ge,Se,we,Ge,We,Me,it,Mt,pt=E.isCompressedTexture?E.mipmaps[_e]:E.image;if(j!==null)be=j.max.x-j.min.x,ge=j.max.y-j.min.y,Se=j.isBox3?j.max.z-j.min.z:1,we=j.min.x,Ge=j.min.y,We=j.isBox3?j.min.z:0;else{let bt=Math.pow(2,-V);if(be=Math.floor(pt.width*bt),ge=Math.floor(pt.height*bt),E.isDataArrayTexture)Se=pt.depth;else if(E.isData3DTexture)Se=Math.floor(pt.depth*bt);else Se=1;we=0,Ge=0,We=0}if(H!==null)Me=H.x,it=H.y,Mt=H.z;else Me=0,it=0,Mt=0;let ct=J.convert(F.format),zt=J.convert(F.type),xe;if(F.isData3DTexture)q.setTexture3D(F,0),xe=U.TEXTURE_3D;else if(F.isDataArrayTexture||F.isCompressedArrayTexture)q.setTexture2DArray(F,0),xe=U.TEXTURE_2D_ARRAY;else q.setTexture2D(F,0),xe=U.TEXTURE_2D;C.activeTexture(U.TEXTURE0),C.pixelStorei(U.UNPACK_FLIP_Y_WEBGL,F.flipY),C.pixelStorei(U.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),C.pixelStorei(U.UNPACK_ALIGNMENT,F.unpackAlignment);let jt=C.getParameter(U.UNPACK_ROW_LENGTH),Ze=C.getParameter(U.UNPACK_IMAGE_HEIGHT),_n=C.getParameter(U.UNPACK_SKIP_PIXELS),On=C.getParameter(U.UNPACK_SKIP_ROWS),li=C.getParameter(U.UNPACK_SKIP_IMAGES);C.pixelStorei(U.UNPACK_ROW_LENGTH,pt.width),C.pixelStorei(U.UNPACK_IMAGE_HEIGHT,pt.height),C.pixelStorei(U.UNPACK_SKIP_PIXELS,we),C.pixelStorei(U.UNPACK_SKIP_ROWS,Ge),C.pixelStorei(U.UNPACK_SKIP_IMAGES,We);let ir=E.isDataArrayTexture||E.isData3DTexture,lt=F.isDataArrayTexture||F.isData3DTexture;if(E.isDepthTexture){let bt=O.get(E),ci=O.get(F),ft=O.get(bt.__renderTarget),hi=O.get(ci.__renderTarget);C.bindFramebuffer(U.READ_FRAMEBUFFER,ft.__webglFramebuffer),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,hi.__webglFramebuffer);for(let rr=0;rr<Se;rr++){if(ir)U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,O.get(E).__webglTexture,V,We+rr),U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,O.get(F).__webglTexture,_e,Mt+rr);U.blitFramebuffer(we,Ge,be,ge,Me,it,be,ge,U.DEPTH_BUFFER_BIT,U.NEAREST)}C.bindFramebuffer(U.READ_FRAMEBUFFER,null),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else if(V!==0||E.isRenderTargetTexture||O.has(E)){let bt=O.get(E),ci=O.get(F);C.bindFramebuffer(U.READ_FRAMEBUFFER,W),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,R);for(let ft=0;ft<Se;ft++){if(ir)U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,bt.__webglTexture,V,We+ft);else U.framebufferTexture2D(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,bt.__webglTexture,V);if(lt)U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,ci.__webglTexture,_e,Mt+ft);else U.framebufferTexture2D(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,ci.__webglTexture,_e);if(V!==0)U.blitFramebuffer(we,Ge,be,ge,Me,it,be,ge,U.COLOR_BUFFER_BIT,U.NEAREST);else if(lt)U.copyTexSubImage3D(xe,_e,Me,it,Mt+ft,we,Ge,be,ge);else U.copyTexSubImage2D(xe,_e,Me,it,we,Ge,be,ge)}C.bindFramebuffer(U.READ_FRAMEBUFFER,null),C.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else if(lt)if(E.isDataTexture||E.isData3DTexture)U.texSubImage3D(xe,_e,Me,it,Mt,be,ge,Se,ct,zt,pt.data);else if(F.isCompressedArrayTexture)U.compressedTexSubImage3D(xe,_e,Me,it,Mt,be,ge,Se,ct,pt.data);else U.texSubImage3D(xe,_e,Me,it,Mt,be,ge,Se,ct,zt,pt);else if(E.isDataTexture)U.texSubImage2D(U.TEXTURE_2D,_e,Me,it,be,ge,ct,zt,pt.data);else if(E.isCompressedTexture)U.compressedTexSubImage2D(U.TEXTURE_2D,_e,Me,it,pt.width,pt.height,ct,pt.data);else U.texSubImage2D(U.TEXTURE_2D,_e,Me,it,be,ge,ct,zt,pt);if(C.pixelStorei(U.UNPACK_ROW_LENGTH,jt),C.pixelStorei(U.UNPACK_IMAGE_HEIGHT,Ze),C.pixelStorei(U.UNPACK_SKIP_PIXELS,_n),C.pixelStorei(U.UNPACK_SKIP_ROWS,On),C.pixelStorei(U.UNPACK_SKIP_IMAGES,li),_e===0&&F.generateMipmaps)U.generateMipmap(xe);C.unbindTexture()},this.initRenderTarget=function(E){if(O.get(E).__webglFramebuffer===void 0)q.setupRenderTarget(E)},this.initTexture=function(E){if(E.isCubeTexture)q.setTextureCube(E,0);else if(E.isData3DTexture)q.setTexture3D(E,0);else if(E.isDataArrayTexture||E.isCompressedArrayTexture)q.setTexture2DArray(E,0);else q.setTexture2D(E,0);C.unbindTexture()},this.resetState=function(){I=0,k=0,z=null,C.reset(),ue.reset()},typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Hc}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=qe._getDrawingBufferColorSpace(e),t.unpackColorSpace=qe._getUnpackColorSpace()}}var Wr=new rn,ri=new se,sg=new L,Uh=new se,ya=new se,xa=new L,Fh=new L,og=new Ke,ag=new L,lg=new L,Xt=null,Vn=null,si=[],vi={NONE:-1,PAN:0,ROTATE:1};class Bh extends zn{constructor(e,t,n=null){super(t,n);if(this.objects=e,this.recursive=!0,this.transformGroup=!1,this.rotateSpeed=1,this.raycaster=new zr,this.mouseButtons={LEFT:St.PAN,MIDDLE:St.PAN,RIGHT:St.ROTATE},this.touches={ONE:yn.PAN},this._onPointerMove=ew.bind(this),this._onPointerDown=tw.bind(this),this._onPointerCancel=nw.bind(this),this._onContextMenu=iw.bind(this),n!==null)this.connect(n)}connect(e){super.connect(e),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointerup",this._onPointerCancel),this.domElement.addEventListener("pointerleave",this._onPointerCancel),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointerup",this._onPointerCancel),this.domElement.removeEventListener("pointerleave",this._onPointerCancel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="",this.domElement.style.cursor=""}dispose(){this.disconnect()}_updatePointer(e){let t=this.domElement.getBoundingClientRect();ri.x=(e.clientX-t.left)/t.width*2-1,ri.y=-(e.clientY-t.top)/t.height*2+1}_updateState(e){let t;if(e.pointerType==="touch")t=this.touches.ONE;else switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=null}switch(t){case St.PAN:case yn.PAN:this.state=vi.PAN;break;case St.ROTATE:case yn.ROTATE:this.state=vi.ROTATE;break;default:this.state=vi.NONE}}}function ew(e){let t=this.object,n=this.domElement,i=this.raycaster;if(this.enabled===!1)return;if(this._updatePointer(e),i.setFromCamera(ri,t),Xt){if(this.state===vi.PAN){if(i.ray.intersectPlane(Wr,xa))Xt.position.copy(xa.sub(sg).applyMatrix4(og)),this.dispatchEvent({type:"drag",object:Xt})}else if(this.state===vi.ROTATE)Uh.subVectors(ri,ya).multiplyScalar(this.rotateSpeed),Xt.rotateOnWorldAxis(ag,Uh.x),Xt.rotateOnWorldAxis(lg.normalize(),-Uh.y),this.dispatchEvent({type:"drag",object:Xt});ya.copy(ri)}else if(e.pointerType==="mouse"||e.pointerType==="pen"){if(si.length=0,i.setFromCamera(ri,t),i.intersectObjects(this.objects,this.recursive,si),si.length>0){let r=si[0].object;if(Wr.setFromNormalAndCoplanarPoint(t.getWorldDirection(Wr.normal),Fh.setFromMatrixPosition(r.matrixWorld)),Vn!==r&&Vn!==null)this.dispatchEvent({type:"hoveroff",object:Vn}),n.style.cursor="auto",Vn=null;if(Vn!==r)this.dispatchEvent({type:"hoveron",object:r}),n.style.cursor="pointer",Vn=r}else if(Vn!==null)this.dispatchEvent({type:"hoveroff",object:Vn}),n.style.cursor="auto",Vn=null}ya.copy(ri)}function tw(e){let t=this.object,n=this.domElement,i=this.raycaster;if(this.enabled===!1)return;if(this._updatePointer(e),this._updateState(e),si.length=0,i.setFromCamera(ri,t),i.intersectObjects(this.objects,this.recursive,si),si.length>0){if(this.transformGroup===!0)Xt=cg(si[0].object);else Xt=si[0].object;if(Wr.setFromNormalAndCoplanarPoint(t.getWorldDirection(Wr.normal),Fh.setFromMatrixPosition(Xt.matrixWorld)),i.ray.intersectPlane(Wr,xa)){if(this.state===vi.PAN)og.copy(Xt.parent.matrixWorld).invert(),sg.copy(xa).sub(Fh.setFromMatrixPosition(Xt.matrixWorld)),n.style.cursor="move",this.dispatchEvent({type:"dragstart",object:Xt});else if(this.state===vi.ROTATE)ag.set(0,1,0).applyQuaternion(t.quaternion).normalize(),lg.set(1,0,0).applyQuaternion(t.quaternion).normalize(),n.style.cursor="move",this.dispatchEvent({type:"dragstart",object:Xt})}}ya.copy(ri)}function nw(){if(this.enabled===!1)return;if(Xt)this.dispatchEvent({type:"dragend",object:Xt}),Xt=null;this.domElement.style.cursor=Vn?"pointer":"auto",this.state=vi.NONE}function iw(e){if(this.enabled===!1)return;e.preventDefault()}function cg(e,t=null){if(e.isGroup)t=e;if(e.parent===null)return t;return cg(e.parent,t)}function ba(e,t,n){var i,r=1;if(e==null)e=0;if(t==null)t=0;if(n==null)n=0;function s(){var o,a=i.length,l,c=0,h=0,f=0;for(o=0;o<a;++o)l=i[o],c+=l.x||0,h+=l.y||0,f+=l.z||0;for(c=(c/a-e)*r,h=(h/a-t)*r,f=(f/a-n)*r,o=0;o<a;++o){if(l=i[o],c)l.x-=c;if(h)l.y-=h;if(f)l.z-=f}}return s.initialize=function(o){i=o},s.x=function(o){return arguments.length?(e=+o,s):e},s.y=function(o){return arguments.length?(t=+o,s):t},s.z=function(o){return arguments.length?(n=+o,s):n},s.strength=function(o){return arguments.length?(r=+o,s):r},s}function dn(e){return function(){return e}}function Mn(e){return(e()-0.5)*0.000001}function rw(e){return e.index}function hg(e,t){var n=e.get(t);if(!n)throw Error("node not found: "+t);return n}function Sa(e){var t=rw,n=u,i,r=dn(30),s,o,a,l,c,h,f=1;if(e==null)e=[];function u(d){return 1/Math.min(l[d.source.index],l[d.target.index])}function p(d){for(var b=0,S=e.length;b<f;++b)for(var _=0,x,w,T,v=0,A=0,N=0,P,D;_<S;++_){if(x=e[_],w=x.source,T=x.target,v=T.x+T.vx-w.x-w.vx||Mn(h),a>1)A=T.y+T.vy-w.y-w.vy||Mn(h);if(a>2)N=T.z+T.vz-w.z-w.vz||Mn(h);if(P=Math.sqrt(v*v+A*A+N*N),P=(P-s[_])/P*d*i[_],v*=P,A*=P,N*=P,T.vx-=v*(D=c[_]),a>1)T.vy-=A*D;if(a>2)T.vz-=N*D;if(w.vx+=v*(D=1-D),a>1)w.vy+=A*D;if(a>2)w.vz+=N*D}}function g(){if(!o)return;var d,b=o.length,S=e.length,_=new Map(o.map((w,T)=>[t(w,T,o),w])),x;for(d=0,l=Array(b);d<S;++d){if(x=e[d],x.index=d,typeof x.source!=="object")x.source=hg(_,x.source);if(typeof x.target!=="object")x.target=hg(_,x.target);l[x.source.index]=(l[x.source.index]||0)+1,l[x.target.index]=(l[x.target.index]||0)+1}for(d=0,c=Array(S);d<S;++d)x=e[d],c[d]=l[x.source.index]/(l[x.source.index]+l[x.target.index]);i=Array(S),y(),s=Array(S),m()}function y(){if(!o)return;for(var d=0,b=e.length;d<b;++d)i[d]=+n(e[d],d,e)}function m(){if(!o)return;for(var d=0,b=e.length;d<b;++d)s[d]=+r(e[d],d,e)}return p.initialize=function(d,...b){o=d,h=b.find((S)=>typeof S==="function")||Math.random,a=b.find((S)=>[1,2,3].includes(S))||2,g()},p.links=function(d){return arguments.length?(e=d,g(),p):e},p.id=function(d){return arguments.length?(t=d,p):t},p.iterations=function(d){return arguments.length?(f=+d,p):f},p.strength=function(d){return arguments.length?(n=typeof d==="function"?d:dn(+d),y(),p):n},p.distance=function(d){return arguments.length?(r=typeof d==="function"?d:dn(+d),m(),p):r},p}function kh(e){let t=+this._x.call(null,e);return ug(this.cover(t),t,e)}function ug(e,t,n){if(isNaN(t))return e;var i,r=e._root,s={data:n},{_x0:o,_x1:a}=e,l,c,h,f,u;if(!r)return e._root=s,e;while(r.length){if(h=t>=(l=(o+a)/2))o=l;else a=l;if(i=r,!(r=r[f=+h]))return i[f]=s,e}if(c=+e._x.call(null,r.data),t===c)return s.next=r,i?i[f]=s:e._root=s,e;do if(i=i?i[f]=[,,]:e._root=[,,],h=t>=(l=(o+a)/2))o=l;else a=l;while((f=+h)===(u=+(c>=l)));return i[u]=r,i[f]=s,e}function fg(e){if(!Array.isArray(e))e=Array.from(e);let t=e.length,n=new Float64Array(t),i=1/0,r=-1/0;for(let s=0,o;s<t;++s){if(isNaN(o=+this._x.call(null,e[s])))continue;if(n[s]=o,o<i)i=o;if(o>r)r=o}if(i>r)return this;this.cover(i).cover(r);for(let s=0;s<t;++s)ug(this,n[s],e[s]);return this}function zh(e){if(isNaN(e=+e))return this;var t=this._x0,n=this._x1;if(isNaN(t))n=(t=Math.floor(e))+1;else{var i=n-t||1,r=this._root,s,o;while(t>e||e>=n)switch(o=+(e<t),s=[,,],s[o]=r,r=s,i*=2,o){case 0:n=t+i;break;case 1:t=n-i;break}if(this._root&&this._root.length)this._root=r}return this._x0=t,this._x1=n,this}function Gh(){var e=[];return this.visit(function(t){if(!t.length)do e.push(t.data);while(t=t.next)}),e}function Hh(e){return arguments.length?this.cover(+e[0][0]).cover(+e[1][0]):isNaN(this._x0)?void 0:[[this._x0],[this._x1]]}function pn(e,t,n){this.node=e,this.x0=t,this.x1=n}function Vh(e,t){var n,i=this._x0,r,s,o=this._x1,a=[],l=this._root,c,h;if(l)a.push(new pn(l,i,o));if(t==null)t=1/0;else i=e-t,o=e+t;while(c=a.pop()){if(!(l=c.node)||(r=c.x0)>o||(s=c.x1)<i)continue;if(l.length){var f=(r+s)/2;if(a.push(new pn(l[1],f,s),new pn(l[0],r,f)),h=+(e>=f))c=a[a.length-1],a[a.length-1]=a[a.length-1-h],a[a.length-1-h]=c}else{var u=Math.abs(e-+this._x.call(null,l.data));if(u<t)t=u,i=e-u,o=e+u,n=l.data}}return n}function Wh(e){if(isNaN(l=+this._x.call(null,e)))return this;var t,n=this._root,i,r,s,o=this._x0,a=this._x1,l,c,h,f,u;if(!n)return this;if(n.length)while(!0){if(h=l>=(c=(o+a)/2))o=c;else a=c;if(t=n,!(n=n[f=+h]))return this;if(!n.length)break;if(t[f+1&1])i=t,u=f}while(n.data!==e)if(r=n,!(n=n.next))return this;if(s=n.next)delete n.next;if(r)return s?r.next=s:delete r.next,this;if(!t)return this._root=s,this;if(s?t[f]=s:delete t[f],(n=t[0]||t[1])&&n===(t[1]||t[0])&&!n.length)if(i)i[u]=n;else this._root=n;return this}function dg(e){for(var t=0,n=e.length;t<n;++t)this.remove(e[t]);return this}function Xh(){return this._root}function qh(){var e=0;return this.visit(function(t){if(!t.length)do++e;while(t=t.next)}),e}function jh(e){var t=[],n,i=this._root,r,s,o;if(i)t.push(new pn(i,this._x0,this._x1));while(n=t.pop())if(!e(i=n.node,s=n.x0,o=n.x1)&&i.length){var a=(s+o)/2;if(r=i[1])t.push(new pn(r,a,o));if(r=i[0])t.push(new pn(r,s,a))}return this}function Yh(e){var t=[],n=[],i;if(this._root)t.push(new pn(this._root,this._x0,this._x1));while(i=t.pop()){var r=i.node;if(r.length){var s,o=i.x0,a=i.x1,l=(o+a)/2;if(s=r[0])t.push(new pn(s,o,l));if(s=r[1])t.push(new pn(s,l,a))}n.push(i)}while(i=n.pop())e(i.node,i.x0,i.x1);return this}function pg(e){return e[0]}function $h(e){return arguments.length?(this._x=e,this):this._x}function Ns(e,t){var n=new Zh(t==null?pg:t,NaN,NaN);return e==null?n:n.addAll(e)}function Zh(e,t,n){this._x=e,this._x0=t,this._x1=n,this._root=void 0}function mg(e){var t={data:e.data},n=t;while(e=e.next)n=n.next={data:e.data};return t}var an=Ns.prototype=Zh.prototype;an.copy=function(){var e=new Zh(this._x,this._x0,this._x1),t=this._root,n,i;if(!t)return e;if(!t.length)return e._root=mg(t),e;n=[{source:t,target:e._root=[,,]}];while(t=n.pop())for(var r=0;r<2;++r)if(i=t.source[r])if(i.length)n.push({source:i,target:t.target[r]=[,,]});else t.target[r]=mg(i);return e};an.add=kh;an.addAll=fg;an.cover=zh;an.data=Gh;an.extent=Hh;an.find=Vh;an.remove=Wh;an.removeAll=dg;an.root=Xh;an.size=qh;an.visit=jh;an.visitAfter=Yh;an.x=$h;function Jh(e){let t=+this._x.call(null,e),n=+this._y.call(null,e);return gg(this.cover(t,n),t,n,e)}function gg(e,t,n,i){if(isNaN(t)||isNaN(n))return e;var r,s=e._root,o={data:i},{_x0:a,_y0:l,_x1:c,_y1:h}=e,f,u,p,g,y,m,d,b;if(!s)return e._root=o,e;while(s.length){if(y=t>=(f=(a+c)/2))a=f;else c=f;if(m=n>=(u=(l+h)/2))l=u;else h=u;if(r=s,!(s=s[d=m<<1|y]))return r[d]=o,e}if(p=+e._x.call(null,s.data),g=+e._y.call(null,s.data),t===p&&n===g)return o.next=s,r?r[d]=o:e._root=o,e;do{if(r=r?r[d]=[,,,,]:e._root=[,,,,],y=t>=(f=(a+c)/2))a=f;else c=f;if(m=n>=(u=(l+h)/2))l=u;else h=u}while((d=m<<1|y)===(b=(g>=u)<<1|p>=f));return r[b]=s,r[d]=o,e}function _g(e){var t,n,i=e.length,r,s,o=Array(i),a=Array(i),l=1/0,c=1/0,h=-1/0,f=-1/0;for(n=0;n<i;++n){if(isNaN(r=+this._x.call(null,t=e[n]))||isNaN(s=+this._y.call(null,t)))continue;if(o[n]=r,a[n]=s,r<l)l=r;if(r>h)h=r;if(s<c)c=s;if(s>f)f=s}if(l>h||c>f)return this;this.cover(l,c).cover(h,f);for(n=0;n<i;++n)gg(this,o[n],a[n],e[n]);return this}function Kh(e,t){if(isNaN(e=+e)||isNaN(t=+t))return this;var n=this._x0,i=this._y0,r=this._x1,s=this._y1;if(isNaN(n))r=(n=Math.floor(e))+1,s=(i=Math.floor(t))+1;else{var o=r-n||1,a=this._root,l,c;while(n>e||e>=r||i>t||t>=s)switch(c=(t<i)<<1|e<n,l=[,,,,],l[c]=a,a=l,o*=2,c){case 0:r=n+o,s=i+o;break;case 1:n=r-o,s=i+o;break;case 2:r=n+o,i=s-o;break;case 3:n=r-o,i=s-o;break}if(this._root&&this._root.length)this._root=a}return this._x0=n,this._y0=i,this._x1=r,this._y1=s,this}function Qh(){var e=[];return this.visit(function(t){if(!t.length)do e.push(t.data);while(t=t.next)}),e}function eu(e){return arguments.length?this.cover(+e[0][0],+e[0][1]).cover(+e[1][0],+e[1][1]):isNaN(this._x0)?void 0:[[this._x0,this._y0],[this._x1,this._y1]]}function Lt(e,t,n,i,r){this.node=e,this.x0=t,this.y0=n,this.x1=i,this.y1=r}function tu(e,t,n){var i,r=this._x0,s=this._y0,o,a,l,c,h=this._x1,f=this._y1,u=[],p=this._root,g,y;if(p)u.push(new Lt(p,r,s,h,f));if(n==null)n=1/0;else r=e-n,s=t-n,h=e+n,f=t+n,n*=n;while(g=u.pop()){if(!(p=g.node)||(o=g.x0)>h||(a=g.y0)>f||(l=g.x1)<r||(c=g.y1)<s)continue;if(p.length){var m=(o+l)/2,d=(a+c)/2;if(u.push(new Lt(p[3],m,d,l,c),new Lt(p[2],o,d,m,c),new Lt(p[1],m,a,l,d),new Lt(p[0],o,a,m,d)),y=(t>=d)<<1|e>=m)g=u[u.length-1],u[u.length-1]=u[u.length-1-y],u[u.length-1-y]=g}else{var b=e-+this._x.call(null,p.data),S=t-+this._y.call(null,p.data),_=b*b+S*S;if(_<n){var x=Math.sqrt(n=_);r=e-x,s=t-x,h=e+x,f=t+x,i=p.data}}}return i}function nu(e){if(isNaN(h=+this._x.call(null,e))||isNaN(f=+this._y.call(null,e)))return this;var t,n=this._root,i,r,s,o=this._x0,a=this._y0,l=this._x1,c=this._y1,h,f,u,p,g,y,m,d;if(!n)return this;if(n.length)while(!0){if(g=h>=(u=(o+l)/2))o=u;else l=u;if(y=f>=(p=(a+c)/2))a=p;else c=p;if(t=n,!(n=n[m=y<<1|g]))return this;if(!n.length)break;if(t[m+1&3]||t[m+2&3]||t[m+3&3])i=t,d=m}while(n.data!==e)if(r=n,!(n=n.next))return this;if(s=n.next)delete n.next;if(r)return s?r.next=s:delete r.next,this;if(!t)return this._root=s,this;if(s?t[m]=s:delete t[m],(n=t[0]||t[1]||t[2]||t[3])&&n===(t[3]||t[2]||t[1]||t[0])&&!n.length)if(i)i[d]=n;else this._root=n;return this}function vg(e){for(var t=0,n=e.length;t<n;++t)this.remove(e[t]);return this}function iu(){return this._root}function ru(){var e=0;return this.visit(function(t){if(!t.length)do++e;while(t=t.next)}),e}function su(e){var t=[],n,i=this._root,r,s,o,a,l;if(i)t.push(new Lt(i,this._x0,this._y0,this._x1,this._y1));while(n=t.pop())if(!e(i=n.node,s=n.x0,o=n.y0,a=n.x1,l=n.y1)&&i.length){var c=(s+a)/2,h=(o+l)/2;if(r=i[3])t.push(new Lt(r,c,h,a,l));if(r=i[2])t.push(new Lt(r,s,h,c,l));if(r=i[1])t.push(new Lt(r,c,o,a,h));if(r=i[0])t.push(new Lt(r,s,o,c,h))}return this}function ou(e){var t=[],n=[],i;if(this._root)t.push(new Lt(this._root,this._x0,this._y0,this._x1,this._y1));while(i=t.pop()){var r=i.node;if(r.length){var s,o=i.x0,a=i.y0,l=i.x1,c=i.y1,h=(o+l)/2,f=(a+c)/2;if(s=r[0])t.push(new Lt(s,o,a,h,f));if(s=r[1])t.push(new Lt(s,h,a,l,f));if(s=r[2])t.push(new Lt(s,o,f,h,c));if(s=r[3])t.push(new Lt(s,h,f,l,c))}n.push(i)}while(i=n.pop())e(i.node,i.x0,i.y0,i.x1,i.y1);return this}function yg(e){return e[0]}function au(e){return arguments.length?(this._x=e,this):this._x}function xg(e){return e[1]}function lu(e){return arguments.length?(this._y=e,this):this._y}function Os(e,t,n){var i=new cu(t==null?yg:t,n==null?xg:n,NaN,NaN,NaN,NaN);return e==null?i:i.addAll(e)}function cu(e,t,n,i,r,s){this._x=e,this._y=t,this._x0=n,this._y0=i,this._x1=r,this._y1=s,this._root=void 0}function bg(e){var t={data:e.data},n=t;while(e=e.next)n=n.next={data:e.data};return t}var Kt=Os.prototype=cu.prototype;Kt.copy=function(){var e=new cu(this._x,this._y,this._x0,this._y0,this._x1,this._y1),t=this._root,n,i;if(!t)return e;if(!t.length)return e._root=bg(t),e;n=[{source:t,target:e._root=[,,,,]}];while(t=n.pop())for(var r=0;r<4;++r)if(i=t.source[r])if(i.length)n.push({source:i,target:t.target[r]=[,,,,]});else t.target[r]=bg(i);return e};Kt.add=Jh;Kt.addAll=_g;Kt.cover=Kh;Kt.data=Qh;Kt.extent=eu;Kt.find=tu;Kt.remove=nu;Kt.removeAll=vg;Kt.root=iu;Kt.size=ru;Kt.visit=su;Kt.visitAfter=ou;Kt.x=au;Kt.y=lu;function hu(e){let t=+this._x.call(null,e),n=+this._y.call(null,e),i=+this._z.call(null,e);return Sg(this.cover(t,n,i),t,n,i,e)}function Sg(e,t,n,i,r){if(isNaN(t)||isNaN(n)||isNaN(i))return e;var s,o=e._root,a={data:r},{_x0:l,_y0:c,_z0:h,_x1:f,_y1:u,_z1:p}=e,g,y,m,d,b,S,_,x,w,T,v;if(!o)return e._root=a,e;while(o.length){if(_=t>=(g=(l+f)/2))l=g;else f=g;if(x=n>=(y=(c+u)/2))c=y;else u=y;if(w=i>=(m=(h+p)/2))h=m;else p=m;if(s=o,!(o=o[T=w<<2|x<<1|_]))return s[T]=a,e}if(d=+e._x.call(null,o.data),b=+e._y.call(null,o.data),S=+e._z.call(null,o.data),t===d&&n===b&&i===S)return a.next=o,s?s[T]=a:e._root=a,e;do{if(s=s?s[T]=[,,,,,,,,]:e._root=[,,,,,,,,],_=t>=(g=(l+f)/2))l=g;else f=g;if(x=n>=(y=(c+u)/2))c=y;else u=y;if(w=i>=(m=(h+p)/2))h=m;else p=m}while((T=w<<2|x<<1|_)===(v=(S>=m)<<2|(b>=y)<<1|d>=g));return s[v]=o,s[T]=a,e}function Mg(e){if(!Array.isArray(e))e=Array.from(e);let t=e.length,n=new Float64Array(t),i=new Float64Array(t),r=new Float64Array(t),s=1/0,o=1/0,a=1/0,l=-1/0,c=-1/0,h=-1/0;for(let f=0,u,p,g,y;f<t;++f){if(isNaN(p=+this._x.call(null,u=e[f]))||isNaN(g=+this._y.call(null,u))||isNaN(y=+this._z.call(null,u)))continue;if(n[f]=p,i[f]=g,r[f]=y,p<s)s=p;if(p>l)l=p;if(g<o)o=g;if(g>c)c=g;if(y<a)a=y;if(y>h)h=y}if(s>l||o>c||a>h)return this;this.cover(s,o,a).cover(l,c,h);for(let f=0;f<t;++f)Sg(this,n[f],i[f],r[f],e[f]);return this}function uu(e,t,n){if(isNaN(e=+e)||isNaN(t=+t)||isNaN(n=+n))return this;var i=this._x0,r=this._y0,s=this._z0,o=this._x1,a=this._y1,l=this._z1;if(isNaN(i))o=(i=Math.floor(e))+1,a=(r=Math.floor(t))+1,l=(s=Math.floor(n))+1;else{var c=o-i||1,h=this._root,f,u;while(i>e||e>=o||r>t||t>=a||s>n||n>=l)switch(u=(n<s)<<2|(t<r)<<1|e<i,f=[,,,,,,,,],f[u]=h,h=f,c*=2,u){case 0:o=i+c,a=r+c,l=s+c;break;case 1:i=o-c,a=r+c,l=s+c;break;case 2:o=i+c,r=a-c,l=s+c;break;case 3:i=o-c,r=a-c,l=s+c;break;case 4:o=i+c,a=r+c,s=l-c;break;case 5:i=o-c,a=r+c,s=l-c;break;case 6:o=i+c,r=a-c,s=l-c;break;case 7:i=o-c,r=a-c,s=l-c;break}if(this._root&&this._root.length)this._root=h}return this._x0=i,this._y0=r,this._z0=s,this._x1=o,this._y1=a,this._z1=l,this}function fu(){var e=[];return this.visit(function(t){if(!t.length)do e.push(t.data);while(t=t.next)}),e}function du(e){return arguments.length?this.cover(+e[0][0],+e[0][1],+e[0][2]).cover(+e[1][0],+e[1][1],+e[1][2]):isNaN(this._x0)?void 0:[[this._x0,this._y0,this._z0],[this._x1,this._y1,this._z1]]}function Qe(e,t,n,i,r,s,o){this.node=e,this.x0=t,this.y0=n,this.z0=i,this.x1=r,this.y1=s,this.z1=o}function pu(e,t,n,i){var r,s=this._x0,o=this._y0,a=this._z0,l,c,h,f,u,p,g=this._x1,y=this._y1,m=this._z1,d=[],b=this._root,S,_;if(b)d.push(new Qe(b,s,o,a,g,y,m));if(i==null)i=1/0;else s=e-i,o=t-i,a=n-i,g=e+i,y=t+i,m=n+i,i*=i;while(S=d.pop()){if(!(b=S.node)||(l=S.x0)>g||(c=S.y0)>y||(h=S.z0)>m||(f=S.x1)<s||(u=S.y1)<o||(p=S.z1)<a)continue;if(b.length){var x=(l+f)/2,w=(c+u)/2,T=(h+p)/2;if(d.push(new Qe(b[7],x,w,T,f,u,p),new Qe(b[6],l,w,T,x,u,p),new Qe(b[5],x,c,T,f,w,p),new Qe(b[4],l,c,T,x,w,p),new Qe(b[3],x,w,h,f,u,T),new Qe(b[2],l,w,h,x,u,T),new Qe(b[1],x,c,h,f,w,T),new Qe(b[0],l,c,h,x,w,T)),_=(n>=T)<<2|(t>=w)<<1|e>=x)S=d[d.length-1],d[d.length-1]=d[d.length-1-_],d[d.length-1-_]=S}else{var v=e-+this._x.call(null,b.data),A=t-+this._y.call(null,b.data),N=n-+this._z.call(null,b.data),P=v*v+A*A+N*N;if(P<i){var D=Math.sqrt(i=P);s=e-D,o=t-D,a=n-D,g=e+D,y=t+D,m=n+D,r=b.data}}}return r}var sw=(e,t,n,i,r,s)=>Math.sqrt((e-i)**2+(t-r)**2+(n-s)**2);function wg(e,t,n,i){let r=[],s=e-i,o=t-i,a=n-i,l=e+i,c=t+i,h=n+i;return this.visit((f,u,p,g,y,m,d)=>{if(!f.length)do{let b=f.data;if(sw(e,t,n,this._x(b),this._y(b),this._z(b))<=i)r.push(b)}while(f=f.next);return u>l||p>c||g>h||y<s||m<o||d<a}),r}function mu(e){if(isNaN(u=+this._x.call(null,e))||isNaN(p=+this._y.call(null,e))||isNaN(g=+this._z.call(null,e)))return this;var t,n=this._root,i,r,s,o=this._x0,a=this._y0,l=this._z0,c=this._x1,h=this._y1,f=this._z1,u,p,g,y,m,d,b,S,_,x,w;if(!n)return this;if(n.length)while(!0){if(b=u>=(y=(o+c)/2))o=y;else c=y;if(S=p>=(m=(a+h)/2))a=m;else h=m;if(_=g>=(d=(l+f)/2))l=d;else f=d;if(t=n,!(n=n[x=_<<2|S<<1|b]))return this;if(!n.length)break;if(t[x+1&7]||t[x+2&7]||t[x+3&7]||t[x+4&7]||t[x+5&7]||t[x+6&7]||t[x+7&7])i=t,w=x}while(n.data!==e)if(r=n,!(n=n.next))return this;if(s=n.next)delete n.next;if(r)return s?r.next=s:delete r.next,this;if(!t)return this._root=s,this;if(s?t[x]=s:delete t[x],(n=t[0]||t[1]||t[2]||t[3]||t[4]||t[5]||t[6]||t[7])&&n===(t[7]||t[6]||t[5]||t[4]||t[3]||t[2]||t[1]||t[0])&&!n.length)if(i)i[w]=n;else this._root=n;return this}function Eg(e){for(var t=0,n=e.length;t<n;++t)this.remove(e[t]);return this}function gu(){return this._root}function _u(){var e=0;return this.visit(function(t){if(!t.length)do++e;while(t=t.next)}),e}function vu(e){var t=[],n,i=this._root,r,s,o,a,l,c,h;if(i)t.push(new Qe(i,this._x0,this._y0,this._z0,this._x1,this._y1,this._z1));while(n=t.pop())if(!e(i=n.node,s=n.x0,o=n.y0,a=n.z0,l=n.x1,c=n.y1,h=n.z1)&&i.length){var f=(s+l)/2,u=(o+c)/2,p=(a+h)/2;if(r=i[7])t.push(new Qe(r,f,u,p,l,c,h));if(r=i[6])t.push(new Qe(r,s,u,p,f,c,h));if(r=i[5])t.push(new Qe(r,f,o,p,l,u,h));if(r=i[4])t.push(new Qe(r,s,o,p,f,u,h));if(r=i[3])t.push(new Qe(r,f,u,a,l,c,p));if(r=i[2])t.push(new Qe(r,s,u,a,f,c,p));if(r=i[1])t.push(new Qe(r,f,o,a,l,u,p));if(r=i[0])t.push(new Qe(r,s,o,a,f,u,p))}return this}function yu(e){var t=[],n=[],i;if(this._root)t.push(new Qe(this._root,this._x0,this._y0,this._z0,this._x1,this._y1,this._z1));while(i=t.pop()){var r=i.node;if(r.length){var s,o=i.x0,a=i.y0,l=i.z0,c=i.x1,h=i.y1,f=i.z1,u=(o+c)/2,p=(a+h)/2,g=(l+f)/2;if(s=r[0])t.push(new Qe(s,o,a,l,u,p,g));if(s=r[1])t.push(new Qe(s,u,a,l,c,p,g));if(s=r[2])t.push(new Qe(s,o,p,l,u,h,g));if(s=r[3])t.push(new Qe(s,u,p,l,c,h,g));if(s=r[4])t.push(new Qe(s,o,a,g,u,p,f));if(s=r[5])t.push(new Qe(s,u,a,g,c,p,f));if(s=r[6])t.push(new Qe(s,o,p,g,u,h,f));if(s=r[7])t.push(new Qe(s,u,p,g,c,h,f))}n.push(i)}while(i=n.pop())e(i.node,i.x0,i.y0,i.z0,i.x1,i.y1,i.z1);return this}function Tg(e){return e[0]}function xu(e){return arguments.length?(this._x=e,this):this._x}function Ag(e){return e[1]}function bu(e){return arguments.length?(this._y=e,this):this._y}function Cg(e){return e[2]}function Su(e){return arguments.length?(this._z=e,this):this._z}function Us(e,t,n,i){var r=new Mu(t==null?Tg:t,n==null?Ag:n,i==null?Cg:i,NaN,NaN,NaN,NaN,NaN,NaN);return e==null?r:r.addAll(e)}function Mu(e,t,n,i,r,s,o,a,l){this._x=e,this._y=t,this._z=n,this._x0=i,this._y0=r,this._z0=s,this._x1=o,this._y1=a,this._z1=l,this._root=void 0}function Rg(e){var t={data:e.data},n=t;while(e=e.next)n=n.next={data:e.data};return t}var kt=Us.prototype=Mu.prototype;kt.copy=function(){var e=new Mu(this._x,this._y,this._z,this._x0,this._y0,this._z0,this._x1,this._y1,this._z1),t=this._root,n,i;if(!t)return e;if(!t.length)return e._root=Rg(t),e;n=[{source:t,target:e._root=[,,,,,,,,]}];while(t=n.pop())for(var r=0;r<8;++r)if(i=t.source[r])if(i.length)n.push({source:i,target:t.target[r]=[,,,,,,,,]});else t.target[r]=Rg(i);return e};kt.add=hu;kt.addAll=Mg;kt.cover=uu;kt.data=fu;kt.extent=du;kt.find=pu;kt.findAllWithinRadius=wg;kt.remove=mu;kt.removeAll=Eg;kt.root=gu;kt.size=_u;kt.visit=vu;kt.visitAfter=yu;kt.x=xu;kt.y=bu;kt.z=Su;var ow={value:()=>{}};function Ig(){for(var e=0,t=arguments.length,n={},i;e<t;++e){if(!(i=arguments[e]+"")||i in n||/[\s.]/.test(i))throw Error("illegal type: "+i);n[i]=[]}return new Ma(n)}function Ma(e){this._=e}function aw(e,t){return e.trim().split(/^|\s+/).map(function(n){var i="",r=n.indexOf(".");if(r>=0)i=n.slice(r+1),n=n.slice(0,r);if(n&&!t.hasOwnProperty(n))throw Error("unknown type: "+n);return{type:n,name:i}})}Ma.prototype=Ig.prototype={constructor:Ma,on:function(e,t){var n=this._,i=aw(e+"",n),r,s=-1,o=i.length;if(arguments.length<2){while(++s<o)if((r=(e=i[s]).type)&&(r=lw(n[r],e.name)))return r;return}if(t!=null&&typeof t!=="function")throw Error("invalid callback: "+t);while(++s<o)if(r=(e=i[s]).type)n[r]=Pg(n[r],e.name,t);else if(t==null)for(r in n)n[r]=Pg(n[r],e.name,null);return this},copy:function(){var e={},t=this._;for(var n in t)e[n]=t[n].slice();return new Ma(e)},call:function(e,t){if((r=arguments.length-2)>0)for(var n=Array(r),i=0,r,s;i<r;++i)n[i]=arguments[i+2];if(!this._.hasOwnProperty(e))throw Error("unknown type: "+e);for(s=this._[e],i=0,r=s.length;i<r;++i)s[i].value.apply(t,n)},apply:function(e,t,n){if(!this._.hasOwnProperty(e))throw Error("unknown type: "+e);for(var i=this._[e],r=0,s=i.length;r<s;++r)i[r].value.apply(t,n)}};function lw(e,t){for(var n=0,i=e.length,r;n<i;++n)if((r=e[n]).name===t)return r.value}function Pg(e,t,n){for(var i=0,r=e.length;i<r;++i)if(e[i].name===t){e[i]=ow,e=e.slice(0,i).concat(e.slice(i+1));break}if(n!=null)e.push({name:t,value:n});return e}var wu=Ig;var Xr=0,Bs=0,Fs=0,Dg=1000,wa,ks,Ea=0,Ki=0,Ta=0,zs=typeof performance==="object"&&performance.now?performance:Date,Ng=typeof window==="object"&&window.requestAnimationFrame?window.requestAnimationFrame.bind(window):function(e){setTimeout(e,17)};function Au(){return Ki||(Ng(cw),Ki=zs.now()+Ta)}function cw(){Ki=0}function Eu(){this._call=this._time=this._next=null}Eu.prototype=Aa.prototype={constructor:Eu,restart:function(e,t,n){if(typeof e!=="function")throw TypeError("callback is not a function");if(n=(n==null?Au():+n)+(t==null?0:+t),!this._next&&ks!==this){if(ks)ks._next=this;else wa=this;ks=this}this._call=e,this._time=n,Tu()},stop:function(){if(this._call)this._call=null,this._time=1/0,Tu()}};function Aa(e,t,n){var i=new Eu;return i.restart(e,t,n),i}function Og(){Au(),++Xr;var e=wa,t;while(e){if((t=Ki-e._time)>=0)e._call.call(void 0,t);e=e._next}--Xr}function Lg(){Ki=(Ea=zs.now())+Ta,Xr=Bs=0;try{Og()}finally{Xr=0,uw(),Ki=0}}function hw(){var e=zs.now(),t=e-Ea;if(t>Dg)Ta-=t,Ea=e}function uw(){var e,t=wa,n,i=1/0;while(t)if(t._call){if(i>t._time)i=t._time;e=t,t=t._next}else n=t._next,t._next=null,t=e?e._next=n:wa=n;ks=e,Tu(i)}function Tu(e){if(Xr)return;if(Bs)Bs=clearTimeout(Bs);var t=e-Ki;if(t>24){if(e<1/0)Bs=setTimeout(Lg,e-zs.now()-Ta);if(Fs)Fs=clearInterval(Fs)}else{if(!Fs)Ea=zs.now(),Fs=setInterval(hw,Dg);Xr=1,Ng(Lg)}}function Cu(){let e=1;return()=>(e=(1664525*e+1013904223)%4294967296)/4294967296}var Ug=3;function Ca(e){return e.x}function Ru(e){return e.y}function Fg(e){return e.z}var fw=10,dw=Math.PI*(3-Math.sqrt(5)),pw=Math.PI*20/(9+Math.sqrt(221));function Ra(e,t){t=t||2;var n=Math.min(Ug,Math.max(1,Math.round(t))),i,r=1,s=0.001,o=1-Math.pow(s,0.0033333333333333335),a=0,l=0.6,c=new Map,h=Aa(p),f=wu("tick","end"),u=Cu();if(e==null)e=[];function p(){if(g(),f.call("tick",i),r<s)h.stop(),f.call("end",i)}function g(d){var b,S=e.length,_;if(d===void 0)d=1;for(var x=0;x<d;++x){r+=(a-r)*o,c.forEach(function(w){w(r)});for(b=0;b<S;++b){if(_=e[b],_.fx==null)_.x+=_.vx*=l;else _.x=_.fx,_.vx=0;if(n>1)if(_.fy==null)_.y+=_.vy*=l;else _.y=_.fy,_.vy=0;if(n>2)if(_.fz==null)_.z+=_.vz*=l;else _.z=_.fz,_.vz=0}}return i}function y(){for(var d=0,b=e.length,S;d<b;++d){if(S=e[d],S.index=d,S.fx!=null)S.x=S.fx;if(S.fy!=null)S.y=S.fy;if(S.fz!=null)S.z=S.fz;if(isNaN(S.x)||n>1&&isNaN(S.y)||n>2&&isNaN(S.z)){var _=fw*(n>2?Math.cbrt(0.5+d):n>1?Math.sqrt(0.5+d):d),x=d*dw,w=d*pw;if(n===1)S.x=_;else if(n===2)S.x=_*Math.cos(x),S.y=_*Math.sin(x);else S.x=_*Math.sin(x)*Math.cos(w),S.y=_*Math.cos(x),S.z=_*Math.sin(x)*Math.sin(w)}if(isNaN(S.vx)||n>1&&isNaN(S.vy)||n>2&&isNaN(S.vz)){if(S.vx=0,n>1)S.vy=0;if(n>2)S.vz=0}}}function m(d){if(d.initialize)d.initialize(e,u,n);return d}return y(),i={tick:g,restart:function(){return h.restart(p),i},stop:function(){return h.stop(),i},numDimensions:function(d){return arguments.length?(n=Math.min(Ug,Math.max(1,Math.round(d))),c.forEach(m),i):n},nodes:function(d){return arguments.length?(e=d,y(),c.forEach(m),i):e},alpha:function(d){return arguments.length?(r=+d,i):r},alphaMin:function(d){return arguments.length?(s=+d,i):s},alphaDecay:function(d){return arguments.length?(o=+d,i):+o},alphaTarget:function(d){return arguments.length?(a=+d,i):a},velocityDecay:function(d){return arguments.length?(l=1-d,i):1-l},randomSource:function(d){return arguments.length?(u=d,c.forEach(m),i):u},force:function(d,b){return arguments.length>1?(b==null?c.delete(d):c.set(d,m(b)),i):c.get(d)},find:function(){var d=Array.prototype.slice.call(arguments),b=d.shift()||0,S=(n>1?d.shift():null)||0,_=(n>2?d.shift():null)||0,x=d.shift()||1/0,w=0,T=e.length,v,A,N,P,D,W;x*=x;for(w=0;w<T;++w)if(D=e[w],v=b-D.x,A=S-(D.y||0),N=_-(D.z||0),P=v*v+A*A+N*N,P<x)W=D,x=P;return W},on:function(d,b){return arguments.length>1?(f.on(d,b),i):f.on(d)}}}function Pa(){var e,t,n,i,r,s=dn(-30),o,a=1,l=1/0,c=0.81;function h(g){var y,m=e.length,d=(t===1?Ns(e,Ca):t===2?Os(e,Ca,Ru):t===3?Us(e,Ca,Ru,Fg):null).visitAfter(u);for(r=g,y=0;y<m;++y)n=e[y],d.visit(p)}function f(){if(!e)return;var g,y=e.length,m;o=Array(y);for(g=0;g<y;++g)m=e[g],o[m.index]=+s(m,g,e)}function u(g){var y=0,m,d,b=0,S,_,x,w,T=g.length;if(T){for(S=_=x=w=0;w<T;++w)if((m=g[w])&&(d=Math.abs(m.value)))y+=m.value,b+=d,S+=d*(m.x||0),_+=d*(m.y||0),x+=d*(m.z||0);if(y*=Math.sqrt(4/T),g.x=S/b,t>1)g.y=_/b;if(t>2)g.z=x/b}else{if(m=g,m.x=m.data.x,t>1)m.y=m.data.y;if(t>2)m.z=m.data.z;do y+=o[m.data.index];while(m=m.next)}g.value=y}function p(g,y,m,d,b){if(!g.value)return!0;var S=[m,d,b][t-1],_=g.x-n.x,x=t>1?g.y-n.y:0,w=t>2?g.z-n.z:0,T=S-y,v=_*_+x*x+w*w;if(T*T/c<v){if(v<l){if(_===0)_=Mn(i),v+=_*_;if(t>1&&x===0)x=Mn(i),v+=x*x;if(t>2&&w===0)w=Mn(i),v+=w*w;if(v<a)v=Math.sqrt(a*v);if(n.vx+=_*g.value*r/v,t>1)n.vy+=x*g.value*r/v;if(t>2)n.vz+=w*g.value*r/v}return!0}else if(g.length||v>=l)return;if(g.data!==n||g.next){if(_===0)_=Mn(i),v+=_*_;if(t>1&&x===0)x=Mn(i),v+=x*x;if(t>2&&w===0)w=Mn(i),v+=w*w;if(v<a)v=Math.sqrt(a*v)}do if(g.data!==n){if(T=o[g.data.index]*r/v,n.vx+=_*T,t>1)n.vy+=x*T;if(t>2)n.vz+=w*T}while(g=g.next)}return h.initialize=function(g,...y){e=g,i=y.find((m)=>typeof m==="function")||Math.random,t=y.find((m)=>[1,2,3].includes(m))||2,f()},h.strength=function(g){return arguments.length?(s=typeof g==="function"?g:dn(+g),f(),h):s},h.distanceMin=function(g){return arguments.length?(a=g*g,h):Math.sqrt(a)},h.distanceMax=function(g){return arguments.length?(l=g*g,h):Math.sqrt(l)},h.theta=function(g){return arguments.length?(c=g*g,h):Math.sqrt(c)},h}function Ia(e,t,n,i){var r,s,o=dn(0.1),a,l;if(typeof e!=="function")e=dn(+e);if(t==null)t=0;if(n==null)n=0;if(i==null)i=0;function c(f){for(var u=0,p=r.length;u<p;++u){var g=r[u],y=g.x-t||0.000001,m=(g.y||0)-n||0.000001,d=(g.z||0)-i||0.000001,b=Math.sqrt(y*y+m*m+d*d),S=(l[u]-b)*a[u]*f/b;if(g.vx+=y*S,s>1)g.vy+=m*S;if(s>2)g.vz+=d*S}}function h(){if(!r)return;var f,u=r.length;a=Array(u),l=Array(u);for(f=0;f<u;++f)l[f]=+e(r[f],f,r),a[f]=isNaN(l[f])?0:+o(r[f],f,r)}return c.initialize=function(f,...u){r=f,s=u.find((p)=>[1,2,3].includes(p))||2,h()},c.strength=function(f){return arguments.length?(o=typeof f==="function"?f:dn(+f),h(),c):o},c.radius=function(f){return arguments.length?(e=typeof f==="function"?f:dn(+f),h(),c):e},c.x=function(f){return arguments.length?(t=+f,c):t},c.y=function(f){return arguments.length?(n=+f,c):n},c.z=function(f){return arguments.length?(i=+f,c):i},c}function Pu(e){gw(e);let t=mw(e);return e.on=t.on,e.off=t.off,e.fire=t.fire,e}function mw(e){let t=Object.create(null);return{on:function(n,i,r){if(typeof i!=="function")throw Error("callback is expected to be a function");let s=t[n];if(!s)s=t[n]=[];return s.push({callback:i,ctx:r}),e},off:function(n,i){if(typeof n>"u")return t=Object.create(null),e;if(t[n])if(typeof i!=="function")delete t[n];else{let o=t[n];for(let a=0;a<o.length;++a)if(o[a].callback===i)o.splice(a,1)}return e},fire:function(n){let i=t[n];if(!i)return e;let r;if(arguments.length>1)r=Array.prototype.slice.call(arguments,1);for(let s=0;s<i.length;++s){let o=i[s];o.callback.apply(o.ctx,r)}return e}}}function gw(e){if(!e)throw Error("Eventify cannot use falsy object as events subject");let t=["on","fire","off"];for(let n=0;n<t.length;++n)if(e.hasOwnProperty(t[n]))throw Error("Subject cannot be eventified, since it already has property '"+t[n]+"'")}var zg=_w;function _w(e){if(e=e||{},"uniqueLinkId"in e)console.warn("ngraph.graph: Starting from version 0.14 `uniqueLinkId` is deprecated.\nUse `multigraph` option instead\n",`
`,`Note: there is also change in default behavior: From now on each graph
is considered to be not a multigraph by default (each edge is unique).`),e.multigraph=e.uniqueLinkId;if(e.multigraph===void 0)e.multigraph=!1;if(typeof Map!=="function")throw Error("ngraph.graph requires `Map` to be defined. Please polyfill it before using ngraph");var t=new Map,n=new Map,i={},r=0,s=e.multigraph?_:S,o=[],a=z,l=z,c=z,h=z,f={version:20,addNode:y,addLink:b,removeLink:v,removeNode:d,getNode:m,getNodeCount:x,getLinkCount:w,getEdgeCount:w,getLinksCount:w,getNodesCount:x,getLinks:T,forEachNode:Q,forEachLinkedNode:R,forEachLink:W,beginUpdate:c,endUpdate:h,clear:D,hasLink:N,hasNode:m,getLink:N,getLinkById:P};return Pu(f),u(),f;function u(){var G=f.on;f.on=ee;function ee(){return f.beginUpdate=c=te,f.endUpdate=h=Y,a=p,l=g,f.on=G,G.apply(f,arguments)}}function p(G,ee){o.push({link:G,changeType:ee})}function g(G,ee){o.push({node:G,changeType:ee})}function y(G,ee){if(G===void 0)throw Error("Invalid node identifier");c();var oe=m(G);if(!oe)oe=new vw(G,ee),l(oe,"add");else oe.data=ee,l(oe,"update");return t.set(G,oe),h(),oe}function m(G){return t.get(G)}function d(G){var ee=m(G);if(!ee)return!1;c();var oe=ee.links;if(oe)oe.forEach(A),ee.links=null;return t.delete(G),l(ee,"remove"),h(),!0}function b(G,ee,oe){c();var Ue=m(G)||y(G),Re=m(ee)||y(ee),X=s(G,ee,oe),re=n.has(X.id);if(n.set(X.id,X),Bg(Ue,X),G!==ee)Bg(Re,X);return a(X,re?"update":"add"),h(),X}function S(G,ee,oe){var Ue=La(G,ee),Re=n.get(Ue);if(Re)return Re.data=oe,Re;return new kg(G,ee,oe,Ue)}function _(G,ee,oe){var Ue=La(G,ee),Re=i.hasOwnProperty(Ue);if(Re||N(G,ee)){if(!Re)i[Ue]=0;var X="@"+ ++i[Ue];Ue=La(G+X,ee+X)}return new kg(G,ee,oe,Ue)}function x(){return t.size}function w(){return n.size}function T(G){var ee=m(G);return ee?ee.links:null}function v(G,ee){if(ee!==void 0)G=N(G,ee);return A(G)}function A(G){if(!G)return!1;if(!n.get(G.id))return!1;c(),n.delete(G.id);var ee=m(G.fromId),oe=m(G.toId);if(ee)ee.links.delete(G);if(oe)oe.links.delete(G);return a(G,"remove"),h(),!0}function N(G,ee){if(G===void 0||ee===void 0)return;return n.get(La(G,ee))}function P(G){if(G===void 0)return;return n.get(G)}function D(){c(),Q(function(G){d(G.id)}),h()}function W(G){if(typeof G==="function"){var ee=n.values(),oe=ee.next();while(!oe.done){if(G(oe.value))return!0;oe=ee.next()}}}function R(G,ee,oe){var Ue=m(G);if(Ue&&Ue.links&&typeof ee==="function")if(oe)return k(Ue.links,G,ee);else return I(Ue.links,G,ee)}function I(G,ee,oe){var Ue,Re=G.values(),X=Re.next();while(!X.done){var re=X.value,le=re.fromId===ee?re.toId:re.fromId;if(Ue=oe(t.get(le),re),Ue)return!0;X=Re.next()}}function k(G,ee,oe){var Ue,Re=G.values(),X=Re.next();while(!X.done){var re=X.value;if(re.fromId===ee){if(Ue=oe(t.get(re.toId),re),Ue)return!0}X=Re.next()}}function z(){}function te(){r+=1}function Y(){if(r-=1,r===0&&o.length>0)f.fire("changed",o),o.length=0}function Q(G){if(typeof G!=="function")throw Error("Function is expected to iterate over graph nodes. You passed "+G);var ee=t.values(),oe=ee.next();while(!oe.done){if(G(oe.value))return!0;oe=ee.next()}}}function vw(e,t){this.id=e,this.links=null,this.data=t}function Bg(e,t){if(e.links)e.links.add(t);else e.links=new Set([t])}function kg(e,t,n,i){this.fromId=e,this.toId=t,this.data=n,this.id=i}function La(e,t){return e.toString()+"\uD83D\uDC49 "+t.toString()}var $_=sv(y_(),1);function Zw(e){var t=typeof e;return e!=null&&(t=="object"||t=="function")}var Hs=Zw;var Jw=typeof global=="object"&&global&&global.Object===Object&&global,x_=Jw;var Kw=typeof self=="object"&&self&&self.Object===Object&&self,Qw=x_||Kw||Function("return this")(),Na=Qw;var e1=function(){return Na.Date.now()},Oa=e1;var t1=/\s/;function n1(e){var t=e.length;while(t--&&t1.test(e.charAt(t)));return t}var b_=n1;var i1=/^\s+/;function r1(e){return e?e.slice(0,b_(e)+1).replace(i1,""):e}var S_=r1;var s1=Na.Symbol,qr=s1;var M_=Object.prototype,{hasOwnProperty:o1,toString:a1}=M_,Vs=qr?qr.toStringTag:void 0;function l1(e){var t=o1.call(e,Vs),n=e[Vs];try{e[Vs]=void 0;var i=!0}catch(s){}var r=a1.call(e);if(i)if(t)e[Vs]=n;else delete e[Vs];return r}var w_=l1;var c1=Object.prototype,h1=c1.toString;function u1(e){return h1.call(e)}var E_=u1;var f1="[object Null]",d1="[object Undefined]",T_=qr?qr.toStringTag:void 0;function p1(e){if(e==null)return e===void 0?d1:f1;return T_&&T_ in Object(e)?w_(e):E_(e)}var A_=p1;function m1(e){return e!=null&&typeof e=="object"}var C_=m1;var g1="[object Symbol]";function _1(e){return typeof e=="symbol"||C_(e)&&A_(e)==g1}var R_=_1;var P_=NaN,v1=/^[-+]0x[0-9a-f]+$/i,y1=/^0b[01]+$/i,x1=/^0o[0-7]+$/i,b1=parseInt;function S1(e){if(typeof e=="number")return e;if(R_(e))return P_;if(Hs(e)){var t=typeof e.valueOf=="function"?e.valueOf():e;e=Hs(t)?t+"":t}if(typeof e!="string")return e===0?e:+e;e=S_(e);var n=y1.test(e);return n||x1.test(e)?b1(e.slice(2),n?2:8):v1.test(e)?P_:+e}var Hu=S1;var M1="Expected a function",{max:w1,min:E1}=Math;function T1(e,t,n){var i,r,s,o,a,l,c=0,h=!1,f=!1,u=!0;if(typeof e!="function")throw TypeError(M1);if(t=Hu(t)||0,Hs(n))h=!!n.leading,f="maxWait"in n,s=f?w1(Hu(n.maxWait)||0,t):s,u="trailing"in n?!!n.trailing:u;function p(w){var T=i,v=r;return i=r=void 0,c=w,o=e.apply(v,T),o}function g(w){return c=w,a=setTimeout(d,t),h?p(w):o}function y(w){var T=w-l,v=w-c,A=t-T;return f?E1(A,s-v):A}function m(w){var T=w-l,v=w-c;return l===void 0||T>=t||T<0||f&&v>=s}function d(){var w=Oa();if(m(w))return b(w);a=setTimeout(d,y(w))}function b(w){if(a=void 0,u&&i)return p(w);return i=r=void 0,o}function S(){if(a!==void 0)clearTimeout(a);c=0,i=l=r=a=void 0}function _(){return a===void 0?o:b(Oa())}function x(){var w=Oa(),T=m(w);if(i=arguments,r=this,l=w,T){if(a===void 0)return g(l);if(f)return clearTimeout(a),a=setTimeout(d,t),p(l)}if(a===void 0)a=setTimeout(d,t);return o}return x.cancel=S,x.flush=_,x}var I_=T1;function L_(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function A1(e){if(Array.isArray(e))return e}function C1(e,t){if(!(e instanceof t))throw TypeError("Cannot call a class as a function")}function R1(e,t,n){return Object.defineProperty(e,"prototype",{writable:!1}),e}function P1(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0);else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(h){c=!0,r=h}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function I1(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function L1(e,t){return A1(e)||P1(e,t)||D1(e,t)||I1()}function D1(e,t){if(e){if(typeof e=="string")return L_(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?L_(e,t):void 0}}var N1=R1(function e(t,n){var i=n.default,r=i===void 0?null:i,s=n.triggerUpdate,o=s===void 0?!0:s,a=n.onChange,l=a===void 0?function(c,h){}:a;C1(this,e),this.name=t,this.defaultVal=r,this.triggerUpdate=o,this.onChange=l});function bi(e){var t=e.stateInit,n=t===void 0?function(){return{}}:t,i=e.props,r=i===void 0?{}:i,s=e.methods,o=s===void 0?{}:s,a=e.aliases,l=a===void 0?{}:a,c=e.init,h=c===void 0?function(){}:c,f=e.update,u=f===void 0?function(){}:f,p=Object.keys(r).map(function(g){return new N1(g,r[g])});return function g(){for(var y=arguments.length,m=Array(y),d=0;d<y;d++)m[d]=arguments[d];var b=!!(this instanceof g?this.constructor:void 0),S=b?m.shift():void 0,_=m[0],x=_===void 0?{}:_,w=Object.assign({},n instanceof Function?n(x):n,{initialised:!1}),T={};function v(P){return A(P,x),N(),v}var A=function(D,W){h.call(v,D,w,W),w.initialised=!0},N=I_(function(){if(!w.initialised)return;u.call(v,w,T),T={}},1);return p.forEach(function(P){v[P.name]=D(P);function D(W){var{name:R,triggerUpdate:I}=W,k=I===void 0?!1:I,z=W.onChange,te=z===void 0?function(G,ee){}:z,Y=W.defaultVal,Q=Y===void 0?null:Y;return function(G){var ee=w[R];if(!arguments.length)return ee;var oe=G===void 0?Q:G;if(w[R]=oe,te.call(v,oe,w,ee),!T.hasOwnProperty(R)&&(T[R]=ee),k)N();return v}}}),Object.keys(o).forEach(function(P){v[P]=function(){var D;for(var W=arguments.length,R=Array(W),I=0;I<W;I++)R[I]=arguments[I];return(D=o[P]).call.apply(D,[v,w].concat(R))}}),Object.entries(l).forEach(function(P){var D=L1(P,2),W=D[0],R=D[1];return v[W]=v[R]}),v.resetProps=function(){return p.forEach(function(P){v[P.name](P.defaultVal)}),v},v.resetProps(),w._rerender=N,b&&S&&v(S),v}}var ze=function(e){return typeof e==="function"?e:typeof e==="string"?function(t){return t[e]}:function(t){return e}};function Ua(e,t){let n;if(t===void 0){for(let i of e)if(i!=null&&(n<i||n===void 0&&i>=i))n=i}else{let i=-1;for(let r of e)if((r=t(r,++i,e))!=null&&(n<r||n===void 0&&r>=r))n=r}return n}function Fa(e,t){let n;if(t===void 0){for(let i of e)if(i!=null&&(n>i||n===void 0&&i>=i))n=i}else{let i=-1;for(let r of e)if((r=t(r,++i,e))!=null&&(n>r||n===void 0&&r>=r))n=r}return n}class Ws extends Map{constructor(e,t=F1){super();if(Object.defineProperties(this,{_intern:{value:new Map},_key:{value:t}}),e!=null)for(let[n,i]of e)this.set(n,i)}get(e){return super.get(D_(this,e))}has(e){return super.has(D_(this,e))}set(e,t){return super.set(O1(this,e),t)}delete(e){return super.delete(U1(this,e))}}function D_({_intern:e,_key:t},n){let i=t(n);return e.has(i)?e.get(i):n}function O1({_intern:e,_key:t},n){let i=t(n);if(e.has(i))return e.get(i);return e.set(i,n),n}function U1({_intern:e,_key:t},n){let i=t(n);if(e.has(i))n=e.get(i),e.delete(i);return n}function F1(e){return e!==null&&typeof e==="object"?e.valueOf():e}function qu(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function B1(e){if(Array.isArray(e))return e}function k1(e){if(Array.isArray(e))return qu(e)}function N_(e,t,n){if(typeof e=="function"?e===t:e.has(t))return arguments.length<3?t:n;throw TypeError("Private element is not present on this object")}function z1(e,t){if(t.has(e))throw TypeError("Cannot initialize the same private elements twice on an object")}function G1(e,t){if(!(e instanceof t))throw TypeError("Cannot call a class as a function")}function qt(e,t){return e.get(N_(e,t))}function jr(e,t,n){z1(e,t),t.set(e,n)}function Ba(e,t,n){return e.set(N_(e,t),n),n}function H1(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,J1(i.key),i)}}function V1(e,t,n){return t&&H1(e.prototype,t),Object.defineProperty(e,"prototype",{writable:!1}),e}function W1(e){if(typeof Symbol<"u"&&e[Symbol.iterator]!=null||e["@@iterator"]!=null)return Array.from(e)}function X1(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0);else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(h){c=!0,r=h}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function q1(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function j1(){throw TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function Y1(e,t){return B1(e)||X1(e,t)||O_(e,t)||q1()}function $1(e){return k1(e)||W1(e)||O_(e)||j1()}function Z1(e,t){if(typeof e!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var i=n.call(e,t);if(typeof i!="object")return i;throw TypeError("@@toPrimitive must return a primitive value.")}return String(e)}function J1(e){var t=Z1(e,"string");return typeof t=="symbol"?t:t+""}function O_(e,t){if(e){if(typeof e=="string")return qu(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?qu(e,t):void 0}}var Yr=new WeakMap,Xs=new WeakMap,$r=new WeakMap,Vu=new WeakMap,Wu=new WeakMap,Xu=new WeakMap,U_=function(){function e(){G1(this,e),jr(this,Yr,new Map),jr(this,Xs,new Map),jr(this,$r,function(t){return t}),jr(this,Vu,function(){return{}}),jr(this,Wu,function(){}),jr(this,Xu,function(){})}return V1(e,[{key:"getObj",value:function(n){return qt(Yr,this).get(qt($r,this).call(this,n))}},{key:"getData",value:function(n){return qt(Xs,this).get(n)}},{key:"entries",value:function(){return $1(qt(Xs,this).entries()).map(function(n){var i=Y1(n,2),r=i[0],s=i[1];return[s,r]})}},{key:"id",value:function(n){return Ba($r,this,ze(n)),this}},{key:"onCreateObj",value:function(n){return Ba(Vu,this,n),this}},{key:"onUpdateObj",value:function(n){return Ba(Wu,this,n),this}},{key:"onRemoveObj",value:function(n){return Ba(Xu,this,n),this}},{key:"digest",value:function(n){var i=this;n.filter(function(s){return!qt(Yr,i).has(qt($r,i).call(i,s))}).forEach(function(s){var o=qt(Vu,i).call(i,s);qt(Yr,i).set(qt($r,i).call(i,s),o),qt(Xs,i).set(o,s)});var r=new Map(n.map(function(s){return[qt($r,i).call(i,s),s]}));return qt(Yr,this).forEach(function(s,o){if(!r.has(o))qt(Xu,i).call(i,s,o),qt(Yr,i).delete(o),qt(Xs,i).delete(s);else qt(Wu,i).call(i,s,r.get(o))}),this}},{key:"clear",value:function(){return this.digest([]),this}}])}();function F_(e,t){switch(arguments.length){case 0:break;case 1:this.range(e);break;default:this.range(t).domain(e);break}return this}var ju=Symbol("implicit");function qs(){var e=new Ws,t=[],n=[],i=ju;function r(s){let o=e.get(s);if(o===void 0){if(i!==ju)return i;e.set(s,o=t.push(s)-1)}return n[o%n.length]}return r.domain=function(s){if(!arguments.length)return t.slice();t=[],e=new Ws;for(let o of s){if(e.has(o))continue;e.set(o,t.push(o)-1)}return r},r.range=function(s){return arguments.length?(n=Array.from(s),r):n.slice()},r.unknown=function(s){return arguments.length?(i=s,r):i},r.copy=function(){return qs(t,n).unknown(i)},F_.apply(r,arguments),r}function Yu(e){var t=e.length/6|0,n=Array(t),i=0;while(i<t)n[i]="#"+e.slice(i*6,++i*6);return n}var $u=Yu("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928");function ka(e){return ka=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(t){return typeof t}:function(t){return t&&typeof Symbol=="function"&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},ka(e)}var K1=/^\s+/,Q1=/\s+$/;function Ee(e,t){if(e=e?e:"",t=t||{},e instanceof Ee)return e;if(!(this instanceof Ee))return new Ee(e,t);var n=eE(e);if(this._originalInput=e,this._r=n.r,this._g=n.g,this._b=n.b,this._a=n.a,this._roundA=Math.round(100*this._a)/100,this._format=t.format||n.format,this._gradientType=t.gradientType,this._r<1)this._r=Math.round(this._r);if(this._g<1)this._g=Math.round(this._g);if(this._b<1)this._b=Math.round(this._b);this._ok=n.ok}Ee.prototype={isDark:function(){return this.getBrightness()<128},isLight:function(){return!this.isDark()},isValid:function(){return this._ok},getOriginalInput:function(){return this._originalInput},getFormat:function(){return this._format},getAlpha:function(){return this._a},getBrightness:function(){var t=this.toRgb();return(t.r*299+t.g*587+t.b*114)/1000},getLuminance:function(){var t=this.toRgb(),n,i,r,s,o,a;if(n=t.r/255,i=t.g/255,r=t.b/255,n<=0.03928)s=n/12.92;else s=Math.pow((n+0.055)/1.055,2.4);if(i<=0.03928)o=i/12.92;else o=Math.pow((i+0.055)/1.055,2.4);if(r<=0.03928)a=r/12.92;else a=Math.pow((r+0.055)/1.055,2.4);return 0.2126*s+0.7152*o+0.0722*a},setAlpha:function(t){return this._a=W_(t),this._roundA=Math.round(100*this._a)/100,this},toHsv:function(){var t=k_(this._r,this._g,this._b);return{h:t.h*360,s:t.s,v:t.v,a:this._a}},toHsvString:function(){var t=k_(this._r,this._g,this._b),n=Math.round(t.h*360),i=Math.round(t.s*100),r=Math.round(t.v*100);return this._a==1?"hsv("+n+", "+i+"%, "+r+"%)":"hsva("+n+", "+i+"%, "+r+"%, "+this._roundA+")"},toHsl:function(){var t=B_(this._r,this._g,this._b);return{h:t.h*360,s:t.s,l:t.l,a:this._a}},toHslString:function(){var t=B_(this._r,this._g,this._b),n=Math.round(t.h*360),i=Math.round(t.s*100),r=Math.round(t.l*100);return this._a==1?"hsl("+n+", "+i+"%, "+r+"%)":"hsla("+n+", "+i+"%, "+r+"%, "+this._roundA+")"},toHex:function(t){return z_(this._r,this._g,this._b,t)},toHexString:function(t){return"#"+this.toHex(t)},toHex8:function(t){return rE(this._r,this._g,this._b,this._a,t)},toHex8String:function(t){return"#"+this.toHex8(t)},toRgb:function(){return{r:Math.round(this._r),g:Math.round(this._g),b:Math.round(this._b),a:this._a}},toRgbString:function(){return this._a==1?"rgb("+Math.round(this._r)+", "+Math.round(this._g)+", "+Math.round(this._b)+")":"rgba("+Math.round(this._r)+", "+Math.round(this._g)+", "+Math.round(this._b)+", "+this._roundA+")"},toPercentageRgb:function(){return{r:Math.round(_t(this._r,255)*100)+"%",g:Math.round(_t(this._g,255)*100)+"%",b:Math.round(_t(this._b,255)*100)+"%",a:this._a}},toPercentageRgbString:function(){return this._a==1?"rgb("+Math.round(_t(this._r,255)*100)+"%, "+Math.round(_t(this._g,255)*100)+"%, "+Math.round(_t(this._b,255)*100)+"%)":"rgba("+Math.round(_t(this._r,255)*100)+"%, "+Math.round(_t(this._g,255)*100)+"%, "+Math.round(_t(this._b,255)*100)+"%, "+this._roundA+")"},toName:function(){if(this._a===0)return"transparent";if(this._a<1)return!1;return gE[z_(this._r,this._g,this._b,!0)]||!1},toFilter:function(t){var n="#"+G_(this._r,this._g,this._b,this._a),i=n,r=this._gradientType?"GradientType = 1, ":"";if(t){var s=Ee(t);i="#"+G_(s._r,s._g,s._b,s._a)}return"progid:DXImageTransform.Microsoft.gradient("+r+"startColorstr="+n+",endColorstr="+i+")"},toString:function(t){var n=!!t;t=t||this._format;var i=!1,r=this._a<1&&this._a>=0,s=!n&&r&&(t==="hex"||t==="hex6"||t==="hex3"||t==="hex4"||t==="hex8"||t==="name");if(s){if(t==="name"&&this._a===0)return this.toName();return this.toRgbString()}if(t==="rgb")i=this.toRgbString();if(t==="prgb")i=this.toPercentageRgbString();if(t==="hex"||t==="hex6")i=this.toHexString();if(t==="hex3")i=this.toHexString(!0);if(t==="hex4")i=this.toHex8String(!0);if(t==="hex8")i=this.toHex8String();if(t==="name")i=this.toName();if(t==="hsl")i=this.toHslString();if(t==="hsv")i=this.toHsvString();return i||this.toHexString()},clone:function(){return Ee(this.toString())},_applyModification:function(t,n){var i=t.apply(null,[this].concat([].slice.call(n)));return this._r=i._r,this._g=i._g,this._b=i._b,this.setAlpha(i._a),this},lighten:function(){return this._applyModification(lE,arguments)},brighten:function(){return this._applyModification(cE,arguments)},darken:function(){return this._applyModification(hE,arguments)},desaturate:function(){return this._applyModification(sE,arguments)},saturate:function(){return this._applyModification(oE,arguments)},greyscale:function(){return this._applyModification(aE,arguments)},spin:function(){return this._applyModification(uE,arguments)},_applyCombination:function(t,n){return t.apply(null,[this].concat([].slice.call(n)))},analogous:function(){return this._applyCombination(pE,arguments)},complement:function(){return this._applyCombination(fE,arguments)},monochromatic:function(){return this._applyCombination(mE,arguments)},splitcomplement:function(){return this._applyCombination(dE,arguments)},triad:function(){return this._applyCombination(H_,[3])},tetrad:function(){return this._applyCombination(H_,[4])}};Ee.fromRatio=function(e,t){if(ka(e)=="object"){var n={};for(var i in e)if(e.hasOwnProperty(i))if(i==="a")n[i]=e[i];else n[i]=js(e[i]);e=n}return Ee(e,t)};function eE(e){var t={r:0,g:0,b:0},n=1,i=null,r=null,s=null,o=!1,a=!1;if(typeof e=="string")e=xE(e);if(ka(e)=="object"){if(oi(e.r)&&oi(e.g)&&oi(e.b))t=tE(e.r,e.g,e.b),o=!0,a=String(e.r).substr(-1)==="%"?"prgb":"rgb";else if(oi(e.h)&&oi(e.s)&&oi(e.v))i=js(e.s),r=js(e.v),t=iE(e.h,i,r),o=!0,a="hsv";else if(oi(e.h)&&oi(e.s)&&oi(e.l))i=js(e.s),s=js(e.l),t=nE(e.h,i,s),o=!0,a="hsl";if(e.hasOwnProperty("a"))n=e.a}return n=W_(n),{ok:o,format:e.format||a,r:Math.min(255,Math.max(t.r,0)),g:Math.min(255,Math.max(t.g,0)),b:Math.min(255,Math.max(t.b,0)),a:n}}function tE(e,t,n){return{r:_t(e,255)*255,g:_t(t,255)*255,b:_t(n,255)*255}}function B_(e,t,n){e=_t(e,255),t=_t(t,255),n=_t(n,255);var i=Math.max(e,t,n),r=Math.min(e,t,n),s,o,a=(i+r)/2;if(i==r)s=o=0;else{var l=i-r;switch(o=a>0.5?l/(2-i-r):l/(i+r),i){case e:s=(t-n)/l+(t<n?6:0);break;case t:s=(n-e)/l+2;break;case n:s=(e-t)/l+4;break}s/=6}return{h:s,s:o,l:a}}function nE(e,t,n){var i,r,s;e=_t(e,360),t=_t(t,100),n=_t(n,100);function o(c,h,f){if(f<0)f+=1;if(f>1)f-=1;if(f<0.16666666666666666)return c+(h-c)*6*f;if(f<0.5)return h;if(f<0.6666666666666666)return c+(h-c)*(0.6666666666666666-f)*6;return c}if(t===0)i=r=s=n;else{var a=n<0.5?n*(1+t):n+t-n*t,l=2*n-a;i=o(l,a,e+0.3333333333333333),r=o(l,a,e),s=o(l,a,e-0.3333333333333333)}return{r:i*255,g:r*255,b:s*255}}function k_(e,t,n){e=_t(e,255),t=_t(t,255),n=_t(n,255);var i=Math.max(e,t,n),r=Math.min(e,t,n),s,o,a=i,l=i-r;if(o=i===0?0:l/i,i==r)s=0;else{switch(i){case e:s=(t-n)/l+(t<n?6:0);break;case t:s=(n-e)/l+2;break;case n:s=(e-t)/l+4;break}s/=6}return{h:s,s:o,v:a}}function iE(e,t,n){e=_t(e,360)*6,t=_t(t,100),n=_t(n,100);var i=Math.floor(e),r=e-i,s=n*(1-t),o=n*(1-r*t),a=n*(1-(1-r)*t),l=i%6,c=[n,o,s,s,a,n][l],h=[a,n,n,o,s,s][l],f=[s,s,a,n,n,o][l];return{r:c*255,g:h*255,b:f*255}}function z_(e,t,n,i){var r=[Dn(Math.round(e).toString(16)),Dn(Math.round(t).toString(16)),Dn(Math.round(n).toString(16))];if(i&&r[0].charAt(0)==r[0].charAt(1)&&r[1].charAt(0)==r[1].charAt(1)&&r[2].charAt(0)==r[2].charAt(1))return r[0].charAt(0)+r[1].charAt(0)+r[2].charAt(0);return r.join("")}function rE(e,t,n,i,r){var s=[Dn(Math.round(e).toString(16)),Dn(Math.round(t).toString(16)),Dn(Math.round(n).toString(16)),Dn(X_(i))];if(r&&s[0].charAt(0)==s[0].charAt(1)&&s[1].charAt(0)==s[1].charAt(1)&&s[2].charAt(0)==s[2].charAt(1)&&s[3].charAt(0)==s[3].charAt(1))return s[0].charAt(0)+s[1].charAt(0)+s[2].charAt(0)+s[3].charAt(0);return s.join("")}function G_(e,t,n,i){var r=[Dn(X_(i)),Dn(Math.round(e).toString(16)),Dn(Math.round(t).toString(16)),Dn(Math.round(n).toString(16))];return r.join("")}Ee.equals=function(e,t){if(!e||!t)return!1;return Ee(e).toRgbString()==Ee(t).toRgbString()};Ee.random=function(){return Ee.fromRatio({r:Math.random(),g:Math.random(),b:Math.random()})};function sE(e,t){t=t===0?0:t||10;var n=Ee(e).toHsl();return n.s-=t/100,n.s=za(n.s),Ee(n)}function oE(e,t){t=t===0?0:t||10;var n=Ee(e).toHsl();return n.s+=t/100,n.s=za(n.s),Ee(n)}function aE(e){return Ee(e).desaturate(100)}function lE(e,t){t=t===0?0:t||10;var n=Ee(e).toHsl();return n.l+=t/100,n.l=za(n.l),Ee(n)}function cE(e,t){t=t===0?0:t||10;var n=Ee(e).toRgb();return n.r=Math.max(0,Math.min(255,n.r-Math.round(255*-(t/100)))),n.g=Math.max(0,Math.min(255,n.g-Math.round(255*-(t/100)))),n.b=Math.max(0,Math.min(255,n.b-Math.round(255*-(t/100)))),Ee(n)}function hE(e,t){t=t===0?0:t||10;var n=Ee(e).toHsl();return n.l-=t/100,n.l=za(n.l),Ee(n)}function uE(e,t){var n=Ee(e).toHsl(),i=(n.h+t)%360;return n.h=i<0?360+i:i,Ee(n)}function fE(e){var t=Ee(e).toHsl();return t.h=(t.h+180)%360,Ee(t)}function H_(e,t){if(isNaN(t)||t<=0)throw Error("Argument to polyad must be a positive number");var n=Ee(e).toHsl(),i=[Ee(e)],r=360/t;for(var s=1;s<t;s++)i.push(Ee({h:(n.h+s*r)%360,s:n.s,l:n.l}));return i}function dE(e){var t=Ee(e).toHsl(),n=t.h;return[Ee(e),Ee({h:(n+72)%360,s:t.s,l:t.l}),Ee({h:(n+216)%360,s:t.s,l:t.l})]}function pE(e,t,n){t=t||6,n=n||30;var i=Ee(e).toHsl(),r=360/n,s=[Ee(e)];for(i.h=(i.h-(r*t>>1)+720)%360;--t;)i.h=(i.h+r)%360,s.push(Ee(i));return s}function mE(e,t){t=t||6;var n=Ee(e).toHsv(),{h:i,s:r,v:s}=n,o=[],a=1/t;while(t--)o.push(Ee({h:i,s:r,v:s})),s=(s+a)%1;return o}Ee.mix=function(e,t,n){n=n===0?0:n||50;var i=Ee(e).toRgb(),r=Ee(t).toRgb(),s=n/100,o={r:(r.r-i.r)*s+i.r,g:(r.g-i.g)*s+i.g,b:(r.b-i.b)*s+i.b,a:(r.a-i.a)*s+i.a};return Ee(o)};Ee.readability=function(e,t){var n=Ee(e),i=Ee(t);return(Math.max(n.getLuminance(),i.getLuminance())+0.05)/(Math.min(n.getLuminance(),i.getLuminance())+0.05)};Ee.isReadable=function(e,t,n){var i=Ee.readability(e,t),r,s;switch(s=!1,r=bE(n),r.level+r.size){case"AAsmall":case"AAAlarge":s=i>=4.5;break;case"AAlarge":s=i>=3;break;case"AAAsmall":s=i>=7;break}return s};Ee.mostReadable=function(e,t,n){var i=null,r=0,s,o,a,l;n=n||{},o=n.includeFallbackColors,a=n.level,l=n.size;for(var c=0;c<t.length;c++)if(s=Ee.readability(e,t[c]),s>r)r=s,i=Ee(t[c]);if(Ee.isReadable(e,i,{level:a,size:l})||!o)return i;else return n.includeFallbackColors=!1,Ee.mostReadable(e,["#fff","#000"],n)};var Zu=Ee.names={aliceblue:"f0f8ff",antiquewhite:"faebd7",aqua:"0ff",aquamarine:"7fffd4",azure:"f0ffff",beige:"f5f5dc",bisque:"ffe4c4",black:"000",blanchedalmond:"ffebcd",blue:"00f",blueviolet:"8a2be2",brown:"a52a2a",burlywood:"deb887",burntsienna:"ea7e5d",cadetblue:"5f9ea0",chartreuse:"7fff00",chocolate:"d2691e",coral:"ff7f50",cornflowerblue:"6495ed",cornsilk:"fff8dc",crimson:"dc143c",cyan:"0ff",darkblue:"00008b",darkcyan:"008b8b",darkgoldenrod:"b8860b",darkgray:"a9a9a9",darkgreen:"006400",darkgrey:"a9a9a9",darkkhaki:"bdb76b",darkmagenta:"8b008b",darkolivegreen:"556b2f",darkorange:"ff8c00",darkorchid:"9932cc",darkred:"8b0000",darksalmon:"e9967a",darkseagreen:"8fbc8f",darkslateblue:"483d8b",darkslategray:"2f4f4f",darkslategrey:"2f4f4f",darkturquoise:"00ced1",darkviolet:"9400d3",deeppink:"ff1493",deepskyblue:"00bfff",dimgray:"696969",dimgrey:"696969",dodgerblue:"1e90ff",firebrick:"b22222",floralwhite:"fffaf0",forestgreen:"228b22",fuchsia:"f0f",gainsboro:"dcdcdc",ghostwhite:"f8f8ff",gold:"ffd700",goldenrod:"daa520",gray:"808080",green:"008000",greenyellow:"adff2f",grey:"808080",honeydew:"f0fff0",hotpink:"ff69b4",indianred:"cd5c5c",indigo:"4b0082",ivory:"fffff0",khaki:"f0e68c",lavender:"e6e6fa",lavenderblush:"fff0f5",lawngreen:"7cfc00",lemonchiffon:"fffacd",lightblue:"add8e6",lightcoral:"f08080",lightcyan:"e0ffff",lightgoldenrodyellow:"fafad2",lightgray:"d3d3d3",lightgreen:"90ee90",lightgrey:"d3d3d3",lightpink:"ffb6c1",lightsalmon:"ffa07a",lightseagreen:"20b2aa",lightskyblue:"87cefa",lightslategray:"789",lightslategrey:"789",lightsteelblue:"b0c4de",lightyellow:"ffffe0",lime:"0f0",limegreen:"32cd32",linen:"faf0e6",magenta:"f0f",maroon:"800000",mediumaquamarine:"66cdaa",mediumblue:"0000cd",mediumorchid:"ba55d3",mediumpurple:"9370db",mediumseagreen:"3cb371",mediumslateblue:"7b68ee",mediumspringgreen:"00fa9a",mediumturquoise:"48d1cc",mediumvioletred:"c71585",midnightblue:"191970",mintcream:"f5fffa",mistyrose:"ffe4e1",moccasin:"ffe4b5",navajowhite:"ffdead",navy:"000080",oldlace:"fdf5e6",olive:"808000",olivedrab:"6b8e23",orange:"ffa500",orangered:"ff4500",orchid:"da70d6",palegoldenrod:"eee8aa",palegreen:"98fb98",paleturquoise:"afeeee",palevioletred:"db7093",papayawhip:"ffefd5",peachpuff:"ffdab9",peru:"cd853f",pink:"ffc0cb",plum:"dda0dd",powderblue:"b0e0e6",purple:"800080",rebeccapurple:"663399",red:"f00",rosybrown:"bc8f8f",royalblue:"4169e1",saddlebrown:"8b4513",salmon:"fa8072",sandybrown:"f4a460",seagreen:"2e8b57",seashell:"fff5ee",sienna:"a0522d",silver:"c0c0c0",skyblue:"87ceeb",slateblue:"6a5acd",slategray:"708090",slategrey:"708090",snow:"fffafa",springgreen:"00ff7f",steelblue:"4682b4",tan:"d2b48c",teal:"008080",thistle:"d8bfd8",tomato:"ff6347",turquoise:"40e0d0",violet:"ee82ee",wheat:"f5deb3",white:"fff",whitesmoke:"f5f5f5",yellow:"ff0",yellowgreen:"9acd32"},gE=Ee.hexNames=_E(Zu);function _E(e){var t={};for(var n in e)if(e.hasOwnProperty(n))t[e[n]]=n;return t}function W_(e){if(e=parseFloat(e),isNaN(e)||e<0||e>1)e=1;return e}function _t(e,t){if(vE(e))e="100%";var n=yE(e);if(e=Math.min(t,Math.max(0,parseFloat(e))),n)e=parseInt(e*t,10)/100;if(Math.abs(e-t)<0.000001)return 1;return e%t/parseFloat(t)}function za(e){return Math.min(1,Math.max(0,e))}function mn(e){return parseInt(e,16)}function vE(e){return typeof e=="string"&&e.indexOf(".")!=-1&&parseFloat(e)===1}function yE(e){return typeof e==="string"&&e.indexOf("%")!=-1}function Dn(e){return e.length==1?"0"+e:""+e}function js(e){if(e<=1)e=e*100+"%";return e}function X_(e){return Math.round(parseFloat(e)*255).toString(16)}function V_(e){return mn(e)/255}var Ln=function(){var e="[-\\+]?\\d+%?",t="[-\\+]?\\d*\\.\\d+%?",n="(?:"+t+")|(?:"+e+")",i="[\\s|\\(]+("+n+")[,|\\s]+("+n+")[,|\\s]+("+n+")\\s*\\)?",r="[\\s|\\(]+("+n+")[,|\\s]+("+n+")[,|\\s]+("+n+")[,|\\s]+("+n+")\\s*\\)?";return{CSS_UNIT:new RegExp(n),rgb:new RegExp("rgb"+i),rgba:new RegExp("rgba"+r),hsl:new RegExp("hsl"+i),hsla:new RegExp("hsla"+r),hsv:new RegExp("hsv"+i),hsva:new RegExp("hsva"+r),hex3:/^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,hex6:/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,hex4:/^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,hex8:/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/}}();function oi(e){return!!Ln.CSS_UNIT.exec(e)}function xE(e){e=e.replace(K1,"").replace(Q1,"").toLowerCase();var t=!1;if(Zu[e])e=Zu[e],t=!0;else if(e=="transparent")return{r:0,g:0,b:0,a:0,format:"name"};var n;if(n=Ln.rgb.exec(e))return{r:n[1],g:n[2],b:n[3]};if(n=Ln.rgba.exec(e))return{r:n[1],g:n[2],b:n[3],a:n[4]};if(n=Ln.hsl.exec(e))return{h:n[1],s:n[2],l:n[3]};if(n=Ln.hsla.exec(e))return{h:n[1],s:n[2],l:n[3],a:n[4]};if(n=Ln.hsv.exec(e))return{h:n[1],s:n[2],v:n[3]};if(n=Ln.hsva.exec(e))return{h:n[1],s:n[2],v:n[3],a:n[4]};if(n=Ln.hex8.exec(e))return{r:mn(n[1]),g:mn(n[2]),b:mn(n[3]),a:V_(n[4]),format:t?"name":"hex8"};if(n=Ln.hex6.exec(e))return{r:mn(n[1]),g:mn(n[2]),b:mn(n[3]),format:t?"name":"hex"};if(n=Ln.hex4.exec(e))return{r:mn(n[1]+""+n[1]),g:mn(n[2]+""+n[2]),b:mn(n[3]+""+n[3]),a:V_(n[4]+""+n[4]),format:t?"name":"hex8"};if(n=Ln.hex3.exec(e))return{r:mn(n[1]+""+n[1]),g:mn(n[2]+""+n[2]),b:mn(n[3]+""+n[3]),format:t?"name":"hex"};return!1}function bE(e){var t,n;if(e=e||{level:"AA",size:"small"},t=(e.level||"AA").toUpperCase(),n=(e.size||"small").toLowerCase(),t!=="AA"&&t!=="AAA")t="AA";if(n!=="small"&&n!=="large")n="small";return{level:t,size:n}}var Z_=(e)=>{if(e instanceof Array)e.forEach(Z_);else{if(e.map)e.map.dispose();e.dispose()}},Qu=(e)=>{if(e.geometry)e.geometry.dispose();if(e.material)Z_(e.material);if(e.texture)e.texture.dispose();if(e.children)e.children.forEach(Qu)},q_=(e)=>{while(e.children.length){let t=e.children[0];e.remove(t),Qu(t)}};class Zr extends U_{constructor(e,{dataBindAttr:t="__data",objBindAttr:n="__threeObj"}={}){super();this.scene=e,this.#t=t,this.#e=n,this.onRemoveObj(()=>{})}onCreateObj(e){return super.onCreateObj((t)=>{let n=e(t);return t[this.#e]=n,n[this.#t]=t,this.scene.add(n),n}),this}onRemoveObj(e){return super.onRemoveObj((t,n)=>{let i=super.getData(t);e(t,n),this.scene.remove(t),Qu(t),delete i[this.#e]}),this}scene;#t;#e}var Ys=(e)=>isNaN(e)?parseInt(Ee(e).toHex(),16):e,Ju=(e)=>isNaN(e)?Ee(e).getAlpha():1,SE=qs($u);function j_(e,t,n){if(!t||typeof n!=="string")return;e.filter((i)=>!i[n]).forEach((i)=>{i[n]=SE(t(i))})}function ME({nodes:e,links:t},n,{nodeFilter:i=()=>!0,onLoopError:r=(s)=>{throw`Invalid DAG structure! Found cycle in node path: ${s.join(" -> ")}.`}}={}){let s={};e.forEach((c)=>s[n(c)]={data:c,out:[],depth:-1,skip:!i(c)}),t.forEach(({source:c,target:h})=>{let f=y(c),u=y(h);if(!s.hasOwnProperty(f))throw`Missing source node with id: ${f}`;if(!s.hasOwnProperty(u))throw`Missing target node with id: ${u}`;let p=s[f],g=s[u];p.out.push(g);function y(m){return typeof m==="object"?n(m):m}});let o=[];return l(Object.values(s)),Object.assign({},...Object.entries(s).filter(([,c])=>!c.skip).map(([c,h])=>({[c]:h.depth})));function l(c,h=[],f=0){for(let u=0,p=c.length;u<p;u++){let g=c[u];if(h.indexOf(g)!==-1){let y=[...h.slice(h.indexOf(g)),g].map((m)=>n(m.data));if(!o.some((m)=>m.length===y.length&&m.every((d,b)=>d===y[b])))o.push(y),r(y);continue}if(f>g.depth)g.depth=f,l(g.out,[...h,g],f+(g.skip?0:1))}}}var Ne=window.THREE?window.THREE:{Group:Kn,Mesh:Bt,MeshLambertMaterial:la,Color:ke,BufferGeometry:Rt,BufferAttribute:sn,Matrix4:Ke,Vector3:L,SphereGeometry:Xi,CylinderGeometry:Fr,TubeGeometry:As,ConeGeometry:ws,Line:na,LineBasicMaterial:Ms,QuadraticBezierCurve3:Br,CubicBezierCurve3:Es,Box3:Pn},Y_={graph:zg,forcelayout:$_.default},wE=2,Ku=new Ne.BufferGeometry().setAttribute?"setAttribute":"addAttribute",Ga=new Ne.BufferGeometry().applyMatrix4?"applyMatrix4":"applyMatrix",EE=bi({props:{jsonUrl:{onChange:function(e,t){if(e&&!t.fetchingJson)t.fetchingJson=!0,t.onLoading(),fetch(e).then((n)=>n.json()).then((n)=>{t.fetchingJson=!1,t.onFinishLoading(n),this.graphData(n)})},triggerUpdate:!1},graphData:{default:{nodes:[],links:[]},onChange(e,t){t.engineRunning=!1}},numDimensions:{default:3,onChange(e,t){let n=t.d3ForceLayout.force("charge");if(n)n.strength(e>2?-60:-30);if(e<3)i(t.graphData.nodes,"z");if(e<2)i(t.graphData.nodes,"y");function i(r,s){r.forEach((o)=>{delete o[s],delete o[`v${s}`]})}}},dagMode:{onChange(e,t){!e&&t.forceEngine==="d3"&&(t.graphData.nodes||[]).forEach((n)=>n.fx=n.fy=n.fz=void 0)}},dagLevelDistance:{},dagNodeFilter:{default:(e)=>!0},onDagError:{triggerUpdate:!1},nodeRelSize:{default:4},nodeId:{default:"id"},nodeVal:{default:"val"},nodeResolution:{default:8},nodeColor:{default:"color"},nodeAutoColorBy:{},nodeOpacity:{default:0.75},nodeVisibility:{default:!0},nodeThreeObject:{},nodeThreeObjectExtend:{default:!1},nodePositionUpdate:{triggerUpdate:!1},linkSource:{default:"source"},linkTarget:{default:"target"},linkVisibility:{default:!0},linkColor:{default:"color"},linkAutoColorBy:{},linkOpacity:{default:0.2},linkWidth:{},linkResolution:{default:6},linkCurvature:{default:0,triggerUpdate:!1},linkCurveRotation:{default:0,triggerUpdate:!1},linkMaterial:{},linkThreeObject:{},linkThreeObjectExtend:{default:!1},linkPositionUpdate:{triggerUpdate:!1},linkDirectionalArrowLength:{default:0},linkDirectionalArrowColor:{},linkDirectionalArrowRelPos:{default:0.5,triggerUpdate:!1},linkDirectionalArrowResolution:{default:8},linkDirectionalParticles:{default:0},linkDirectionalParticleSpeed:{default:0.01,triggerUpdate:!1},linkDirectionalParticleOffset:{default:0,triggerUpdate:!1},linkDirectionalParticleWidth:{default:0.5},linkDirectionalParticleColor:{},linkDirectionalParticleResolution:{default:4},linkDirectionalParticleThreeObject:{},forceEngine:{default:"d3"},d3AlphaMin:{default:0},d3AlphaDecay:{default:0.0228,triggerUpdate:!1,onChange(e,t){t.d3ForceLayout.alphaDecay(e)}},d3AlphaTarget:{default:0,triggerUpdate:!1,onChange(e,t){t.d3ForceLayout.alphaTarget(e)}},d3VelocityDecay:{default:0.4,triggerUpdate:!1,onChange(e,t){t.d3ForceLayout.velocityDecay(e)}},ngraphPhysics:{default:{timeStep:20,gravity:-1.2,theta:0.8,springLength:30,springCoefficient:0.0008,dragCoefficient:0.02}},warmupTicks:{default:0,triggerUpdate:!1},cooldownTicks:{default:1/0,triggerUpdate:!1},cooldownTime:{default:15000,triggerUpdate:!1},onLoading:{default:()=>{},triggerUpdate:!1},onFinishLoading:{default:()=>{},triggerUpdate:!1},onUpdate:{default:()=>{},triggerUpdate:!1},onFinishUpdate:{default:()=>{},triggerUpdate:!1},onEngineTick:{default:()=>{},triggerUpdate:!1},onEngineStop:{default:()=>{},triggerUpdate:!1}},methods:{refresh:function(e){return e._flushObjects=!0,e._rerender(),this},d3Force:function(e,t,n){if(n===void 0)return e.d3ForceLayout.force(t);return e.d3ForceLayout.force(t,n),this},d3ReheatSimulation:function(e){return e.d3ForceLayout.alpha(1),this.resetCountdown(),this},resetCountdown:function(e){return e.cntTicks=0,e.startTickTime=new Date,e.engineRunning=!0,this},tickFrame:function(e){let t=e.forceEngine!=="ngraph";if(e.engineRunning&&e.layout)n();return i(),r(),this;function n(){if(++e.cntTicks>e.cooldownTicks||new Date-e.startTickTime>e.cooldownTime||t&&e.d3AlphaMin>0&&e.d3ForceLayout.alpha()<e.d3AlphaMin)e.engineRunning=!1,e.onEngineStop();else e.layout[t?"tick":"step"](),e.onEngineTick();let s=ze(e.nodeThreeObjectExtend);e.nodeDataMapper.entries().forEach(([f,u])=>{if(!u)return;let p=t?f:e.layout.getNodePosition(f[e.nodeId]),g=s(f);if(!e.nodePositionUpdate||!e.nodePositionUpdate(g?u.children[0]:u,{x:p.x,y:p.y,z:p.z},f)||g)u.position.x=p.x,u.position.y=p.y||0,u.position.z=p.z||0});let o=ze(e.linkWidth),a=ze(e.linkCurvature),l=ze(e.linkCurveRotation),c=ze(e.linkThreeObjectExtend);e.linkDataMapper.entries().forEach(([f,u])=>{if(!u)return;let p=t?f:e.layout.getLinkPosition(e.layout.graph.getLink(f.source,f.target).id),g=p[t?"source":"from"],y=p[t?"target":"to"];if(!g||!y||!g.hasOwnProperty("x")||!y.hasOwnProperty("x"))return;h(f);let m=c(f);if(e.linkPositionUpdate&&e.linkPositionUpdate(m?u.children[1]:u,{start:{x:g.x,y:g.y,z:g.z},end:{x:y.x,y:y.y,z:y.z}},f)&&!m)return;let d=30,b=f.__curve,S=u.children.length?u.children[0]:u;if(S.type==="Line"){if(!b){let _=S.geometry.getAttribute("position");if(!_||!_.array||_.array.length!==6)S.geometry[Ku]("position",_=new Ne.BufferAttribute(new Float32Array(6),3));_.array[0]=g.x,_.array[1]=g.y||0,_.array[2]=g.z||0,_.array[3]=y.x,_.array[4]=y.y||0,_.array[5]=y.z||0,_.needsUpdate=!0}else{let _=b.getPoints(d);if(S.geometry.getAttribute("position").array.length!==_.length*3)S.geometry[Ku]("position",new Ne.BufferAttribute(new Float32Array(_.length*3),3));S.geometry.setFromPoints(_)}S.geometry.computeBoundingSphere()}else if(S.type==="Mesh")if(!b){if(!S.geometry.type.match(/^Cylinder(Buffer)?Geometry$/)){let v=Math.ceil(o(f)*10)/10/2,A=new Ne.CylinderGeometry(v,v,1,e.linkResolution,1,!1);A[Ga](new Ne.Matrix4().makeTranslation(0,0.5,0)),A[Ga](new Ne.Matrix4().makeRotationX(Math.PI/2)),S.geometry.dispose(),S.geometry=A}let _=new Ne.Vector3(g.x,g.y||0,g.z||0),x=new Ne.Vector3(y.x,y.y||0,y.z||0),w=_.distanceTo(x);S.position.x=_.x,S.position.y=_.y,S.position.z=_.z,S.scale.z=w,S.parent.localToWorld(x),S.lookAt(x)}else{if(!S.geometry.type.match(/^Tube(Buffer)?Geometry$/))S.position.set(0,0,0),S.rotation.set(0,0,0),S.scale.set(1,1,1);let x=Math.ceil(o(f)*10)/10/2,w=new Ne.TubeGeometry(b,d,x,e.linkResolution,!1);S.geometry.dispose(),S.geometry=w}});function h(f){let u=t?f:e.layout.getLinkPosition(e.layout.graph.getLink(f.source,f.target).id),p=u[t?"source":"from"],g=u[t?"target":"to"];if(!p||!g||!p.hasOwnProperty("x")||!g.hasOwnProperty("x"))return;let y=a(f);if(!y)f.__curve=null;else{let m=new Ne.Vector3(p.x,p.y||0,p.z||0),d=new Ne.Vector3(g.x,g.y||0,g.z||0),b=m.distanceTo(d),S,_=l(f);if(b>0){let x=g.x-p.x,w=g.y-p.y||0,T=new Ne.Vector3().subVectors(d,m),v=T.clone().multiplyScalar(y).cross(x!==0||w!==0?new Ne.Vector3(0,0,1):new Ne.Vector3(0,1,0)).applyAxisAngle(T.normalize(),_).add(new Ne.Vector3().addVectors(m,d).divideScalar(2));S=new Ne.QuadraticBezierCurve3(m,v,d)}else{let x=y*70,w=-_,T=w+Math.PI/2;S=new Ne.CubicBezierCurve3(m,new Ne.Vector3(x*Math.cos(T),x*Math.sin(T),0).add(m),new Ne.Vector3(x*Math.cos(w),x*Math.sin(w),0).add(m),d)}f.__curve=S}}}function i(){let s=ze(e.linkDirectionalArrowRelPos),o=ze(e.linkDirectionalArrowLength),a=ze(e.nodeVal);e.arrowDataMapper.entries().forEach(([l,c])=>{if(!c)return;let h=t?l:e.layout.getLinkPosition(e.layout.graph.getLink(l.source,l.target).id),f=h[t?"source":"from"],u=h[t?"target":"to"];if(!f||!u||!f.hasOwnProperty("x")||!u.hasOwnProperty("x"))return;let p=Math.cbrt(Math.max(0,a(f)||1))*e.nodeRelSize,g=Math.cbrt(Math.max(0,a(u)||1))*e.nodeRelSize,y=o(l),m=s(l),d=l.__curve?(T)=>l.__curve.getPoint(T):(T)=>{let v=(A,N,P,D)=>N[A]+(P[A]-N[A])*D||0;return{x:v("x",f,u,T),y:v("y",f,u,T),z:v("z",f,u,T)}},b=l.__curve?l.__curve.getLength():Math.sqrt(["x","y","z"].map((T)=>Math.pow((u[T]||0)-(f[T]||0),2)).reduce((T,v)=>T+v,0)),S=p+y+(b-p-g-y)*m,_=d(S/b),x=d((S-y)/b);["x","y","z"].forEach((T)=>c.position[T]=x[T]);let w=new Ne.Vector3(...["x","y","z"].map((T)=>_[T]));c.parent.localToWorld(w),c.lookAt(w)})}function r(){let s=ze(e.linkDirectionalParticleSpeed),o=ze(e.linkDirectionalParticleOffset);e.graphData.links.forEach((a)=>{let l=e.particlesDataMapper.getObj(a),c=l&&l.children,h=a.__singleHopPhotonsObj&&a.__singleHopPhotonsObj.children;if((!h||!h.length)&&(!c||!c.length))return;let f=t?a:e.layout.getLinkPosition(e.layout.graph.getLink(a.source,a.target).id),u=f[t?"source":"from"],p=f[t?"target":"to"];if(!u||!p||!u.hasOwnProperty("x")||!p.hasOwnProperty("x"))return;let g=s(a),y=Math.abs(o(a)),m=a.__curve?(b)=>a.__curve.getPoint(b):(b)=>{let S=(_,x,w,T)=>x[_]+(w[_]-x[_])*T||0;return{x:S("x",u,p,b),y:S("y",u,p,b),z:S("z",u,p,b)}};[...c||[],...h||[]].forEach((b,S)=>{let _=b.parent.__linkThreeObjType==="singleHopPhotons";if(!b.hasOwnProperty("__progressRatio"))b.__progressRatio=_?g<0?1:0:(S+y)/c.length;if(b.__progressRatio+=g,b.__progressRatio>=1||b.__progressRatio<0)if(!_)b.__progressRatio=b.__progressRatio%1,b.__progressRatio<0&&b.__progressRatio++;else{b.parent.remove(b),q_(b);return}let x=b.__progressRatio,w=m(x);b.geometry.type!=="SphereGeometry"&&b.lookAt(w.x,w.y,w.z),["x","y","z"].forEach((T)=>b.position[T]=w[T])})})}},emitParticle:function(e,t){if(t&&e.graphData.links.includes(t)){if(!t.__singleHopPhotonsObj){let i=new Ne.Group;i.__linkThreeObjType="singleHopPhotons",t.__singleHopPhotonsObj=i,e.graphScene.add(i)}let n=ze(e.linkDirectionalParticleThreeObject)(t);if(n&&e.linkDirectionalParticleThreeObject===n)n=n.clone();if(!n){let i=ze(e.linkDirectionalParticleWidth),r=Math.ceil(i(t)*10)/10/2,s=e.linkDirectionalParticleResolution,o=new Ne.SphereGeometry(r,s,s),a=ze(e.linkColor),c=ze(e.linkDirectionalParticleColor)(t)||a(t)||"#f0f0f0",h=new Ne.Color(Ys(c)),f=e.linkOpacity*3,u=new Ne.MeshLambertMaterial({color:h,transparent:!0,opacity:f});n=new Ne.Mesh(o,u)}t.__singleHopPhotonsObj.add(n)}return this},getGraphBbox:function(e,t=()=>!0){if(!e.initialised)return null;let n=function i(r){let s=[];if(r.geometry){r.geometry.computeBoundingBox();let o=new Ne.Box3;o.copy(r.geometry.boundingBox).applyMatrix4(r.matrixWorld),s.push(o)}return s.concat(...(r.children||[]).filter((o)=>!o.hasOwnProperty("__graphObjType")||o.__graphObjType==="node"&&t(o.__data)).map(i))}(e.graphScene);if(!n.length)return null;return Object.assign(...["x","y","z"].map((i)=>({[i]:[Fa(n,(r)=>r.min[i]),Ua(n,(r)=>r.max[i])]})))}},stateInit:()=>({d3ForceLayout:Ra().force("link",Sa()).force("charge",Pa()).force("center",ba()).force("dagRadial",null).stop(),engineRunning:!1}),init(e,t){t.graphScene=e,t.nodeDataMapper=new Zr(e,{objBindAttr:"__threeObj"}),t.linkDataMapper=new Zr(e,{objBindAttr:"__lineObj"}),t.arrowDataMapper=new Zr(e,{objBindAttr:"__arrowObj"}),t.particlesDataMapper=new Zr(e,{objBindAttr:"__photonsObj"})},update(e,t){let n=(i)=>i.some((r)=>t.hasOwnProperty(r));if(e.engineRunning=!1,typeof e.onUpdate==="function"&&e.onUpdate(),e.nodeAutoColorBy!==null&&n(["nodeAutoColorBy","graphData","nodeColor"]))j_(e.graphData.nodes,ze(e.nodeAutoColorBy),e.nodeColor);if(e.linkAutoColorBy!==null&&n(["linkAutoColorBy","graphData","linkColor"]))j_(e.graphData.links,ze(e.linkAutoColorBy),e.linkColor);if(e._flushObjects||n(["graphData","nodeThreeObject","nodeThreeObjectExtend","nodeVal","nodeColor","nodeVisibility","nodeRelSize","nodeResolution","nodeOpacity"])){let i=ze(e.nodeThreeObject),r=ze(e.nodeThreeObjectExtend),s=ze(e.nodeVal),o=ze(e.nodeColor),a=ze(e.nodeVisibility),l={},c={};if(e._flushObjects||n(["nodeThreeObject","nodeThreeObjectExtend"]))e.nodeDataMapper.clear();e.nodeDataMapper.onCreateObj((h)=>{let f=i(h),u=r(h);if(f&&e.nodeThreeObject===f)f=f.clone();let p;if(f&&!u)p=f;else if(p=new Ne.Mesh,p.__graphDefaultObj=!0,f&&u)p.add(f);return p.__graphObjType="node",p}).onUpdateObj((h,f)=>{if(h.__graphDefaultObj){let u=s(f)||1,p=Math.cbrt(u)*e.nodeRelSize,g=e.nodeResolution;if(!h.geometry.type.match(/^Sphere(Buffer)?Geometry$/)||h.geometry.parameters.radius!==p||h.geometry.parameters.widthSegments!==g){if(!l.hasOwnProperty(u))l[u]=new Ne.SphereGeometry(p,g,g);h.geometry.dispose(),h.geometry=l[u]}let y=o(f),m=new Ne.Color(Ys(y||"#ffffaa")),d=e.nodeOpacity*Ju(y);if(h.material.type!=="MeshLambertMaterial"||!h.material.color.equals(m)||h.material.opacity!==d){if(!c.hasOwnProperty(y))c[y]=new Ne.MeshLambertMaterial({color:m,transparent:!0,opacity:d});h.material.dispose(),h.material=c[y]}}}).digest(e.graphData.nodes.filter(a))}if(e._flushObjects||n(["graphData","linkThreeObject","linkThreeObjectExtend","linkMaterial","linkColor","linkWidth","linkVisibility","linkResolution","linkOpacity","linkDirectionalArrowLength","linkDirectionalArrowColor","linkDirectionalArrowResolution","linkDirectionalParticles","linkDirectionalParticleWidth","linkDirectionalParticleColor","linkDirectionalParticleResolution","linkDirectionalParticleThreeObject"])){let i=ze(e.linkThreeObject),r=ze(e.linkThreeObjectExtend),s=ze(e.linkMaterial),o=ze(e.linkVisibility),a=ze(e.linkColor),l=ze(e.linkWidth),c={},h={},f={},u=e.graphData.links.filter(o);if(e._flushObjects||n(["linkThreeObject","linkThreeObjectExtend","linkWidth"]))e.linkDataMapper.clear();if(e.linkDataMapper.onRemoveObj((p)=>{let g=p.__data&&p.__data.__singleHopPhotonsObj;if(g)g.parent.remove(g),q_(g),delete p.__data.__singleHopPhotonsObj}).onCreateObj((p)=>{let g=i(p),y=r(p);if(g&&e.linkThreeObject===g)g=g.clone();let m;if(!g||y)if(!!l(p))m=new Ne.Mesh;else{let S=new Ne.BufferGeometry;S[Ku]("position",new Ne.BufferAttribute(new Float32Array(6),3)),m=new Ne.Line(S)}let d;if(!g)d=m,d.__graphDefaultObj=!0;else if(!y)d=g;else d=new Ne.Group,d.__graphDefaultObj=!0,d.add(m),d.add(g);return d.renderOrder=10,d.__graphObjType="link",d}).onUpdateObj((p,g)=>{if(p.__graphDefaultObj){let y=p.children.length?p.children[0]:p,m=Math.ceil(l(g)*10)/10,d=!!m;if(d){let S=m/2,_=e.linkResolution;if(!y.geometry.type.match(/^Cylinder(Buffer)?Geometry$/)||y.geometry.parameters.radiusTop!==S||y.geometry.parameters.radialSegments!==_){if(!c.hasOwnProperty(m)){let x=new Ne.CylinderGeometry(S,S,1,_,1,!1);x[Ga](new Ne.Matrix4().makeTranslation(0,0.5,0)),x[Ga](new Ne.Matrix4().makeRotationX(Math.PI/2)),c[m]=x}y.geometry.dispose(),y.geometry=c[m]}}let b=s(g);if(b)y.material=b;else{let S=a(g),_=new Ne.Color(Ys(S||"#f0f0f0")),x=e.linkOpacity*Ju(S),w=d?"MeshLambertMaterial":"LineBasicMaterial";if(y.material.type!==w||!y.material.color.equals(_)||y.material.opacity!==x){let T=d?h:f;if(!T.hasOwnProperty(S))T[S]=new Ne[w]({color:_,transparent:x<1,opacity:x,depthWrite:x>=1});y.material.dispose(),y.material=T[S]}}}}).digest(u),e.linkDirectionalArrowLength||t.hasOwnProperty("linkDirectionalArrowLength")){let p=ze(e.linkDirectionalArrowLength),g=ze(e.linkDirectionalArrowColor);e.arrowDataMapper.onCreateObj(()=>{let y=new Ne.Mesh(void 0,new Ne.MeshLambertMaterial({transparent:!0}));return y.__linkThreeObjType="arrow",y}).onUpdateObj((y,m)=>{let d=p(m),b=e.linkDirectionalArrowResolution;if(!y.geometry.type.match(/^Cone(Buffer)?Geometry$/)||y.geometry.parameters.height!==d||y.geometry.parameters.radialSegments!==b){let _=new Ne.ConeGeometry(d*0.25,d,b);_.translate(0,d/2,0),_.rotateX(Math.PI/2),y.geometry.dispose(),y.geometry=_}let S=g(m)||a(m)||"#f0f0f0";y.material.color=new Ne.Color(Ys(S)),y.material.opacity=e.linkOpacity*3*Ju(S)}).digest(u.filter(p))}if(e.linkDirectionalParticles||t.hasOwnProperty("linkDirectionalParticles")){let p=ze(e.linkDirectionalParticles),g=ze(e.linkDirectionalParticleWidth),y=ze(e.linkDirectionalParticleColor),m=ze(e.linkDirectionalParticleThreeObject),d={},b={};e.particlesDataMapper.onCreateObj(()=>{let S=new Ne.Group;return S.__linkThreeObjType="photons",S.__photonDataMapper=new Zr(S),S}).onUpdateObj((S,_)=>{let x=!!S.children.length&&S.children[0],w=m(_),T,v;if(w)T=w.geometry,v=w.material;else{let N=Math.ceil(g(_)*10)/10/2,P=e.linkDirectionalParticleResolution;if(x&&x.geometry.parameters.radius===N&&x.geometry.parameters.widthSegments===P)T=x.geometry;else{if(!b.hasOwnProperty(N))b[N]=new Ne.SphereGeometry(N,P,P);T=b[N]}let D=y(_)||a(_)||"#f0f0f0",W=new Ne.Color(Ys(D)),R=e.linkOpacity*3;if(x&&x.material.color.equals(W)&&x.material.opacity===R)v=x.material;else{if(!d.hasOwnProperty(D))d[D]=new Ne.MeshLambertMaterial({color:W,transparent:!0,opacity:R});v=d[D]}}if(x)x.geometry!==T&&x.geometry.dispose(),x.material!==v&&x.material.dispose();let A=Math.round(Math.abs(p(_)));S.__photonDataMapper.id((N)=>N.idx).onCreateObj(()=>new Ne.Mesh(T,v)).onUpdateObj((N)=>{N.geometry=T,N.material=v}).digest([...Array(A)].map((N,P)=>({idx:P})))}).digest(u.filter(p))}}if(e._flushObjects=!1,n(["graphData","nodeId","linkSource","linkTarget","numDimensions","forceEngine","dagMode","dagNodeFilter","dagLevelDistance"])){e.engineRunning=!1,e.graphData.links.forEach((s)=>{s.source=s[e.linkSource],s.target=s[e.linkTarget]});let i=e.forceEngine!=="ngraph",r;if(i){(r=e.d3ForceLayout).stop().alpha(1).numDimensions(e.numDimensions).nodes(e.graphData.nodes);let s=e.d3ForceLayout.force("link");if(s)s.id((c)=>c[e.nodeId]).links(e.graphData.links);let o=e.dagMode&&ME(e.graphData,(c)=>c[e.nodeId],{nodeFilter:e.dagNodeFilter,onLoopError:e.onDagError||void 0}),a=Math.max(...Object.values(o||[])),l=e.dagLevelDistance||e.graphData.nodes.length/(a||1)*wE*(["radialin","radialout"].indexOf(e.dagMode)!==-1?0.7:1);if(["lr","rl","td","bu","zin","zout"].includes(t.dagMode)){let c=["lr","rl"].includes(t.dagMode)?"fx":["td","bu"].includes(t.dagMode)?"fy":"fz";e.graphData.nodes.filter(e.dagNodeFilter).forEach((h)=>delete h[c])}if(["lr","rl","td","bu","zin","zout"].includes(e.dagMode)){let c=["rl","td","zout"].includes(e.dagMode),h=(u)=>(o[u[e.nodeId]]-a/2)*l*(c?-1:1),f=["lr","rl"].includes(e.dagMode)?"fx":["td","bu"].includes(e.dagMode)?"fy":"fz";e.graphData.nodes.filter(e.dagNodeFilter).forEach((u)=>u[f]=h(u))}e.d3ForceLayout.force("dagRadial",["radialin","radialout"].indexOf(e.dagMode)!==-1?Ia((c)=>{let h=o[c[e.nodeId]]||-1;return(e.dagMode==="radialin"?a-h:h)*l}).strength((c)=>e.dagNodeFilter(c)?1:0):null)}else{let s=Y_.graph();e.graphData.nodes.forEach((o)=>{s.addNode(o[e.nodeId])}),e.graphData.links.forEach((o)=>{s.addLink(o.source,o.target)}),r=Y_.forcelayout(s,{dimensions:e.numDimensions,...e.ngraphPhysics}),r.graph=s}for(let s=0;s<e.warmupTicks&&!(i&&e.d3AlphaMin>0&&e.d3ForceLayout.alpha()<e.d3AlphaMin);s++)r[i?"tick":"step"]();e.layout=r,this.resetCountdown()}e.engineRunning=!0,e.onFinishUpdate()}});function TE(e,t=Object,n=!1){class i extends t{constructor(...s){super(...s);this.__kapsuleInstance=new e(...[...n?[this]:[],...s])}}let r=e();return r._destructor?.(),Object.keys(r).forEach((s)=>i.prototype[s]=function(...o){let a=this.__kapsuleInstance[s](...o);return a===this.__kapsuleInstance?this:a}),i}var AE=window.THREE?window.THREE:{Group:Kn},ef=TE(EE,AE.Group,!0);var tf={type:"change"},sf={type:"start"},of={type:"end"},Ha=0.000001,et={NONE:-1,ROTATE:0,ZOOM:1,PAN:2,TOUCH_ROTATE:3,TOUCH_ZOOM_PAN:4},Va=new se,Si=new se,CE=new L,Wa=new L,nf=new L,Mi=new Ft,Xa=new L,qa=new L,rf=new L,ja=new L;class af extends zn{constructor(e,t=null){super(e,t);if(this.screen={left:0,top:0,width:0,height:0},this.rotateSpeed=1,this.zoomSpeed=1.2,this.panSpeed=0.3,this.rollSpeed=1,this.noRotate=!1,this.noZoom=!1,this.noPan=!1,this.multiTouchRoll=!1,this.staticMoving=!1,this.dynamicDampingFactor=0.2,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.keys=["KeyA","KeyS","KeyD"],this.mouseButtons={LEFT:St.ROTATE,MIDDLE:St.DOLLY,RIGHT:St.PAN},this.target=new L,this.state=et.NONE,this.keyState=et.NONE,this._lastPosition=new L,this._lastUp=new L,this._lastZoom=1,this._touchZoomDistanceStart=0,this._touchZoomDistanceEnd=0,this._touchRollAngle=0,this._touchRollPointerIds="",this._lastAngle=0,this._lastRollAngle=0,this._eye=new L,this._movePrev=new se,this._moveCurr=new se,this._lastAxis=new L,this._zoomStart=new se,this._zoomEnd=new se,this._panStart=new se,this._panEnd=new se,this._pointers=[],this._pointerPositions={},this._onPointerMove=PE.bind(this),this._onPointerDown=RE.bind(this),this._onPointerUp=IE.bind(this),this._onPointerCancel=LE.bind(this),this._onContextMenu=kE.bind(this),this._onMouseWheel=BE.bind(this),this._onKeyDown=NE.bind(this),this._onKeyUp=DE.bind(this),this._onTouchStart=zE.bind(this),this._onTouchMove=GE.bind(this),this._onTouchEnd=HE.bind(this),this._onMouseDown=OE.bind(this),this._onMouseMove=UE.bind(this),this._onMouseUp=FE.bind(this),this._target0=this.target.clone(),this._position0=this.object.position.clone(),this._up0=this.object.up.clone(),this._zoom0=this.object.zoom,t!==null)this.connect(t),this.handleResize();this.update()}connect(e){super.connect(e),window.addEventListener("keydown",this._onKeyDown),window.addEventListener("keyup",this._onKeyUp),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerCancel),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="none"}disconnect(){window.removeEventListener("keydown",this._onKeyDown),window.removeEventListener("keyup",this._onKeyUp),this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerCancel),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction=""}dispose(){this.disconnect()}handleResize(){let e=this.domElement.getBoundingClientRect(),t=this.domElement.ownerDocument.documentElement;this.screen.left=e.left+window.pageXOffset-t.clientLeft,this.screen.top=e.top+window.pageYOffset-t.clientTop,this.screen.width=e.width,this.screen.height=e.height}update(){if(this._eye.subVectors(this.object.position,this.target),!this.noRotate){if(this._rotateCamera(),this.multiTouchRoll===!0)this._rollCamera()}if(!this.noZoom)this._zoomCamera();if(!this.noPan)this._panCamera();if(this.object.position.addVectors(this.target,this._eye),this.object.isPerspectiveCamera){this._checkDistances(),this.object.lookAt(this.target);let e=this._lastPosition.distanceToSquared(this.object.position)>Ha,t=this._lastUp.distanceToSquared(this.object.up)>Ha;if(e||t)this.dispatchEvent(tf),this._lastPosition.copy(this.object.position),this._lastUp.copy(this.object.up)}else if(this.object.isOrthographicCamera){this.object.lookAt(this.target);let e=this._lastPosition.distanceToSquared(this.object.position)>Ha,t=this._lastUp.distanceToSquared(this.object.up)>Ha,n=this._lastZoom!==this.object.zoom;if(e||t||n)this.dispatchEvent(tf),this._lastPosition.copy(this.object.position),this._lastUp.copy(this.object.up),this._lastZoom=this.object.zoom}else console.warn("THREE.TrackballControls: Unsupported camera type.")}reset(){this.state=et.NONE,this.keyState=et.NONE,this.target.copy(this._target0),this.object.position.copy(this._position0),this.object.up.copy(this._up0),this.object.zoom=this._zoom0,this.object.updateProjectionMatrix(),this._eye.subVectors(this.object.position,this.target),this.object.lookAt(this.target),this.dispatchEvent(tf),this._lastPosition.copy(this.object.position),this._lastUp.copy(this.object.up),this._lastZoom=this.object.zoom}_panCamera(){if(Si.copy(this._panEnd).sub(this._panStart),Si.lengthSq()){if(this.object.isOrthographicCamera){let e=(this.object.right-this.object.left)/this.object.zoom/this.domElement.clientWidth,t=(this.object.top-this.object.bottom)/this.object.zoom/this.domElement.clientWidth;Si.x*=e,Si.y*=t}if(Si.multiplyScalar(this._eye.length()*this.panSpeed),Wa.copy(this._eye).cross(this.object.up).setLength(Si.x),Wa.add(CE.copy(this.object.up).setLength(Si.y)),this.object.position.add(Wa),this.target.add(Wa),this.staticMoving)this._panStart.copy(this._panEnd);else this._panStart.add(Si.subVectors(this._panEnd,this._panStart).multiplyScalar(this.dynamicDampingFactor))}}_rotateCamera(){ja.set(this._moveCurr.x-this._movePrev.x,this._moveCurr.y-this._movePrev.y,0);let e=ja.length();if(e)this._eye.copy(this.object.position).sub(this.target),Xa.copy(this._eye).normalize(),qa.copy(this.object.up).normalize(),rf.crossVectors(qa,Xa).normalize(),qa.setLength(this._moveCurr.y-this._movePrev.y),rf.setLength(this._moveCurr.x-this._movePrev.x),ja.copy(qa.add(rf)),nf.crossVectors(ja,this._eye).normalize(),e*=this.rotateSpeed,Mi.setFromAxisAngle(nf,e),this._eye.applyQuaternion(Mi),this.object.up.applyQuaternion(Mi),this._lastAxis.copy(nf),this._lastAngle=e;else if(!this.staticMoving&&this._lastAngle)this._lastAngle*=Math.sqrt(1-this.dynamicDampingFactor),this._eye.copy(this.object.position).sub(this.target),Mi.setFromAxisAngle(this._lastAxis,this._lastAngle),this._eye.applyQuaternion(Mi),this.object.up.applyQuaternion(Mi);this._movePrev.copy(this._moveCurr)}_rollCamera(){let e=this._getTouchRollAngle();if(e)this._lastRollAngle=e*this.rollSpeed;else if(!this.staticMoving&&this._lastRollAngle)this._lastRollAngle*=Math.sqrt(1-this.dynamicDampingFactor);else return;Xa.copy(this._eye).normalize(),Mi.setFromAxisAngle(Xa,this._lastRollAngle),this.object.up.applyQuaternion(Mi)}_getTouchRollAngle(){let e=this._pointers[0],t=this._pointers[1];if(t===void 0||e.pointerType!=="touch"||t.pointerType!=="touch")return this._touchRollPointerIds="",0;let n=`${e.pointerId},${t.pointerId}`,i=this._pointerPositions[e.pointerId],r=this._pointerPositions[t.pointerId],s=Math.atan2(r.y-i.y,r.x-i.x);if(n!==this._touchRollPointerIds)return this._touchRollPointerIds=n,this._touchRollAngle=s,0;let o=s-this._touchRollAngle;if(this._touchRollAngle=s,o>Math.PI)o-=2*Math.PI;else if(o<-Math.PI)o+=2*Math.PI;return o}_zoomCamera(){let e;if(this.state===et.TOUCH_ZOOM_PAN)if(e=this._touchZoomDistanceStart/this._touchZoomDistanceEnd,this._touchZoomDistanceStart=this._touchZoomDistanceEnd,this.object.isPerspectiveCamera)this._eye.multiplyScalar(e);else if(this.object.isOrthographicCamera){if(this.object.zoom=Dr.clamp(this.object.zoom/e,this.minZoom,this.maxZoom),this._lastZoom!==this.object.zoom)this.object.updateProjectionMatrix()}else console.warn("THREE.TrackballControls: Unsupported camera type");else{if(e=1+(this._zoomEnd.y-this._zoomStart.y)*this.zoomSpeed,e!==1&&e>0)if(this.object.isPerspectiveCamera)this._eye.multiplyScalar(e);else if(this.object.isOrthographicCamera){if(this.object.zoom=Dr.clamp(this.object.zoom/e,this.minZoom,this.maxZoom),this._lastZoom!==this.object.zoom)this.object.updateProjectionMatrix()}else console.warn("THREE.TrackballControls: Unsupported camera type");if(this.staticMoving)this._zoomStart.copy(this._zoomEnd);else this._zoomStart.y+=(this._zoomEnd.y-this._zoomStart.y)*this.dynamicDampingFactor}}_getMouseOnScreen(e,t){return Va.set((e-this.screen.left)/this.screen.width,(t-this.screen.top)/this.screen.height),Va}_getMouseOnCircle(e,t){return Va.set((e-this.screen.width*0.5-this.screen.left)/(this.screen.width*0.5),(this.screen.height+2*(this.screen.top-t))/this.screen.width),Va}_addPointer(e){this._pointers.push(e)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t].pointerId==e.pointerId){this._pointers.splice(t,1);return}}_trackPointer(e){let t=this._pointerPositions[e.pointerId];if(t===void 0)t=new se,this._pointerPositions[e.pointerId]=t;t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0].pointerId?this._pointers[1]:this._pointers[0];return this._pointerPositions[t.pointerId]}_checkDistances(){if(!this.noZoom||!this.noPan){if(this._eye.lengthSq()>this.maxDistance*this.maxDistance)this.object.position.addVectors(this.target,this._eye.setLength(this.maxDistance)),this._zoomStart.copy(this._zoomEnd);if(this._eye.lengthSq()<this.minDistance*this.minDistance)this.object.position.addVectors(this.target,this._eye.setLength(this.minDistance)),this._zoomStart.copy(this._zoomEnd)}}}function RE(e){if(this.enabled===!1)return;if(this._pointers.length===0)this.domElement.setPointerCapture(e.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp);if(this._addPointer(e),e.pointerType==="touch")this._onTouchStart(e);else this._onMouseDown(e)}function PE(e){if(this.enabled===!1)return;if(e.pointerType==="touch")this._onTouchMove(e);else this._onMouseMove(e)}function IE(e){if(this.enabled===!1)return;if(e.pointerType==="touch")this._onTouchEnd(e);else this._onMouseUp();if(this._removePointer(e),this._pointers.length===0)this.domElement.releasePointerCapture(e.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp)}function LE(e){this._removePointer(e)}function DE(){if(this.enabled===!1)return;this.keyState=et.NONE,window.addEventListener("keydown",this._onKeyDown)}function NE(e){if(this.enabled===!1)return;if(window.removeEventListener("keydown",this._onKeyDown),this.keyState!==et.NONE)return;else if(e.code===this.keys[et.ROTATE]&&!this.noRotate)this.keyState=et.ROTATE;else if(e.code===this.keys[et.ZOOM]&&!this.noZoom)this.keyState=et.ZOOM;else if(e.code===this.keys[et.PAN]&&!this.noPan)this.keyState=et.PAN}function OE(e){let t;switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case St.DOLLY:this.state=et.ZOOM;break;case St.ROTATE:this.state=et.ROTATE;break;case St.PAN:this.state=et.PAN;break;default:this.state=et.NONE}let n=this.keyState!==et.NONE?this.keyState:this.state;if(n===et.ROTATE&&!this.noRotate)this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY)),this._movePrev.copy(this._moveCurr);else if(n===et.ZOOM&&!this.noZoom)this._zoomStart.copy(this._getMouseOnScreen(e.pageX,e.pageY)),this._zoomEnd.copy(this._zoomStart);else if(n===et.PAN&&!this.noPan)this._panStart.copy(this._getMouseOnScreen(e.pageX,e.pageY)),this._panEnd.copy(this._panStart);this.dispatchEvent(sf)}function UE(e){let t=this.keyState!==et.NONE?this.keyState:this.state;if(t===et.ROTATE&&!this.noRotate)this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY));else if(t===et.ZOOM&&!this.noZoom)this._zoomEnd.copy(this._getMouseOnScreen(e.pageX,e.pageY));else if(t===et.PAN&&!this.noPan)this._panEnd.copy(this._getMouseOnScreen(e.pageX,e.pageY))}function FE(){this.state=et.NONE,this.dispatchEvent(of)}function BE(e){if(this.enabled===!1)return;if(this.noZoom===!0)return;switch(e.preventDefault(),e.deltaMode){case 2:this._zoomStart.y-=e.deltaY*0.025;break;case 1:this._zoomStart.y-=e.deltaY*0.01;break;default:this._zoomStart.y-=e.deltaY*0.00025;break}this.dispatchEvent(sf),this.dispatchEvent(of)}function kE(e){if(this.enabled===!1)return;e.preventDefault()}function zE(e){switch(this._trackPointer(e),this._pointers.length){case 1:this.state=et.TOUCH_ROTATE,this._moveCurr.copy(this._getMouseOnCircle(this._pointers[0].pageX,this._pointers[0].pageY)),this._movePrev.copy(this._moveCurr);break;default:this.state=et.TOUCH_ZOOM_PAN;let t=this._pointers[0].pageX-this._pointers[1].pageX,n=this._pointers[0].pageY-this._pointers[1].pageY;this._touchZoomDistanceEnd=this._touchZoomDistanceStart=Math.sqrt(t*t+n*n);let i=(this._pointers[0].pageX+this._pointers[1].pageX)/2,r=(this._pointers[0].pageY+this._pointers[1].pageY)/2;this._panStart.copy(this._getMouseOnScreen(i,r)),this._panEnd.copy(this._panStart);break}this.dispatchEvent(sf)}function GE(e){switch(this._trackPointer(e),this._pointers.length){case 1:this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY));break;default:let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y;this._touchZoomDistanceEnd=Math.sqrt(n*n+i*i);let r=(e.pageX+t.x)/2,s=(e.pageY+t.y)/2;this._panEnd.copy(this._getMouseOnScreen(r,s));break}}function HE(e){switch(this._pointers.length){case 0:this.state=et.NONE;break;case 1:this.state=et.TOUCH_ROTATE,this._moveCurr.copy(this._getMouseOnCircle(e.pageX,e.pageY)),this._movePrev.copy(this._moveCurr);break;case 2:this.state=et.TOUCH_ZOOM_PAN;for(let t=0;t<this._pointers.length;t++)if(this._pointers[t].pointerId!==e.pointerId){let n=this._pointerPositions[this._pointers[t].pointerId];this._moveCurr.copy(this._getMouseOnCircle(n.x,n.y)),this._movePrev.copy(this._moveCurr);break}break}this.dispatchEvent(of)}var J_={type:"change"},cf={type:"start"},Q_={type:"end"},Ya=new Vi,K_=new rn,VE=Math.cos(70*Dr.DEG2RAD),Dt=new L,ln=2*Math.PI,at={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},lf=0.000001;class hf extends zn{constructor(e,t=null){super(e,t);if(this.state=at.NONE,this.target=new L,this.cursor=new L,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=0.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:St.ROTATE,MIDDLE:St.DOLLY,RIGHT:St.PAN},this.touches={ONE:yn.ROTATE,TWO:yn.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new L,this._lastQuaternion=new Ft,this._lastTargetPosition=new L,this._quat=new Ft().setFromUnitVectors(e.up,new L(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Rs,this._sphericalDelta=new Rs,this._scale=1,this._panOffset=new L,this._rotateStart=new se,this._rotateEnd=new se,this._rotateDelta=new se,this._panStart=new se,this._panEnd=new se,this._panDelta=new se,this._dollyStart=new se,this._dollyEnd=new se,this._dollyDelta=new se,this._dollyDirection=new L,this._mouse=new se,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=XE.bind(this),this._onPointerDown=WE.bind(this),this._onPointerUp=qE.bind(this),this._onContextMenu=QE.bind(this),this._onMouseWheel=$E.bind(this),this._onKeyDown=ZE.bind(this),this._onTouchStart=JE.bind(this),this._onTouchMove=KE.bind(this),this._onMouseDown=jE.bind(this),this._onMouseMove=YE.bind(this),this._interceptControlDown=eT.bind(this),this._interceptControlUp=tT.bind(this),this.domElement!==null)this.connect(this.domElement);this.update()}set cursorStyle(e){if(this._cursorStyle=e,e==="grab")this.domElement.style.cursor="grab";else this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=at.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents();let e=this.domElement.getRootNode();e.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),e.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){if(this._domElementKeyEvents!==null)this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(J_),this.update(),this.state=at.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;if(Dt.copy(t).sub(this.target),Dt.applyQuaternion(this._quat),this._spherical.setFromVector3(Dt),this.autoRotate&&this.state===at.NONE)this._rotateLeft(this._getAutoRotationAngle(e));if(this.enableDamping)this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor;else this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi;let n=this.minAzimuthAngle,i=this.maxAzimuthAngle;if(isFinite(n)&&isFinite(i)){if(n<-Math.PI)n+=ln;else if(n>Math.PI)n-=ln;if(i<-Math.PI)i+=ln;else if(i>Math.PI)i-=ln;if(n<=i)this._spherical.theta=Math.max(n,Math.min(i,this._spherical.theta));else this._spherical.theta=this._spherical.theta>(n+i)/2?Math.max(n,this._spherical.theta):Math.min(i,this._spherical.theta)}if(this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0)this.target.addScaledVector(this._panOffset,this.dampingFactor);else this.target.add(this._panOffset);this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let s=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=s!=this._spherical.radius}if(Dt.setFromSpherical(this._spherical),Dt.applyQuaternion(this._quatInverse),t.copy(this.target).add(Dt),this.object.lookAt(this.target),this.enableDamping===!0)this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor);else this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0);if(this.zoomToCursor&&this._performCursorZoom){let s=null;if(this.object.isPerspectiveCamera){let o=Dt.length();s=this._clampDistance(o*this._scale);let a=o-s;this.object.position.addScaledVector(this._dollyDirection,a),this.object.updateMatrixWorld(),r=!!a}else if(this.object.isOrthographicCamera){let o=new L(this._mouse.x,this._mouse.y,0);o.unproject(this.object);let a=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=a!==this.object.zoom;let l=new L(this._mouse.x,this._mouse.y,0);l.unproject(this.object),this.object.position.sub(l).add(o),this.object.updateMatrixWorld(),s=Dt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;if(s!==null)if(this.screenSpacePanning)this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(s).add(this.object.position);else if(Ya.origin.copy(this.object.position),Ya.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Ya.direction))<VE)this.object.lookAt(this.target);else K_.setFromNormalAndCoplanarPoint(this.object.up,this.target),Ya.intersectPlane(K_,this.target)}else if(this.object.isOrthographicCamera){let s=this.object.zoom;if(this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),s!==this.object.zoom)this.object.updateProjectionMatrix(),r=!0}if(this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>lf||8*(1-this._lastQuaternion.dot(this.object.quaternion))>lf||this._lastTargetPosition.distanceToSquared(this.target)>lf)return this.dispatchEvent(J_),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0;return!1}_getAutoRotationAngle(e){if(e!==null)return ln/60*this.autoRotateSpeed*e;else return ln/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*0.01);return Math.pow(0.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Dt.setFromMatrixColumn(t,0),Dt.multiplyScalar(-e),this._panOffset.add(Dt)}_panUp(e,t){if(this.screenSpacePanning===!0)Dt.setFromMatrixColumn(t,1);else Dt.setFromMatrixColumn(t,0),Dt.crossVectors(this.object.up,Dt);Dt.multiplyScalar(e),this._panOffset.add(Dt)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let i=this.object.position;Dt.copy(i).sub(this.target);let r=Dt.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/n.clientHeight,this.object.matrix),this._panUp(2*t*r/n.clientHeight,this.object.matrix)}else if(this.object.isOrthographicCamera)this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix);else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1}_dollyOut(e){if(this.object.isPerspectiveCamera||this.object.isOrthographicCamera)this._scale/=e;else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1}_dollyIn(e){if(this.object.isPerspectiveCamera||this.object.isOrthographicCamera)this._scale*=e;else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),i=e-n.left,r=t-n.top,{width:s,height:o}=n;this._mouse.x=i/s*2-1,this._mouse.y=-(r/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(ln*this._rotateDelta.x/t.clientHeight),this._rotateUp(ln*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){if(this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0)this._dollyOut(this._getZoomScale(this._dollyDelta.y));else if(this._dollyDelta.y<0)this._dollyIn(this._getZoomScale(this._dollyDelta.y));this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){if(this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0)this._dollyIn(this._getZoomScale(e.deltaY));else if(e.deltaY>0)this._dollyOut(this._getZoomScale(e.deltaY));this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateUp(ln*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(0,this.keyPanSpeed);t=!0;break;case this.keys.BOTTOM:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateUp(-ln*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(0,-this.keyPanSpeed);t=!0;break;case this.keys.LEFT:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateLeft(ln*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(this.keyPanSpeed,0);t=!0;break;case this.keys.RIGHT:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate)this._rotateLeft(-ln*this.keyRotateSpeed/this.domElement.clientHeight)}else if(this.enablePan)this._pan(-this.keyPanSpeed,0);t=!0;break}if(t)e.preventDefault(),this.update()}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=0.5*(e.pageX+t.x),i=0.5*(e.pageY+t.y);this._rotateStart.set(n,i)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=0.5*(e.pageX+t.x),i=0.5*(e.pageY+t.y);this._panStart.set(n,i)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y,r=Math.sqrt(n*n+i*i);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){if(this.enableZoom)this._handleTouchStartDolly(e);if(this.enablePan)this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){if(this.enableZoom)this._handleTouchStartDolly(e);if(this.enableRotate)this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let n=this._getSecondPointerPosition(e),i=0.5*(e.pageX+n.x),r=0.5*(e.pageY+n.y);this._rotateEnd.set(i,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(ln*this._rotateDelta.x/t.clientHeight),this._rotateUp(ln*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=0.5*(e.pageX+t.x),i=0.5*(e.pageY+t.y);this._panEnd.set(n,i)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y,r=Math.sqrt(n*n+i*i);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let s=(e.pageX+t.x)*0.5,o=(e.pageY+t.y)*0.5;this._updateZoomParameters(s,o)}_handleTouchMoveDollyPan(e){if(this.enableZoom)this._handleTouchMoveDolly(e);if(this.enablePan)this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){if(this.enableZoom)this._handleTouchMoveDolly(e);if(this.enableRotate)this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];if(t===void 0)t=new se,this._pointerPositions[e.pointerId]=t;t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}if(e.ctrlKey&&!this._controlActive)n.deltaY*=10;return n}}function WE(e){if(this.enabled===!1)return;if(this._pointers.length===0)this.domElement.setPointerCapture(e.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp);if(this._isTrackingPointer(e))return;if(this._addPointer(e),e.pointerType==="touch")this._onTouchStart(e);else this._onMouseDown(e);if(this._cursorStyle==="grab")this.domElement.style.cursor="grabbing"}function XE(e){if(this.enabled===!1)return;if(e.pointerType==="touch")this._onTouchMove(e);else this._onMouseMove(e)}function qE(e){switch(this._removePointer(e),this._pointers.length){case 0:if(this.domElement.releasePointerCapture(e.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Q_),this.state=at.NONE,this._cursorStyle==="grab")this.domElement.style.cursor="grab";break;case 1:let t=this._pointers[0],n=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:n.x,pageY:n.y});break}}function jE(e){let t;switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case St.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(e),this.state=at.DOLLY;break;case St.ROTATE:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=at.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=at.ROTATE}break;case St.PAN:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=at.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=at.PAN}break;default:this.state=at.NONE}if(this.state!==at.NONE)this.dispatchEvent(cf)}function YE(e){switch(this.state){case at.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(e);break;case at.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(e);break;case at.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(e);break}}function $E(e){if(this.enabled===!1||this.enableZoom===!1||this.state!==at.NONE)return;e.preventDefault(),this.dispatchEvent(cf),this._handleMouseWheel(this._customWheelEvent(e)),this.dispatchEvent(Q_)}function ZE(e){if(this.enabled===!1)return;this._handleKeyDown(e)}function JE(e){switch(this._trackPointer(e),this._pointers.length){case 1:switch(this.touches.ONE){case yn.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(e),this.state=at.TOUCH_ROTATE;break;case yn.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(e),this.state=at.TOUCH_PAN;break;default:this.state=at.NONE}break;case 2:switch(this.touches.TWO){case yn.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(e),this.state=at.TOUCH_DOLLY_PAN;break;case yn.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(e),this.state=at.TOUCH_DOLLY_ROTATE;break;default:this.state=at.NONE}break;default:this.state=at.NONE}if(this.state!==at.NONE)this.dispatchEvent(cf)}function KE(e){switch(this._trackPointer(e),this.state){case at.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(e),this.update();break;case at.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(e),this.update();break;case at.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(e),this.update();break;case at.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(e),this.update();break;default:this.state=at.NONE}}function QE(e){if(this.enabled===!1)return;e.preventDefault()}function eT(e){if(e.key==="Control")this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0})}function tT(e){if(e.key==="Control")this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0})}var nT={type:"change"},e0=0.000001,t0=new Ft;class uf extends zn{constructor(e,t=null){super(e,t);if(this.movementSpeed=1,this.rollSpeed=0.005,this.dragToLook=!1,this.autoForward=!1,this._moveState={up:0,down:0,left:0,right:0,forward:0,back:0,pitchUp:0,pitchDown:0,yawLeft:0,yawRight:0,rollLeft:0,rollRight:0},this._moveVector=new L(0,0,0),this._rotationVector=new L(0,0,0),this._lastQuaternion=new Ft,this._lastPosition=new L,this._status=0,this._onKeyDown=iT.bind(this),this._onKeyUp=rT.bind(this),this._onPointerMove=oT.bind(this),this._onPointerDown=sT.bind(this),this._onPointerUp=aT.bind(this),this._onPointerCancel=lT.bind(this),this._onContextMenu=cT.bind(this),t!==null)this.connect(t)}connect(e){super.connect(e),window.addEventListener("keydown",this._onKeyDown),window.addEventListener("keyup",this._onKeyUp),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointerup",this._onPointerUp),this.domElement.addEventListener("pointercancel",this._onPointerCancel),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction="none"}disconnect(){window.removeEventListener("keydown",this._onKeyDown),window.removeEventListener("keyup",this._onKeyUp),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerCancel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.domElement.style.touchAction=""}dispose(){this.disconnect()}update(e){if(this.enabled===!1)return;let t=this.object,n=e*this.movementSpeed,i=e*this.rollSpeed;if(t.translateX(this._moveVector.x*n),t.translateY(this._moveVector.y*n),t.translateZ(this._moveVector.z*n),t0.set(this._rotationVector.x*i,this._rotationVector.y*i,this._rotationVector.z*i,1).normalize(),t.quaternion.multiply(t0),this._lastPosition.distanceToSquared(t.position)>e0||8*(1-this._lastQuaternion.dot(t.quaternion))>e0)this.dispatchEvent(nT),this._lastQuaternion.copy(t.quaternion),this._lastPosition.copy(t.position)}_updateMovementVector(){let e=this._moveState.forward||this.autoForward&&!this._moveState.back?1:0;this._moveVector.x=-this._moveState.left+this._moveState.right,this._moveVector.y=-this._moveState.down+this._moveState.up,this._moveVector.z=-e+this._moveState.back}_updateRotationVector(){this._rotationVector.x=-this._moveState.pitchDown+this._moveState.pitchUp,this._rotationVector.y=-this._moveState.yawRight+this._moveState.yawLeft,this._rotationVector.z=-this._moveState.rollRight+this._moveState.rollLeft}_getContainerDimensions(){if(this.domElement!=document)return{size:[this.domElement.offsetWidth,this.domElement.offsetHeight],offset:[this.domElement.offsetLeft,this.domElement.offsetTop]};else return{size:[window.innerWidth,window.innerHeight],offset:[0,0]}}}function iT(e){if(e.altKey||this.enabled===!1)return;switch(e.code){case"ShiftLeft":case"ShiftRight":this.movementSpeedMultiplier=0.1;break;case"KeyW":this._moveState.forward=1;break;case"KeyS":this._moveState.back=1;break;case"KeyA":this._moveState.left=1;break;case"KeyD":this._moveState.right=1;break;case"KeyR":this._moveState.up=1;break;case"KeyF":this._moveState.down=1;break;case"ArrowUp":this._moveState.pitchUp=1;break;case"ArrowDown":this._moveState.pitchDown=1;break;case"ArrowLeft":this._moveState.yawLeft=1;break;case"ArrowRight":this._moveState.yawRight=1;break;case"KeyQ":this._moveState.rollLeft=1;break;case"KeyE":this._moveState.rollRight=1;break}this._updateMovementVector(),this._updateRotationVector()}function rT(e){if(this.enabled===!1)return;switch(e.code){case"ShiftLeft":case"ShiftRight":this.movementSpeedMultiplier=1;break;case"KeyW":this._moveState.forward=0;break;case"KeyS":this._moveState.back=0;break;case"KeyA":this._moveState.left=0;break;case"KeyD":this._moveState.right=0;break;case"KeyR":this._moveState.up=0;break;case"KeyF":this._moveState.down=0;break;case"ArrowUp":this._moveState.pitchUp=0;break;case"ArrowDown":this._moveState.pitchDown=0;break;case"ArrowLeft":this._moveState.yawLeft=0;break;case"ArrowRight":this._moveState.yawRight=0;break;case"KeyQ":this._moveState.rollLeft=0;break;case"KeyE":this._moveState.rollRight=0;break}this._updateMovementVector(),this._updateRotationVector()}function sT(e){if(this.enabled===!1)return;if(this.dragToLook)this._status++;else{switch(e.button){case 0:this._moveState.forward=1;break;case 2:this._moveState.back=1;break}this._updateMovementVector()}}function oT(e){if(this.enabled===!1)return;if(!this.dragToLook||this._status>0){let t=this._getContainerDimensions(),n=t.size[0]/2,i=t.size[1]/2;this._moveState.yawLeft=-(e.pageX-t.offset[0]-n)/n,this._moveState.pitchDown=(e.pageY-t.offset[1]-i)/i,this._updateRotationVector()}}function aT(e){if(this.enabled===!1)return;if(this.dragToLook)this._status--,this._moveState.yawLeft=this._moveState.pitchDown=0;else{switch(e.button){case 0:this._moveState.forward=0;break;case 2:this._moveState.back=0;break}this._updateMovementVector()}this._updateRotationVector()}function lT(){if(this.enabled===!1)return;if(this.dragToLook)this._status=0,this._moveState.yawLeft=this._moveState.pitchDown=0;else this._moveState.forward=0,this._moveState.back=0,this._updateMovementVector();this._updateRotationVector()}function cT(e){if(this.enabled===!1)return;e.preventDefault()}var n0={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};class wi{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}var hT=new Zi(-1,1,1,-1,0,1);class i0 extends Rt{constructor(){super();this.setAttribute("position",new mt([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new mt([0,2,0,0,2,0],2))}}var uT=new i0;class ff{constructor(e){this._mesh=new Bt(uT,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,hT)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class df extends wi{constructor(e,t="tDiffuse"){super();if(this.textureID=t,this.uniforms=null,this.material=null,e instanceof Jt)this.uniforms=e.uniforms,this.material=e;else if(e)this.uniforms=aa.clone(e.uniforms),this.material=new Jt({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader});this._fsQuad=new ff(this.material)}render(e,t,n){if(this.uniforms[this.textureID])this.uniforms[this.textureID].value=n.texture;if(this._fsQuad.material=this.material,this.renderToScreen)e.setRenderTarget(null),this._fsQuad.render(e);else{if(e.setRenderTarget(t),this.clear)e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil);this._fsQuad.render(e)}}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class $a extends wi{constructor(e,t){super();this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let i=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let s,o;if(this.inverse)s=0,o=1;else s=1,o=0;if(r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(i.REPLACE,i.REPLACE,i.REPLACE),r.buffers.stencil.setFunc(i.ALWAYS,s,4294967295),r.buffers.stencil.setClear(o),r.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear)e.clear();if(e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear)e.clear();e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(i.EQUAL,1,4294967295),r.buffers.stencil.setOp(i.KEEP,i.KEEP,i.KEEP),r.buffers.stencil.setLocked(!0)}}class pf extends wi{constructor(){super();this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class mf{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new se);this._width=n.width,this._height=n.height,t=new Zt(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:bn}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new df(n0),this.copyPass.material.blending=xn,this.timer=new kr}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);if(t!==-1)this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){if(this.timer.update(),e===void 0)e=this.timer.getDelta();let t=this.renderer.getRenderTarget(),n=!1;for(let i=0,r=this.passes.length;i<r;i++){let s=this.passes[i];if(s.enabled===!1)continue;if(s.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i),s.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),s.needsSwap){if(n){let o=this.renderer.getContext(),a=this.renderer.state.buffers.stencil;a.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),a.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}if($a!==void 0){if(s instanceof $a)n=!0;else if(s instanceof pf)n=!1}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new se);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(n,i),this.renderTarget2.setSize(n,i);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(n,i)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class gf extends wi{constructor(e,t,n=null,i=null,r=null){super();this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=i,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new ke}render(e,t,n){let i=e.autoClear;e.autoClear=!1;let r,s;if(this.overrideMaterial!==null)s=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial;if(this.clearColor!==null)e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha());if(this.clearAlpha!==null)r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha);if(this.clearDepth==!0)e.clearDepth();if(e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0)e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil);if(e.render(this.scene,this.camera),this.clearColor!==null)e.setClearColor(this._oldClearColor);if(this.clearAlpha!==null)e.setClearAlpha(r);if(this.overrideMaterial!==null)this.scene.overrideMaterial=s;e.autoClear=i}}function Qt(){return Qt=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var i in n)({}).hasOwnProperty.call(n,i)&&(e[i]=n[i])}return e},Qt.apply(null,arguments)}function r0(e){if(e===void 0)throw ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function Ei(e,t){return Ei=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(n,i){return n.__proto__=i,n},Ei(e,t)}function s0(e,t){e.prototype=Object.create(t.prototype),e.prototype.constructor=e,Ei(e,t)}function Za(e){return Za=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(t){return t.__proto__||Object.getPrototypeOf(t)},Za(e)}function o0(e){try{return Function.toString.call(e).indexOf("[native code]")!==-1}catch(t){return typeof e=="function"}}function _f(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],function(){}))}catch(t){}return(_f=function(){return!!e})()}function a0(e,t,n){if(_f())return Reflect.construct.apply(null,arguments);var i=[null];i.push.apply(i,t);var r=new(e.bind.apply(e,i));return n&&Ei(r,n.prototype),r}function Ja(e){var t=typeof Map=="function"?new Map:void 0;return Ja=function(i){if(i===null||!o0(i))return i;if(typeof i!="function")throw TypeError("Super expression must either be null or a function");if(t!==void 0){if(t.has(i))return t.get(i);t.set(i,r)}function r(){return a0(i,arguments,Za(this).constructor)}return r.prototype=Object.create(i.prototype,{constructor:{value:r,enumerable:!1,writable:!0,configurable:!0}}),Ei(r,i)},Ja(e)}var fT={"1":`Passed invalid arguments to hsl, please pass multiple numbers e.g. hsl(360, 0.75, 0.4) or an object e.g. rgb({ hue: 255, saturation: 0.4, lightness: 0.75 }).

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
`};function dT(){for(var e=arguments.length,t=Array(e),n=0;n<e;n++)t[n]=arguments[n];var i=t[0],r=[],s;for(s=1;s<t.length;s+=1)r.push(t[s]);return r.forEach(function(o){i=i.replace(/%[a-z]/,o)}),i}var cn=function(e){s0(t,e);function t(n){var i;for(var r=arguments.length,s=Array(r>1?r-1:0),o=1;o<r;o++)s[o-1]=arguments[o];return i=e.call(this,dT.apply(void 0,[fT[n]].concat(s)))||this,r0(i)}return t}(Ja(Error));function l0(e,t){return e.substr(-t.length)===t}var pT=/^([+-]?(?:\d+|\d*\.\d+))([a-z]*|%)$/;function c0(e){if(typeof e!=="string")return e;var t=e.match(pT);return t?parseFloat(e):e}var mT=function(t){return function(n,i){if(i===void 0)i="16px";var r=n,s=i;if(typeof n==="string"){if(!l0(n,"px"))throw new cn(69,t,n);r=c0(n)}if(typeof i==="string"){if(!l0(i,"px"))throw new cn(70,t,i);s=c0(i)}if(typeof r==="string")throw new cn(71,n,t);if(typeof s==="string")throw new cn(72,i,t);return""+r/s+t}},u0=mT,Mz=u0("em");var wz=u0("rem");function vf(e){return Math.round(e*255)}function gT(e,t,n){return vf(e)+","+vf(t)+","+vf(n)}function $s(e,t,n,i){if(i===void 0)i=gT;if(t===0)return i(n,n,n);var r=(e%360+360)%360/60,s=(1-Math.abs(2*n-1))*t,o=s*(1-Math.abs(r%2-1)),a=0,l=0,c=0;if(r>=0&&r<1)a=s,l=o;else if(r>=1&&r<2)a=o,l=s;else if(r>=2&&r<3)l=s,c=o;else if(r>=3&&r<4)l=o,c=s;else if(r>=4&&r<5)a=o,c=s;else if(r>=5&&r<6)a=s,c=o;var h=n-s/2,f=a+h,u=l+h,p=c+h;return i(f,u,p)}var h0={aliceblue:"f0f8ff",antiquewhite:"faebd7",aqua:"00ffff",aquamarine:"7fffd4",azure:"f0ffff",beige:"f5f5dc",bisque:"ffe4c4",black:"000",blanchedalmond:"ffebcd",blue:"0000ff",blueviolet:"8a2be2",brown:"a52a2a",burlywood:"deb887",cadetblue:"5f9ea0",chartreuse:"7fff00",chocolate:"d2691e",coral:"ff7f50",cornflowerblue:"6495ed",cornsilk:"fff8dc",crimson:"dc143c",cyan:"00ffff",darkblue:"00008b",darkcyan:"008b8b",darkgoldenrod:"b8860b",darkgray:"a9a9a9",darkgreen:"006400",darkgrey:"a9a9a9",darkkhaki:"bdb76b",darkmagenta:"8b008b",darkolivegreen:"556b2f",darkorange:"ff8c00",darkorchid:"9932cc",darkred:"8b0000",darksalmon:"e9967a",darkseagreen:"8fbc8f",darkslateblue:"483d8b",darkslategray:"2f4f4f",darkslategrey:"2f4f4f",darkturquoise:"00ced1",darkviolet:"9400d3",deeppink:"ff1493",deepskyblue:"00bfff",dimgray:"696969",dimgrey:"696969",dodgerblue:"1e90ff",firebrick:"b22222",floralwhite:"fffaf0",forestgreen:"228b22",fuchsia:"ff00ff",gainsboro:"dcdcdc",ghostwhite:"f8f8ff",gold:"ffd700",goldenrod:"daa520",gray:"808080",green:"008000",greenyellow:"adff2f",grey:"808080",honeydew:"f0fff0",hotpink:"ff69b4",indianred:"cd5c5c",indigo:"4b0082",ivory:"fffff0",khaki:"f0e68c",lavender:"e6e6fa",lavenderblush:"fff0f5",lawngreen:"7cfc00",lemonchiffon:"fffacd",lightblue:"add8e6",lightcoral:"f08080",lightcyan:"e0ffff",lightgoldenrodyellow:"fafad2",lightgray:"d3d3d3",lightgreen:"90ee90",lightgrey:"d3d3d3",lightpink:"ffb6c1",lightsalmon:"ffa07a",lightseagreen:"20b2aa",lightskyblue:"87cefa",lightslategray:"789",lightslategrey:"789",lightsteelblue:"b0c4de",lightyellow:"ffffe0",lime:"0f0",limegreen:"32cd32",linen:"faf0e6",magenta:"f0f",maroon:"800000",mediumaquamarine:"66cdaa",mediumblue:"0000cd",mediumorchid:"ba55d3",mediumpurple:"9370db",mediumseagreen:"3cb371",mediumslateblue:"7b68ee",mediumspringgreen:"00fa9a",mediumturquoise:"48d1cc",mediumvioletred:"c71585",midnightblue:"191970",mintcream:"f5fffa",mistyrose:"ffe4e1",moccasin:"ffe4b5",navajowhite:"ffdead",navy:"000080",oldlace:"fdf5e6",olive:"808000",olivedrab:"6b8e23",orange:"ffa500",orangered:"ff4500",orchid:"da70d6",palegoldenrod:"eee8aa",palegreen:"98fb98",paleturquoise:"afeeee",palevioletred:"db7093",papayawhip:"ffefd5",peachpuff:"ffdab9",peru:"cd853f",pink:"ffc0cb",plum:"dda0dd",powderblue:"b0e0e6",purple:"800080",rebeccapurple:"639",red:"f00",rosybrown:"bc8f8f",royalblue:"4169e1",saddlebrown:"8b4513",salmon:"fa8072",sandybrown:"f4a460",seagreen:"2e8b57",seashell:"fff5ee",sienna:"a0522d",silver:"c0c0c0",skyblue:"87ceeb",slateblue:"6a5acd",slategray:"708090",slategrey:"708090",snow:"fffafa",springgreen:"00ff7f",steelblue:"4682b4",tan:"d2b48c",teal:"008080",thistle:"d8bfd8",tomato:"ff6347",turquoise:"40e0d0",violet:"ee82ee",wheat:"f5deb3",white:"fff",whitesmoke:"f5f5f5",yellow:"ff0",yellowgreen:"9acd32"};function _T(e){if(typeof e!=="string")return e;var t=e.toLowerCase();return h0[t]?"#"+h0[t]:e}var vT=/^#[a-fA-F0-9]{6}$/,yT=/^#[a-fA-F0-9]{8}$/,xT=/^#[a-fA-F0-9]{3}$/,bT=/^#[a-fA-F0-9]{4}$/,yf=/^rgb\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*\)$/i,ST=/^rgb(?:a)?\(\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,)?\s*(\d{1,3})\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i,MT=/^hsl\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*\)$/i,wT=/^hsl(?:a)?\(\s*(\d{0,3}[.]?[0-9]+(?:deg)?)\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,)?\s*(\d{1,3}[.]?[0-9]?)%\s*(?:,|\/)\s*([-+]?\d*[.]?\d+[%]?)\s*\)$/i;function Ti(e){if(typeof e!=="string")throw new cn(3);var t=_T(e);if(t.match(vT))return{red:parseInt(""+t[1]+t[2],16),green:parseInt(""+t[3]+t[4],16),blue:parseInt(""+t[5]+t[6],16)};if(t.match(yT)){var n=parseFloat((parseInt(""+t[7]+t[8],16)/255).toFixed(2));return{red:parseInt(""+t[1]+t[2],16),green:parseInt(""+t[3]+t[4],16),blue:parseInt(""+t[5]+t[6],16),alpha:n}}if(t.match(xT))return{red:parseInt(""+t[1]+t[1],16),green:parseInt(""+t[2]+t[2],16),blue:parseInt(""+t[3]+t[3],16)};if(t.match(bT)){var i=parseFloat((parseInt(""+t[4]+t[4],16)/255).toFixed(2));return{red:parseInt(""+t[1]+t[1],16),green:parseInt(""+t[2]+t[2],16),blue:parseInt(""+t[3]+t[3],16),alpha:i}}var r=yf.exec(t);if(r)return{red:parseInt(""+r[1],10),green:parseInt(""+r[2],10),blue:parseInt(""+r[3],10)};var s=ST.exec(t.substring(0,50));if(s)return{red:parseInt(""+s[1],10),green:parseInt(""+s[2],10),blue:parseInt(""+s[3],10),alpha:parseFloat(""+s[4])>1?parseFloat(""+s[4])/100:parseFloat(""+s[4])};var o=MT.exec(t);if(o){var a=parseInt(""+o[1],10),l=parseInt(""+o[2],10)/100,c=parseInt(""+o[3],10)/100,h="rgb("+$s(a,l,c)+")",f=yf.exec(h);if(!f)throw new cn(4,t,h);return{red:parseInt(""+f[1],10),green:parseInt(""+f[2],10),blue:parseInt(""+f[3],10)}}var u=wT.exec(t.substring(0,50));if(u){var p=parseInt(""+u[1],10),g=parseInt(""+u[2],10)/100,y=parseInt(""+u[3],10)/100,m="rgb("+$s(p,g,y)+")",d=yf.exec(m);if(!d)throw new cn(4,t,m);return{red:parseInt(""+d[1],10),green:parseInt(""+d[2],10),blue:parseInt(""+d[3],10),alpha:parseFloat(""+u[4])>1?parseFloat(""+u[4])/100:parseFloat(""+u[4])}}throw new cn(5)}function ET(e){var t=e.red/255,n=e.green/255,i=e.blue/255,r=Math.max(t,n,i),s=Math.min(t,n,i),o=(r+s)/2;if(r===s)if(e.alpha!==void 0)return{hue:0,saturation:0,lightness:o,alpha:e.alpha};else return{hue:0,saturation:0,lightness:o};var a,l=r-s,c=o>0.5?l/(2-r-s):l/(r+s);switch(r){case t:a=(n-i)/l+(n<i?6:0);break;case n:a=(i-t)/l+2;break;default:a=(t-n)/l+4;break}if(a*=60,e.alpha!==void 0)return{hue:a,saturation:c,lightness:o,alpha:e.alpha};return{hue:a,saturation:c,lightness:o}}function Ai(e){return ET(Ti(e))}var TT=function(t){if(t.length===7&&t[1]===t[2]&&t[3]===t[4]&&t[5]===t[6])return"#"+t[1]+t[3]+t[5];return t},bf=TT;function tr(e){var t=e.toString(16);return t.length===1?"0"+t:t}function xf(e){return tr(Math.round(e*255))}function AT(e,t,n){return bf("#"+xf(e)+xf(t)+xf(n))}function Ka(e,t,n){return $s(e,t,n,AT)}function CT(e,t,n){if(typeof e==="number"&&typeof t==="number"&&typeof n==="number")return Ka(e,t,n);else if(typeof e==="object"&&t===void 0&&n===void 0)return Ka(e.hue,e.saturation,e.lightness);throw new cn(1)}function RT(e,t,n,i){if(typeof e==="number"&&typeof t==="number"&&typeof n==="number"&&typeof i==="number")return i>=1?Ka(e,t,n):"rgba("+$s(e,t,n)+","+i+")";else if(typeof e==="object"&&t===void 0&&n===void 0&&i===void 0)return e.alpha>=1?Ka(e.hue,e.saturation,e.lightness):"rgba("+$s(e.hue,e.saturation,e.lightness)+","+e.alpha+")";throw new cn(2)}function Sf(e,t,n){if(typeof e==="number"&&typeof t==="number"&&typeof n==="number")return bf("#"+tr(e)+tr(t)+tr(n));else if(typeof e==="object"&&t===void 0&&n===void 0)return bf("#"+tr(e.red)+tr(e.green)+tr(e.blue));throw new cn(6)}function Qa(e,t,n,i){if(typeof e==="string"&&typeof t==="number"){var r=Ti(e);return"rgba("+r.red+","+r.green+","+r.blue+","+t+")"}else if(typeof e==="number"&&typeof t==="number"&&typeof n==="number"&&typeof i==="number")return i>=1?Sf(e,t,n):"rgba("+e+","+t+","+n+","+i+")";else if(typeof e==="object"&&t===void 0&&n===void 0&&i===void 0)return e.alpha>=1?Sf(e.red,e.green,e.blue):"rgba("+e.red+","+e.green+","+e.blue+","+e.alpha+")";throw new cn(7)}var PT=function(t){return typeof t.red==="number"&&typeof t.green==="number"&&typeof t.blue==="number"&&(typeof t.alpha!=="number"||typeof t.alpha>"u")},IT=function(t){return typeof t.red==="number"&&typeof t.green==="number"&&typeof t.blue==="number"&&typeof t.alpha==="number"},LT=function(t){return typeof t.hue==="number"&&typeof t.saturation==="number"&&typeof t.lightness==="number"&&(typeof t.alpha!=="number"||typeof t.alpha>"u")},DT=function(t){return typeof t.hue==="number"&&typeof t.saturation==="number"&&typeof t.lightness==="number"&&typeof t.alpha==="number"};function Ci(e){if(typeof e!=="object")throw new cn(8);if(IT(e))return Qa(e);if(PT(e))return Sf(e);if(DT(e))return RT(e);if(LT(e))return CT(e);throw new cn(8)}function f0(e,t,n){return function(){var r=n.concat(Array.prototype.slice.call(arguments));return r.length>=t?e.apply(this,r):f0(e,t,r)}}function gn(e){return f0(e,e.length,[])}function NT(e,t){if(t==="transparent")return t;var n=Ai(t);return Ci(Qt({},n,{hue:n.hue+parseFloat(e)}))}var Ez=gn(NT);function Jr(e,t,n){return Math.max(e,Math.min(t,n))}function OT(e,t){if(t==="transparent")return t;var n=Ai(t);return Ci(Qt({},n,{lightness:Jr(0,1,n.lightness-parseFloat(e))}))}var Tz=gn(OT);function UT(e,t){if(t==="transparent")return t;var n=Ai(t);return Ci(Qt({},n,{saturation:Jr(0,1,n.saturation-parseFloat(e))}))}var Az=gn(UT);function FT(e,t){if(t==="transparent")return t;var n=Ai(t);return Ci(Qt({},n,{lightness:Jr(0,1,n.lightness+parseFloat(e))}))}var Cz=gn(FT);function BT(e,t,n){if(t==="transparent")return n;if(n==="transparent")return t;if(e===0)return n;var i=Ti(t),r=Qt({},i,{alpha:typeof i.alpha==="number"?i.alpha:1}),s=Ti(n),o=Qt({},s,{alpha:typeof s.alpha==="number"?s.alpha:1}),a=r.alpha-o.alpha,l=parseFloat(e)*2-1,c=l*a===-1?l:l+a,h=1+l*a,f=(c/h+1)/2,u=1-f,p={red:Math.floor(r.red*f+o.red*u),green:Math.floor(r.green*f+o.green*u),blue:Math.floor(r.blue*f+o.blue*u),alpha:r.alpha*parseFloat(e)+o.alpha*(1-parseFloat(e))};return Qa(p)}var kT=gn(BT),d0=kT;function zT(e,t){if(t==="transparent")return t;var n=Ti(t),i=typeof n.alpha==="number"?n.alpha:1,r=Qt({},n,{alpha:Jr(0,1,(i*100+parseFloat(e)*100)/100)});return Qa(r)}var GT=gn(zT),p0=GT;function HT(e,t){if(t==="transparent")return t;var n=Ai(t);return Ci(Qt({},n,{saturation:Jr(0,1,n.saturation+parseFloat(e))}))}var Rz=gn(HT);function VT(e,t){if(t==="transparent")return t;return Ci(Qt({},Ai(t),{hue:parseFloat(e)}))}var Pz=gn(VT);function WT(e,t){if(t==="transparent")return t;return Ci(Qt({},Ai(t),{lightness:parseFloat(e)}))}var Iz=gn(WT);function XT(e,t){if(t==="transparent")return t;return Ci(Qt({},Ai(t),{saturation:parseFloat(e)}))}var Lz=gn(XT);function qT(e,t){if(t==="transparent")return t;return d0(parseFloat(e),"rgb(0, 0, 0)",t)}var Dz=gn(qT);function jT(e,t){if(t==="transparent")return t;return d0(parseFloat(e),"rgb(255, 255, 255)",t)}var Nz=gn(jT);function YT(e,t){if(t==="transparent")return t;var n=Ti(t),i=typeof n.alpha==="number"?n.alpha:1,r=Qt({},n,{alpha:Jr(0,1,+(i*100-parseFloat(e)*100).toFixed(2)/100)});return Qa(r)}var Oz=gn(YT);var Ri=Object.freeze({Linear:Object.freeze({None:function(e){return e},In:function(e){return e},Out:function(e){return e},InOut:function(e){return e}}),Quadratic:Object.freeze({In:function(e){return e*e},Out:function(e){return e*(2-e)},InOut:function(e){if((e*=2)<1)return 0.5*e*e;return-0.5*(--e*(e-2)-1)}}),Cubic:Object.freeze({In:function(e){return e*e*e},Out:function(e){return--e*e*e+1},InOut:function(e){if((e*=2)<1)return 0.5*e*e*e;return 0.5*((e-=2)*e*e+2)}}),Quartic:Object.freeze({In:function(e){return e*e*e*e},Out:function(e){return 1- --e*e*e*e},InOut:function(e){if((e*=2)<1)return 0.5*e*e*e*e;return-0.5*((e-=2)*e*e*e-2)}}),Quintic:Object.freeze({In:function(e){return e*e*e*e*e},Out:function(e){return--e*e*e*e*e+1},InOut:function(e){if((e*=2)<1)return 0.5*e*e*e*e*e;return 0.5*((e-=2)*e*e*e*e+2)}}),Sinusoidal:Object.freeze({In:function(e){return 1-Math.sin((1-e)*Math.PI/2)},Out:function(e){return Math.sin(e*Math.PI/2)},InOut:function(e){return 0.5*(1-Math.sin(Math.PI*(0.5-e)))}}),Exponential:Object.freeze({In:function(e){return e===0?0:Math.pow(1024,e-1)},Out:function(e){return e===1?1:1-Math.pow(2,-10*e)},InOut:function(e){if(e===0)return 0;if(e===1)return 1;if((e*=2)<1)return 0.5*Math.pow(1024,e-1);return 0.5*(-Math.pow(2,-10*(e-1))+2)}}),Circular:Object.freeze({In:function(e){return 1-Math.sqrt(1-e*e)},Out:function(e){return Math.sqrt(1- --e*e)},InOut:function(e){if((e*=2)<1)return-0.5*(Math.sqrt(1-e*e)-1);return 0.5*(Math.sqrt(1-(e-=2)*e)+1)}}),Elastic:Object.freeze({In:function(e){if(e===0)return 0;if(e===1)return 1;return-Math.pow(2,10*(e-1))*Math.sin((e-1.1)*5*Math.PI)},Out:function(e){if(e===0)return 0;if(e===1)return 1;return Math.pow(2,-10*e)*Math.sin((e-0.1)*5*Math.PI)+1},InOut:function(e){if(e===0)return 0;if(e===1)return 1;if(e*=2,e<1)return-0.5*Math.pow(2,10*(e-1))*Math.sin((e-1.1)*5*Math.PI);return 0.5*Math.pow(2,-10*(e-1))*Math.sin((e-1.1)*5*Math.PI)+1}}),Back:Object.freeze({In:function(e){var t=1.70158;return e===1?1:e*e*((t+1)*e-t)},Out:function(e){var t=1.70158;return e===0?0:--e*e*((t+1)*e+t)+1},InOut:function(e){var t=2.5949095;if((e*=2)<1)return 0.5*(e*e*((t+1)*e-t));return 0.5*((e-=2)*e*((t+1)*e+t)+2)}}),Bounce:Object.freeze({In:function(e){return 1-Ri.Bounce.Out(1-e)},Out:function(e){if(e<0.36363636363636365)return 7.5625*e*e;else if(e<0.7272727272727273)return 7.5625*(e-=0.5454545454545454)*e+0.75;else if(e<0.9090909090909091)return 7.5625*(e-=0.8181818181818182)*e+0.9375;else return 7.5625*(e-=0.9545454545454546)*e+0.984375},InOut:function(e){if(e<0.5)return Ri.Bounce.In(e*2)*0.5;return Ri.Bounce.Out(e*2-1)*0.5+0.5}}),generatePow:function(e){if(e===void 0)e=4;return e=e<Number.EPSILON?Number.EPSILON:e,e=e>1e4?1e4:e,{In:function(t){return Math.pow(t,e)},Out:function(t){return 1-Math.pow(1-t,e)},InOut:function(t){if(t<0.5)return Math.pow(t*2,e)/2;return(1-Math.pow(2-t*2,e))/2+0.5}}}}),Zs=function(){return performance.now()},wf=function(){function e(){var t=[];for(var n=0;n<arguments.length;n++)t[n]=arguments[n];this._tweens={},this._tweensAddedDuringUpdate={},this.add.apply(this,t)}return e.prototype.getAll=function(){var t=this;return Object.keys(this._tweens).map(function(n){return t._tweens[n]})},e.prototype.removeAll=function(){this._tweens={}},e.prototype.add=function(){var t,n=[];for(var i=0;i<arguments.length;i++)n[i]=arguments[i];for(var r=0,s=n;r<s.length;r++){var o=s[r];(t=o._group)===null||t===void 0||t.remove(o),o._group=this,this._tweens[o.getId()]=o,this._tweensAddedDuringUpdate[o.getId()]=o}},e.prototype.remove=function(){var t=[];for(var n=0;n<arguments.length;n++)t[n]=arguments[n];for(var i=0,r=t;i<r.length;i++){var s=r[i];s._group=void 0,delete this._tweens[s.getId()],delete this._tweensAddedDuringUpdate[s.getId()]}},e.prototype.allStopped=function(){return this.getAll().every(function(t){return!t.isPlaying()})},e.prototype.update=function(t,n){if(t===void 0)t=Zs();if(n===void 0)n=!0;var i=Object.keys(this._tweens);if(i.length===0)return;while(i.length>0){this._tweensAddedDuringUpdate={};for(var r=0;r<i.length;r++){var s=this._tweens[i[r]],o=!n;if(s&&s.update(t,o)===!1&&!n)this.remove(s)}i=Object.keys(this._tweensAddedDuringUpdate)}},e}(),Kr={Linear:function(e,t){var n=e.length-1,i=n*t,r=Math.floor(i),s=Kr.Utils.Linear;if(t<0)return s(e[0],e[1],i);if(t>1)return s(e[n],e[n-1],n-i);return s(e[r],e[r+1>n?n:r+1],i-r)},Bezier:function(e,t){var n=0,i=e.length-1,r=Math.pow,s=Kr.Utils.Bernstein;for(var o=0;o<=i;o++)n+=r(1-t,i-o)*r(t,o)*e[o]*s(i,o);return n},CatmullRom:function(e,t){var n=e.length-1,i=n*t,r=Math.floor(i),s=Kr.Utils.CatmullRom;if(e[0]===e[n]){if(t<0)r=Math.floor(i=n*(1+t));return s(e[(r-1+n)%n],e[r],e[(r+1)%n],e[(r+2)%n],i-r)}else{if(t<0)return e[0]-(s(e[0],e[0],e[1],e[1],-i)-e[0]);if(t>1)return e[n]-(s(e[n],e[n],e[n-1],e[n-1],i-n)-e[n]);return s(e[r?r-1:0],e[r],e[n<r+1?n:r+1],e[n<r+2?n:r+2],i-r)}},Utils:{Linear:function(e,t,n){return(t-e)*n+e},Bernstein:function(e,t){var n=Kr.Utils.Factorial;return n(e)/n(t)/n(e-t)},Factorial:function(){var e=[1];return function(t){var n=1;if(e[t])return e[t];for(var i=t;i>1;i--)n*=i;return e[t]=n,n}}(),CatmullRom:function(e,t,n,i,r){var s=(n-e)*0.5,o=(i-t)*0.5,a=r*r,l=r*a;return(2*t-2*n+s+o)*l+(-3*t+3*n-2*s-o)*a+s*r+t}}},m0=function(){function e(){}return e.nextId=function(){return e._nextId++},e._nextId=0,e}(),Mf=new wf,Ef=function(){function e(t,n){if(this._isPaused=!1,this._pauseStart=0,this._valuesStart={},this._valuesEnd={},this._valuesStartRepeat={},this._duration=1000,this._isDynamic=!1,this._initialRepeat=0,this._repeat=0,this._yoyo=!1,this._isPlaying=!1,this._reversed=!1,this._delayTime=0,this._startTime=0,this._easingFunction=Ri.Linear.None,this._interpolationFunction=Kr.Linear,this._chainedTweens=[],this._onStartCallbackFired=!1,this._onEveryStartCallbackFired=!1,this._id=m0.nextId(),this._isChainStopped=!1,this._propertiesAreSetUp=!1,this._goToEnd=!1,this._object=t,typeof n==="object")this._group=n,n.add(this);else if(n===!0)this._group=Mf,Mf.add(this)}return e.prototype.getId=function(){return this._id},e.prototype.isPlaying=function(){return this._isPlaying},e.prototype.isPaused=function(){return this._isPaused},e.prototype.getDuration=function(){return this._duration},e.prototype.to=function(t,n){if(n===void 0)n=1000;if(this._isPlaying)throw Error("Can not call Tween.to() while Tween is already started or paused. Stop the Tween first.");return this._valuesEnd=t,this._propertiesAreSetUp=!1,this._duration=n<0?0:n,this},e.prototype.duration=function(t){if(t===void 0)t=1000;return this._duration=t<0?0:t,this},e.prototype.dynamic=function(t){if(t===void 0)t=!1;return this._isDynamic=t,this},e.prototype.start=function(t,n){if(t===void 0)t=Zs();if(n===void 0)n=!1;if(this._isPlaying)return this;if(this._repeat=this._initialRepeat,this._reversed){this._reversed=!1;for(var i in this._valuesStartRepeat)this._swapEndStartRepeatValues(i),this._valuesStart[i]=this._valuesStartRepeat[i]}if(this._isPlaying=!0,this._isPaused=!1,this._onStartCallbackFired=!1,this._onEveryStartCallbackFired=!1,this._isChainStopped=!1,this._startTime=t,this._startTime+=this._delayTime,!this._propertiesAreSetUp||n){if(this._propertiesAreSetUp=!0,!this._isDynamic){var r={};for(var s in this._valuesEnd)r[s]=this._valuesEnd[s];this._valuesEnd=r}this._setupProperties(this._object,this._valuesStart,this._valuesEnd,this._valuesStartRepeat,n)}return this},e.prototype.startFromCurrentValues=function(t){return this.start(t,!0)},e.prototype._setupProperties=function(t,n,i,r,s){for(var o in i){var a=t[o],l=Array.isArray(a),c=l?"array":typeof a,h=!l&&Array.isArray(i[o]);if(c==="undefined"||c==="function")continue;if(h){var f=i[o];if(f.length===0)continue;var u=[a];for(var p=0,g=f.length;p<g;p+=1){var y=this._handleRelativeValue(a,f[p]);if(isNaN(y)){h=!1,console.warn("Found invalid interpolation list. Skipping.");break}u.push(y)}if(h)i[o]=u}if((c==="object"||l)&&a&&!h){n[o]=l?[]:{};var m=a;for(var d in m)n[o][d]=m[d];r[o]=l?[]:{};var f=i[o];if(!this._isDynamic){var b={};for(var d in f)b[d]=f[d];i[o]=f=b}this._setupProperties(m,n[o],f,r[o],s)}else{if(typeof n[o]>"u"||s)n[o]=a;if(!l)n[o]*=1;if(h)r[o]=i[o].slice().reverse();else r[o]=n[o]||0}}},e.prototype.stop=function(){if(!this._isChainStopped)this._isChainStopped=!0,this.stopChainedTweens();if(!this._isPlaying)return this;if(this._isPlaying=!1,this._isPaused=!1,this._onStopCallback)this._onStopCallback(this._object);return this},e.prototype.end=function(){return this._goToEnd=!0,this.update(this._startTime+this._duration),this},e.prototype.pause=function(t){if(t===void 0)t=Zs();if(this._isPaused||!this._isPlaying)return this;return this._isPaused=!0,this._pauseStart=t,this},e.prototype.resume=function(t){if(t===void 0)t=Zs();if(!this._isPaused||!this._isPlaying)return this;return this._isPaused=!1,this._startTime+=t-this._pauseStart,this._pauseStart=0,this},e.prototype.stopChainedTweens=function(){for(var t=0,n=this._chainedTweens.length;t<n;t++)this._chainedTweens[t].stop();return this},e.prototype.group=function(t){if(!t)return console.warn("tween.group() without args has been removed, use group.add(tween) instead."),this;return t.add(this),this},e.prototype.remove=function(){var t;return(t=this._group)===null||t===void 0||t.remove(this),this},e.prototype.delay=function(t){if(t===void 0)t=0;return this._delayTime=t,this},e.prototype.repeat=function(t){if(t===void 0)t=0;return this._initialRepeat=t,this._repeat=t,this},e.prototype.repeatDelay=function(t){return this._repeatDelayTime=t,this},e.prototype.yoyo=function(t){if(t===void 0)t=!1;return this._yoyo=t,this},e.prototype.easing=function(t){if(t===void 0)t=Ri.Linear.None;return this._easingFunction=t,this},e.prototype.interpolation=function(t){if(t===void 0)t=Kr.Linear;return this._interpolationFunction=t,this},e.prototype.chain=function(){var t=[];for(var n=0;n<arguments.length;n++)t[n]=arguments[n];return this._chainedTweens=t,this},e.prototype.onStart=function(t){return this._onStartCallback=t,this},e.prototype.onEveryStart=function(t){return this._onEveryStartCallback=t,this},e.prototype.onUpdate=function(t){return this._onUpdateCallback=t,this},e.prototype.onRepeat=function(t){return this._onRepeatCallback=t,this},e.prototype.onComplete=function(t){return this._onCompleteCallback=t,this},e.prototype.onStop=function(t){return this._onStopCallback=t,this},e.prototype.update=function(t,n){var i=this,r;if(t===void 0)t=Zs();if(n===void 0)n=e.autoStartOnUpdate;if(this._isPaused)return!0;var s;if(!this._goToEnd&&!this._isPlaying)if(n)this.start(t,!0);else return!1;if(this._goToEnd=!1,t<this._startTime)return!0;if(this._onStartCallbackFired===!1){if(this._onStartCallback)this._onStartCallback(this._object);this._onStartCallbackFired=!0}if(this._onEveryStartCallbackFired===!1){if(this._onEveryStartCallback)this._onEveryStartCallback(this._object);this._onEveryStartCallbackFired=!0}var o=t-this._startTime,a=this._duration+((r=this._repeatDelayTime)!==null&&r!==void 0?r:this._delayTime),l=this._duration+this._repeat*a,c=function(){if(i._duration===0)return 1;if(o>l)return 1;var y=Math.trunc(o/a),m=o-y*a,d=Math.min(m/i._duration,1);if(d===0&&o===i._duration)return 1;return d},h=c(),f=this._easingFunction(h);if(this._updateProperties(this._object,this._valuesStart,this._valuesEnd,f),this._onUpdateCallback)this._onUpdateCallback(this._object,h);if(this._duration===0||o>=this._duration)if(this._repeat>0){var u=Math.min(Math.trunc((o-this._duration)/a)+1,this._repeat);if(isFinite(this._repeat))this._repeat-=u;for(s in this._valuesStartRepeat){if(!this._yoyo&&typeof this._valuesEnd[s]==="string")this._valuesStartRepeat[s]=this._valuesStartRepeat[s]+parseFloat(this._valuesEnd[s]);if(this._yoyo)this._swapEndStartRepeatValues(s);this._valuesStart[s]=this._valuesStartRepeat[s]}if(this._yoyo)this._reversed=!this._reversed;if(this._startTime+=a*u,this._onRepeatCallback)this._onRepeatCallback(this._object);return this._onEveryStartCallbackFired=!1,!0}else{if(this._onCompleteCallback)this._onCompleteCallback(this._object);for(var p=0,g=this._chainedTweens.length;p<g;p++)this._chainedTweens[p].start(this._startTime+this._duration,!1);return this._isPlaying=!1,!1}return!0},e.prototype._updateProperties=function(t,n,i,r){for(var s in i){if(n[s]===void 0)continue;var o=n[s]||0,a=i[s],l=Array.isArray(t[s]),c=Array.isArray(a),h=!l&&c;if(h)t[s]=this._interpolationFunction(a,r);else if(typeof a==="object"&&a)this._updateProperties(t[s],o,a,r);else if(a=this._handleRelativeValue(o,a),typeof a==="number")t[s]=o+(a-o)*r}},e.prototype._handleRelativeValue=function(t,n){if(typeof n!=="string")return n;if(n.charAt(0)==="+"||n.charAt(0)==="-")return t+parseFloat(n);return parseFloat(n)},e.prototype._swapEndStartRepeatValues=function(t){var n=this._valuesStartRepeat[t],i=this._valuesEnd[t];if(typeof i==="string")this._valuesStartRepeat[t]=this._valuesStartRepeat[t]+parseFloat(i);else this._valuesStartRepeat[t]=this._valuesEnd[t];this._valuesEnd[t]=n},e.autoStartOnUpdate=!1,e}();var Fz=m0.nextId,Wn=Mf,Bz=Wn.getAll.bind(Wn),kz=Wn.removeAll.bind(Wn),zz=Wn.add.bind(Wn),Gz=Wn.remove.bind(Wn),Hz=Wn.update.bind(Wn);function Tf(e){let t;while(t=e.sourceEvent)e=t;return e}function el(e,t){if(e=Tf(e),t===void 0)t=e.currentTarget;if(t){var n=t.ownerSVGElement||t;if(n.createSVGPoint){var i=n.createSVGPoint();return i.x=e.clientX,i.y=e.clientY,i=i.matrixTransform(t.getScreenCTM().inverse()),[i.x,i.y]}if(t.getBoundingClientRect){var r=t.getBoundingClientRect();return[e.clientX-r.left-t.clientLeft,e.clientY-r.top-t.clientTop]}}return[e.pageX,e.pageY]}function $T(){}function Js(e){return e==null?$T:function(){return this.querySelector(e)}}function Af(e){if(typeof e!=="function")e=Js(e);for(var t=this._groups,n=t.length,i=Array(n),r=0;r<n;++r)for(var s=t[r],o=s.length,a=i[r]=Array(o),l,c,h=0;h<o;++h)if((l=s[h])&&(c=e.call(l,l.__data__,h,s))){if("__data__"in l)c.__data__=l.__data__;a[h]=c}return new xt(i,this._parents)}function Cf(e){return e==null?[]:Array.isArray(e)?e:Array.from(e)}function ZT(){return[]}function Rf(e){return e==null?ZT:function(){return this.querySelectorAll(e)}}function JT(e){return function(){return Cf(e.apply(this,arguments))}}function Pf(e){if(typeof e==="function")e=JT(e);else e=Rf(e);for(var t=this._groups,n=t.length,i=[],r=[],s=0;s<n;++s)for(var o=t[s],a=o.length,l,c=0;c<a;++c)if(l=o[c])i.push(e.call(l,l.__data__,c,o)),r.push(l);return new xt(i,r)}function If(e){return function(){return this.matches(e)}}function tl(e){return function(t){return t.matches(e)}}var KT=Array.prototype.find;function QT(e){return function(){return KT.call(this.children,e)}}function eA(){return this.firstElementChild}function Lf(e){return this.select(e==null?eA:QT(typeof e==="function"?e:tl(e)))}var tA=Array.prototype.filter;function nA(){return Array.from(this.children)}function iA(e){return function(){return tA.call(this.children,e)}}function Df(e){return this.selectAll(e==null?nA:iA(typeof e==="function"?e:tl(e)))}function Nf(e){if(typeof e!=="function")e=If(e);for(var t=this._groups,n=t.length,i=Array(n),r=0;r<n;++r)for(var s=t[r],o=s.length,a=i[r]=[],l,c=0;c<o;++c)if((l=s[c])&&e.call(l,l.__data__,c,s))a.push(l);return new xt(i,this._parents)}function Ks(e){return Array(e.length)}function Of(){return new xt(this._enter||this._groups.map(Ks),this._parents)}function Qs(e,t){this.ownerDocument=e.ownerDocument,this.namespaceURI=e.namespaceURI,this._next=null,this._parent=e,this.__data__=t}Qs.prototype={constructor:Qs,appendChild:function(e){return this._parent.insertBefore(e,this._next)},insertBefore:function(e,t){return this._parent.insertBefore(e,t)},querySelector:function(e){return this._parent.querySelector(e)},querySelectorAll:function(e){return this._parent.querySelectorAll(e)}};function Uf(e){return function(){return e}}function rA(e,t,n,i,r,s){var o=0,a,l=t.length,c=s.length;for(;o<c;++o)if(a=t[o])a.__data__=s[o],i[o]=a;else n[o]=new Qs(e,s[o]);for(;o<l;++o)if(a=t[o])r[o]=a}function sA(e,t,n,i,r,s,o){var a,l,c=new Map,h=t.length,f=s.length,u=Array(h),p;for(a=0;a<h;++a)if(l=t[a])if(u[a]=p=o.call(l,l.__data__,a,t)+"",c.has(p))r[a]=l;else c.set(p,l);for(a=0;a<f;++a)if(p=o.call(e,s[a],a,s)+"",l=c.get(p))i[a]=l,l.__data__=s[a],c.delete(p);else n[a]=new Qs(e,s[a]);for(a=0;a<h;++a)if((l=t[a])&&c.get(u[a])===l)r[a]=l}function oA(e){return e.__data__}function Ff(e,t){if(!arguments.length)return Array.from(this,oA);var n=t?sA:rA,i=this._parents,r=this._groups;if(typeof e!=="function")e=Uf(e);for(var s=r.length,o=Array(s),a=Array(s),l=Array(s),c=0;c<s;++c){var h=i[c],f=r[c],u=f.length,p=aA(e.call(h,h&&h.__data__,c,i)),g=p.length,y=a[c]=Array(g),m=o[c]=Array(g),d=l[c]=Array(u);n(h,f,y,m,d,p,t);for(var b=0,S=0,_,x;b<g;++b)if(_=y[b]){if(b>=S)S=b+1;while(!(x=m[S])&&++S<g);_._next=x||null}}return o=new xt(o,i),o._enter=a,o._exit=l,o}function aA(e){return typeof e==="object"&&"length"in e?e:Array.from(e)}function Bf(){return new xt(this._exit||this._groups.map(Ks),this._parents)}function kf(e,t,n){var i=this.enter(),r=this,s=this.exit();if(typeof e==="function"){if(i=e(i),i)i=i.selection()}else i=i.append(e+"");if(t!=null){if(r=t(r),r)r=r.selection()}if(n==null)s.remove();else n(s);return i&&r?i.merge(r).order():r}function zf(e){var t=e.selection?e.selection():e;for(var n=this._groups,i=t._groups,r=n.length,s=i.length,o=Math.min(r,s),a=Array(r),l=0;l<o;++l)for(var c=n[l],h=i[l],f=c.length,u=a[l]=Array(f),p,g=0;g<f;++g)if(p=c[g]||h[g])u[g]=p;for(;l<r;++l)a[l]=n[l];return new xt(a,this._parents)}function Gf(){for(var e=this._groups,t=-1,n=e.length;++t<n;)for(var i=e[t],r=i.length-1,s=i[r],o;--r>=0;)if(o=i[r]){if(s&&o.compareDocumentPosition(s)^4)s.parentNode.insertBefore(o,s);s=o}return this}function Hf(e){if(!e)e=lA;function t(f,u){return f&&u?e(f.__data__,u.__data__):!f-!u}for(var n=this._groups,i=n.length,r=Array(i),s=0;s<i;++s){for(var o=n[s],a=o.length,l=r[s]=Array(a),c,h=0;h<a;++h)if(c=o[h])l[h]=c;l.sort(t)}return new xt(r,this._parents).order()}function lA(e,t){return e<t?-1:e>t?1:e>=t?0:NaN}function Vf(){var e=arguments[0];return arguments[0]=this,e.apply(null,arguments),this}function Wf(){return Array.from(this)}function Xf(){for(var e=this._groups,t=0,n=e.length;t<n;++t)for(var i=e[t],r=0,s=i.length;r<s;++r){var o=i[r];if(o)return o}return null}function qf(){let e=0;for(let t of this)++e;return e}function jf(){return!this.node()}function Yf(e){for(var t=this._groups,n=0,i=t.length;n<i;++n)for(var r=t[n],s=0,o=r.length,a;s<o;++s)if(a=r[s])e.call(a,a.__data__,s,r);return this}var nl="http://www.w3.org/1999/xhtml",$f={svg:"http://www.w3.org/2000/svg",xhtml:nl,xlink:"http://www.w3.org/1999/xlink",xml:"http://www.w3.org/XML/1998/namespace",xmlns:"http://www.w3.org/2000/xmlns/"};function eo(e){var t=e+="",n=t.indexOf(":");if(n>=0&&(t=e.slice(0,n))!=="xmlns")e=e.slice(n+1);return $f.hasOwnProperty(t)?{space:$f[t],local:e}:e}function cA(e){return function(){this.removeAttribute(e)}}function hA(e){return function(){this.removeAttributeNS(e.space,e.local)}}function uA(e,t){return function(){this.setAttribute(e,t)}}function fA(e,t){return function(){this.setAttributeNS(e.space,e.local,t)}}function dA(e,t){return function(){var n=t.apply(this,arguments);if(n==null)this.removeAttribute(e);else this.setAttribute(e,n)}}function pA(e,t){return function(){var n=t.apply(this,arguments);if(n==null)this.removeAttributeNS(e.space,e.local);else this.setAttributeNS(e.space,e.local,n)}}function Zf(e,t){var n=eo(e);if(arguments.length<2){var i=this.node();return n.local?i.getAttributeNS(n.space,n.local):i.getAttribute(n)}return this.each((t==null?n.local?hA:cA:typeof t==="function"?n.local?pA:dA:n.local?fA:uA)(n,t))}function to(e){return e.ownerDocument&&e.ownerDocument.defaultView||e.document&&e||e.defaultView}function mA(e){return function(){this.style.removeProperty(e)}}function gA(e,t,n){return function(){this.style.setProperty(e,t,n)}}function _A(e,t,n){return function(){var i=t.apply(this,arguments);if(i==null)this.style.removeProperty(e);else this.style.setProperty(e,i,n)}}function Jf(e,t,n){return arguments.length>1?this.each((t==null?mA:typeof t==="function"?_A:gA)(e,t,n==null?"":n)):vA(this.node(),e)}function vA(e,t){return e.style.getPropertyValue(t)||to(e).getComputedStyle(e,null).getPropertyValue(t)}function yA(e){return function(){delete this[e]}}function xA(e,t){return function(){this[e]=t}}function bA(e,t){return function(){var n=t.apply(this,arguments);if(n==null)delete this[e];else this[e]=n}}function Kf(e,t){return arguments.length>1?this.each((t==null?yA:typeof t==="function"?bA:xA)(e,t)):this.node()[e]}function g0(e){return e.trim().split(/^|\s+/)}function Qf(e){return e.classList||new _0(e)}function _0(e){this._node=e,this._names=g0(e.getAttribute("class")||"")}_0.prototype={add:function(e){var t=this._names.indexOf(e);if(t<0)this._names.push(e),this._node.setAttribute("class",this._names.join(" "))},remove:function(e){var t=this._names.indexOf(e);if(t>=0)this._names.splice(t,1),this._node.setAttribute("class",this._names.join(" "))},contains:function(e){return this._names.indexOf(e)>=0}};function v0(e,t){var n=Qf(e),i=-1,r=t.length;while(++i<r)n.add(t[i])}function y0(e,t){var n=Qf(e),i=-1,r=t.length;while(++i<r)n.remove(t[i])}function SA(e){return function(){v0(this,e)}}function MA(e){return function(){y0(this,e)}}function wA(e,t){return function(){(t.apply(this,arguments)?v0:y0)(this,e)}}function ed(e,t){var n=g0(e+"");if(arguments.length<2){var i=Qf(this.node()),r=-1,s=n.length;while(++r<s)if(!i.contains(n[r]))return!1;return!0}return this.each((typeof t==="function"?wA:t?SA:MA)(n,t))}function EA(){this.textContent=""}function TA(e){return function(){this.textContent=e}}function AA(e){return function(){var t=e.apply(this,arguments);this.textContent=t==null?"":t}}function td(e){return arguments.length?this.each(e==null?EA:(typeof e==="function"?AA:TA)(e)):this.node().textContent}function CA(){this.innerHTML=""}function RA(e){return function(){this.innerHTML=e}}function PA(e){return function(){var t=e.apply(this,arguments);this.innerHTML=t==null?"":t}}function nd(e){return arguments.length?this.each(e==null?CA:(typeof e==="function"?PA:RA)(e)):this.node().innerHTML}function IA(){if(this.nextSibling)this.parentNode.appendChild(this)}function id(){return this.each(IA)}function LA(){if(this.previousSibling)this.parentNode.insertBefore(this,this.parentNode.firstChild)}function rd(){return this.each(LA)}function DA(e){return function(){var t=this.ownerDocument,n=this.namespaceURI;return n===nl&&t.documentElement.namespaceURI===nl?t.createElement(e):t.createElementNS(n,e)}}function NA(e){return function(){return this.ownerDocument.createElementNS(e.space,e.local)}}function no(e){var t=eo(e);return(t.local?NA:DA)(t)}function sd(e){var t=typeof e==="function"?e:no(e);return this.select(function(){return this.appendChild(t.apply(this,arguments))})}function OA(){return null}function od(e,t){var n=typeof e==="function"?e:no(e),i=t==null?OA:typeof t==="function"?t:Js(t);return this.select(function(){return this.insertBefore(n.apply(this,arguments),i.apply(this,arguments)||null)})}function UA(){var e=this.parentNode;if(e)e.removeChild(this)}function ad(){return this.each(UA)}function FA(){var e=this.cloneNode(!1),t=this.parentNode;return t?t.insertBefore(e,this.nextSibling):e}function BA(){var e=this.cloneNode(!0),t=this.parentNode;return t?t.insertBefore(e,this.nextSibling):e}function ld(e){return this.select(e?BA:FA)}function cd(e){return arguments.length?this.property("__data__",e):this.node().__data__}function kA(e){return function(t){e.call(this,t,this.__data__)}}function zA(e){return e.trim().split(/^|\s+/).map(function(t){var n="",i=t.indexOf(".");if(i>=0)n=t.slice(i+1),t=t.slice(0,i);return{type:t,name:n}})}function GA(e){return function(){var t=this.__on;if(!t)return;for(var n=0,i=-1,r=t.length,s;n<r;++n)if(s=t[n],(!e.type||s.type===e.type)&&s.name===e.name)this.removeEventListener(s.type,s.listener,s.options);else t[++i]=s;if(++i)t.length=i;else delete this.__on}}function HA(e,t,n){return function(){var i=this.__on,r,s=kA(t);if(i){for(var o=0,a=i.length;o<a;++o)if((r=i[o]).type===e.type&&r.name===e.name){this.removeEventListener(r.type,r.listener,r.options),this.addEventListener(r.type,r.listener=s,r.options=n),r.value=t;return}}if(this.addEventListener(e.type,s,n),r={type:e.type,name:e.name,value:t,listener:s,options:n},!i)this.__on=[r];else i.push(r)}}function hd(e,t,n){var i=zA(e+""),r,s=i.length,o;if(arguments.length<2){var a=this.node().__on;if(a){for(var l=0,c=a.length,h;l<c;++l)for(r=0,h=a[l];r<s;++r)if((o=i[r]).type===h.type&&o.name===h.name)return h.value}return}a=t?HA:GA;for(r=0;r<s;++r)this.each(a(i[r],t,n));return this}function x0(e,t,n){var i=to(e),r=i.CustomEvent;if(typeof r==="function")r=new r(t,n);else if(r=i.document.createEvent("Event"),n)r.initEvent(t,n.bubbles,n.cancelable),r.detail=n.detail;else r.initEvent(t,!1,!1);e.dispatchEvent(r)}function VA(e,t){return function(){return x0(this,e,t)}}function WA(e,t){return function(){return x0(this,e,t.apply(this,arguments))}}function ud(e,t){return this.each((typeof t==="function"?WA:VA)(e,t))}function*fd(){for(var e=this._groups,t=0,n=e.length;t<n;++t)for(var i=e[t],r=0,s=i.length,o;r<s;++r)if(o=i[r])yield o}var dd=[null];function xt(e,t){this._groups=e,this._parents=t}function XA(){return new xt([[document.documentElement]],dd)}function qA(){return this}xt.prototype=XA.prototype={constructor:xt,select:Af,selectAll:Pf,selectChild:Lf,selectChildren:Df,filter:Nf,data:Ff,enter:Of,exit:Bf,join:kf,merge:zf,selection:qA,order:Gf,sort:Hf,call:Vf,nodes:Wf,node:Xf,size:qf,empty:jf,each:Yf,attr:Zf,style:Jf,property:Kf,classed:ed,text:td,html:nd,raise:id,lower:rd,append:sd,insert:od,remove:ad,clone:ld,datum:cd,on:hd,dispatch:ud,[Symbol.iterator]:fd};function il(e){return typeof e==="string"?new xt([[document.querySelector(e)]],[document.documentElement]):new xt([[e]],dd)}var so,vt,E0,_d,Pi,b0,T0,A0,pd,sl,io,C0,vd,md,gd,jA,al={},ll=[],YA=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,hl=Array.isArray;function Xn(e,t){for(var n in t)e[n]=t[n];return e}function yd(e){e&&e.parentNode&&e.parentNode.removeChild(e)}function $A(e,t,n){var i,r,s,o={};for(s in t)s=="key"?i=t[s]:s=="ref"?r=t[s]:o[s]=t[s];if(arguments.length>2&&(o.children=arguments.length>3?so.call(arguments,2):n),typeof e=="function"&&e.defaultProps!=null)for(s in e.defaultProps)o[s]===void 0&&(o[s]=e.defaultProps[s]);return ro(e,o,i,r,null)}function ro(e,t,n,i,r){var s={type:e,props:t,key:n,ref:i,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:r==null?++E0:r,__i:-1,__u:0};return r==null&&vt.vnode!=null&&vt.vnode(s),s}function ul(e){return e.children}function ol(e,t){this.props=e,this.context=t}function nr(e,t){if(t==null)return e.__?nr(e.__,e.__i+1):null;for(var n;t<e.__k.length;t++)if((n=e.__k[t])!=null&&n.__e!=null)return n.__e;return typeof e.type=="function"?nr(e):null}function ZA(e){if(e.__P&&e.__d){var t=e.__v,n=t.__e,i=[],r=[],s=Xn({},t);s.__v=t.__v+1,vt.vnode&&vt.vnode(s),xd(e.__P,s,t,e.__n,e.__P.namespaceURI,32&t.__u?[n]:null,i,n==null?nr(t):n,!!(32&t.__u),r),s.__v=t.__v,s.__.__k[s.__i]=s,D0(i,s,r),t.__e=t.__=null,s.__e!=n&&R0(s)}}function R0(e){if((e=e.__)!=null&&e.__c!=null)return e.__e=e.__c.base=null,e.__k.some(function(t){if(t!=null&&t.__e!=null)return e.__e=e.__c.base=t.__e}),R0(e)}function S0(e){(!e.__d&&(e.__d=!0)&&Pi.push(e)&&!cl.__r++||b0!=vt.debounceRendering)&&((b0=vt.debounceRendering)||T0)(cl)}function cl(){try{for(var e,t=1;Pi.length;)Pi.length>t&&Pi.sort(A0),e=Pi.shift(),t=Pi.length,ZA(e)}finally{Pi.length=cl.__r=0}}function P0(e,t,n,i,r,s,o,a,l,c,h){var f,u,p,g,y,m,d=i&&i.__k||ll,b=t.length;for(l=JA(n,t,d,l,b),f=0;f<b;f++)(p=n.__k[f])!=null&&(u=p.__i!=-1&&d[p.__i]||al,p.__i=f,m=xd(e,p,u,r,s,o,a,l,c,h),g=p.__e,p.ref&&u.ref!=p.ref&&(u.ref&&bd(u.ref,null,p),h.push(p.ref,p.__c||g,p)),y==null&&g!=null&&(y=g),4&p.__u?(l=I0(p,l,e),u.__e&&(u.__e=null)):typeof p.type=="function"&&m!==void 0?l=m:g&&(l=g.nextSibling),p.__u&=-7);return n.__e=y,l}function JA(e,t,n,i,r){var s,o,a,l,c,h=n.length,f=h,u=0;for(e.__k=Array(r),s=0;s<r;s++)(o=t[s])!=null&&typeof o!="boolean"&&typeof o!="function"?(typeof o=="string"||typeof o=="number"||typeof o=="bigint"||o.constructor==String?o=e.__k[s]=ro(null,o,null,null,null):hl(o)?o=e.__k[s]=ro(ul,{children:o},null,null,null):o.constructor===void 0&&o.__b>0?o=e.__k[s]=ro(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):e.__k[s]=o,l=s+u,o.__=e,o.__b=e.__b+1,a=null,(c=o.__i=KA(o,n,l,f))!=-1&&(f--,(a=n[c])&&(a.__u|=2)),a==null||a.__v==null?(c==-1&&(r>h?u--:r<h&&u++),typeof o.type!="function"&&(o.__u|=4)):c!=l&&(c==l-1?u--:c==l+1?u++:(c>l?u--:u++,o.__u|=4))):e.__k[s]=null;if(f)for(s=0;s<h;s++)(a=n[s])!=null&&(2&a.__u)==0&&(a.__e==i&&(i=nr(a)),O0(a,a));return i}function I0(e,t,n){var i,r;if(typeof e.type=="function"){for(i=e.__k,r=0;i&&r<i.length;r++)i[r]&&(i[r].__=e,t=I0(i[r],t,n));return t}e.__e!=t&&(t&&e.type&&!t.parentNode&&(t=nr(e)),t=n.insertBefore(e.__e,t||null));do t=t&&t.nextSibling;while(t!=null&&t.nodeType==8);return t}function KA(e,t,n,i){var r,s,o,{key:a,type:l}=e,c=t[n],h=c!=null&&(2&c.__u)==0;if(c===null&&a==null||h&&a==c.key&&l==c.type)return n;if(i>(h?1:0)){for(r=n-1,s=n+1;r>=0||s<t.length;)if((c=t[o=r>=0?r--:s++])!=null&&(2&c.__u)==0&&a==c.key&&l==c.type)return o}return-1}function M0(e,t,n){t[0]=="-"?e.setProperty(t,n==null?"":n):e[t]=n==null?"":typeof n!="number"||YA.test(t)?n:n+"px"}function rl(e,t,n,i,r){var s,o;e:if(t=="style")if(typeof n=="string")e.style.cssText=n;else{if(typeof i=="string"&&(e.style.cssText=i=""),i)for(t in i)n&&t in n||M0(e.style,t,"");if(n)for(t in n)i&&n[t]==i[t]||M0(e.style,t,n[t])}else if(t[0]=="o"&&t[1]=="n")s=t!=(t=t.replace(C0,"$1")),o=t.toLowerCase(),t=o in e||t=="onFocusOut"||t=="onFocusIn"?o.slice(2):t.slice(2),e.l||(e.l={}),e.l[t+s]=n,n?i?n[io]=i[io]:(n[io]=vd,e.addEventListener(t,s?gd:md,s)):e.removeEventListener(t,s?gd:md,s);else{if(r=="http://www.w3.org/2000/svg")t=t.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if(t!="width"&&t!="height"&&t!="href"&&t!="list"&&t!="form"&&t!="tabIndex"&&t!="download"&&t!="rowSpan"&&t!="colSpan"&&t!="role"&&t!="popover"&&t in e)try{e[t]=n==null?"":n;break e}catch(a){}typeof n=="function"||(n==null||n===!1&&t[4]!="-"?e.removeAttribute(t):e.setAttribute(t,t=="popover"&&n==1?"":n))}}function w0(e){return function(t){if(this.l){var n=this.l[t.type+e];if(t[sl]==null)t[sl]=vd++;else if(t[sl]<n[io])return;return n(vt.event?vt.event(t):t)}}}function xd(e,t,n,i,r,s,o,a,l,c){var h,f,u,p,g,y,m,d,b,S,_,x,w,T,v,A,N=t.type;if(t.constructor!==void 0)return null;128&n.__u&&(l=!!(32&n.__u),s=[a=t.__e=n.__e]),(h=vt.__b)&&h(t);e:if(typeof N=="function"){f=o.length;try{if(b=t.props,S=N.prototype&&N.prototype.render,_=(h=N.contextType)&&i[h.__c],x=h?_?_.props.value:h.__:i,n.__c?d=(u=t.__c=n.__c).__=u.__E:(S?t.__c=u=new N(b,x):(t.__c=u=new ol(b,x),u.constructor=N,u.render=eC),_&&_.sub(u),u.state||(u.state={}),u.__n=i,p=u.__d=!0,u.__h=[],u._sb=[]),S&&u.__s==null&&(u.__s=u.state),S&&N.getDerivedStateFromProps!=null&&(u.__s==u.state&&(u.__s=Xn({},u.__s)),Xn(u.__s,N.getDerivedStateFromProps(b,u.__s))),g=u.props,y=u.state,u.__v=t,p)S&&N.getDerivedStateFromProps==null&&u.componentWillMount!=null&&u.componentWillMount(),S&&u.componentDidMount!=null&&u.__h.push(u.componentDidMount);else{if(S&&N.getDerivedStateFromProps==null&&b!==g&&u.componentWillReceiveProps!=null&&u.componentWillReceiveProps(b,x),t.__v==n.__v||!u.__e&&u.shouldComponentUpdate!=null&&u.shouldComponentUpdate(b,u.__s,x)===!1){t.__v!=n.__v&&(u.props=b,u.state=u.__s,u.__d=!1),t.__e=n.__e,t.__k=n.__k,t.__k.some(function(P){P&&(P.__=t)}),ll.push.apply(u.__h,u._sb),u._sb=[],u.__h.length&&o.push(u),a=nr(n);break e}u.componentWillUpdate!=null&&u.componentWillUpdate(b,u.__s,x),S&&u.componentDidUpdate!=null&&u.__h.push(function(){u.componentDidUpdate(g,y,m)})}if(u.context=x,u.props=b,u.__P=e,u.__e=!1,w=vt.__r,T=0,S)u.state=u.__s,u.__d=!1,w&&w(t),h=u.render(u.props,u.state,u.context),ll.push.apply(u.__h,u._sb),u._sb=[];else do u.__d=!1,w&&w(t),h=u.render(u.props,u.state,u.context),u.state=u.__s;while(u.__d&&++T<25);u.state=u.__s,u.getChildContext!=null&&(i=Xn(Xn({},i),u.getChildContext())),S&&!p&&u.getSnapshotBeforeUpdate!=null&&(m=u.getSnapshotBeforeUpdate(g,y)),v=h!=null&&h.type===ul&&h.key==null?N0(h.props.children):h,a=P0(e,hl(v)?v:[v],t,n,i,r,s,o,a,l,c),u.base=t.__e,t.__u&=-161,u.__h.length&&o.push(u),d&&(u.__E=u.__=null)}catch(P){if(o.length=f,t.__v=null,l||s!=null){if(P.then){for(t.__u|=l?160:128;a&&a.nodeType==8&&a.nextSibling;)a=a.nextSibling;s!=null&&(s[s.indexOf(a)]=null),t.__e=a}else if(s!=null)for(A=s.length;A--;)yd(s[A])}else t.__e=n.__e;t.__k==null&&(t.__k=n.__k||[]),P.then||L0(t),vt.__e(P,t,n)}}else s==null&&t.__v==n.__v?(t.__k=n.__k,t.__e=n.__e):a=t.__e=QA(n.__e,t,n,i,r,s,o,l,c);return(h=vt.diffed)&&h(t),128&t.__u?void 0:a}function L0(e){e&&(e.__c&&(e.__c.__e=!0),e.__k&&e.__k.some(L0))}function D0(e,t,n){for(var i=0;i<n.length;i++)bd(n[i],n[++i],n[++i]);vt.__c&&vt.__c(t,e),e.some(function(r){try{e=r.__h,r.__h=[],e.some(function(s){s.call(r)})}catch(s){vt.__e(s,r.__v)}})}function N0(e){return typeof e!="object"||e==null||e.__b>0?e:hl(e)?e.map(N0):e.constructor!==void 0?null:Xn({},e)}function QA(e,t,n,i,r,s,o,a,l){var c,h,f,u,p,g,y,m=n.props||al,{props:d,type:b}=t;if(b=="svg"?r="http://www.w3.org/2000/svg":b=="math"?r="http://www.w3.org/1998/Math/MathML":r||(r="http://www.w3.org/1999/xhtml"),s!=null){for(c=0;c<s.length;c++)if((p=s[c])&&"setAttribute"in p==!!b&&(b?p.localName==b:p.nodeType==3)){e=p,s[c]=null;break}}if(e==null){if(b==null)return document.createTextNode(d);e=document.createElementNS(r,b,d.is&&d),a&&(vt.__m&&vt.__m(t,s),a=!1),s=null}if(b==null)m===d||a&&e.data==d||(e.data=d);else{if(s=b=="textarea"&&d.defaultValue!=null?null:s&&so.call(e.childNodes),!a&&s!=null)for(m={},c=0;c<e.attributes.length;c++)m[(p=e.attributes[c]).name]=p.value;for(c in m)p=m[c],c=="dangerouslySetInnerHTML"?f=p:c=="children"||(c in d)||c=="value"&&("defaultValue"in d)||c=="checked"&&("defaultChecked"in d)||rl(e,c,null,p,r);for(c in d)p=d[c],c=="children"?u=p:c=="dangerouslySetInnerHTML"?h=p:c=="value"?g=p:c=="checked"?y=p:a&&typeof p!="function"||m[c]===p||rl(e,c,p,m[c],r);if(h)a||f&&(h.__html==f.__html||h.__html==e.innerHTML)||(e.innerHTML=h.__html),t.__k=[];else if(f&&(e.innerHTML=""),P0(t.type=="template"?e.content:e,hl(u)?u:[u],t,n,i,b=="foreignObject"?"http://www.w3.org/1999/xhtml":r,s,o,s?s[0]:n.__k&&nr(n,0),a,l),s!=null)for(c=s.length;c--;)yd(s[c]);a&&b!="textarea"||(c="value",b=="progress"&&g==null?e.removeAttribute("value"):g!=null&&(g!==e[c]||b=="progress"&&!g||b=="option"&&g!=m[c])&&rl(e,c,g,m[c],r),c="checked",y!=null&&y!=e[c]&&rl(e,c,y,m[c],r))}return e}function bd(e,t,n){try{if(typeof e=="function"){var i=typeof e.__u=="function";i&&e.__u(),i&&t==null||(e.__u=e(t))}else e.current=t}catch(r){vt.__e(r,n)}}function O0(e,t,n){var i,r;if(vt.unmount&&vt.unmount(e),(i=e.ref)&&(i.current&&i.current!=e.__e||bd(i,null,t)),(i=e.__c)!=null){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(s){vt.__e(s,t)}i.base=i.__P=i.__n=null}if(i=e.__k)for(r=0;r<i.length;r++)i[r]&&O0(i[r],t,n||typeof e.type!="function");n||yd(e.__e),e.__c=e.__=e.__e=void 0}function eC(e,t,n){return this.constructor(e,n)}function U0(e,t,n){var i,r,s,o;t==document&&(t=document.documentElement),vt.__&&vt.__(e,t),r=(i=typeof n=="function")?null:n&&n.__k||t.__k,s=[],o=[],xd(t,e=(!i&&n||t).__k=$A(ul,null,[e]),r||al,al,t.namespaceURI,!i&&n?[n]:r?null:t.firstChild?so.call(t.childNodes):null,s,!i&&n?n:r?r.__e:t.firstChild,i,o),D0(s,e,o),e.props.children=null}function Sd(e,t,n){var i,r,s,o,a=Xn({},e.props);for(s in e.type&&e.type.defaultProps&&(o=e.type.defaultProps),t)s=="key"?i=t[s]:s=="ref"?r=t[s]:a[s]=t[s]===void 0&&o!=null?o[s]:t[s];return arguments.length>2&&(a.children=arguments.length>3?so.call(arguments,2):n),ro(e.type,a,i||e.key,r||e.ref,null)}so=ll.slice,vt={__e:function(e,t,n,i){for(var r,s,o;t=t.__;)if((r=t.__c)&&!r.__)try{if((s=r.constructor)&&s.getDerivedStateFromError!=null&&(r.setState(s.getDerivedStateFromError(e)),o=r.__d),r.componentDidCatch!=null&&(r.componentDidCatch(e,i||{}),o=r.__d),o)return r.__E=r}catch(a){e=a}throw e}},E0=0,_d=function(e){return e!=null&&e.constructor===void 0},ol.prototype.setState=function(e,t){var n;n=this.__s!=null&&this.__s!=this.state?this.__s:this.__s=Xn({},this.state),typeof e=="function"&&(e=e(Xn({},n),this.props)),e&&Xn(n,e),e!=null&&this.__v&&(t&&this._sb.push(t),S0(this))},ol.prototype.forceUpdate=function(e){this.__v&&(this.__e=!0,e&&this.__h.push(e),S0(this))},ol.prototype.render=ul,Pi=[],T0=typeof Promise=="function"?Promise.prototype.then.bind(Promise.resolve()):setTimeout,A0=function(e,t){return e.__v.__b-t.__v.__b},cl.__r=0,pd=Math.random().toString(8),sl="__d"+pd,io="__a"+pd,C0=/(PointerCapture)$|Capture$/i,vd=0,md=w0(!1),gd=w0(!0),jA=0;function F0(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function tC(e){if(Array.isArray(e))return e}function nC(e,t,n){return(t=lC(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function iC(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0);else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(h){c=!0,r=h}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function rC(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function B0(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);t&&(i=i.filter(function(r){return Object.getOwnPropertyDescriptor(e,r).enumerable})),n.push.apply(n,i)}return n}function sC(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]!=null?arguments[t]:{};t%2?B0(Object(n),!0).forEach(function(i){nC(e,i,n[i])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):B0(Object(n)).forEach(function(i){Object.defineProperty(e,i,Object.getOwnPropertyDescriptor(n,i))})}return e}function oC(e,t){return tC(e)||iC(e,t)||cC(e,t)||rC()}function aC(e,t){if(typeof e!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var i=n.call(e,t);if(typeof i!="object")return i;throw TypeError("@@toPrimitive must return a primitive value.")}return(t==="string"?String:Number)(e)}function lC(e){var t=aC(e,"string");return typeof t=="symbol"?t:t+""}function fl(e){return fl=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(t){return typeof t}:function(t){return t&&typeof Symbol=="function"&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},fl(e)}function cC(e,t){if(e){if(typeof e=="string")return F0(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?F0(e,t):void 0}}var Md=function(t){if(fl(t)!=="object")return t;var n=Sd(t);if(n.props){var i;if(n.props=sC({},n.props),n!==null&&n!==void 0&&(i=n.props)!==null&&i!==void 0&&i.children)n.props.children=Array.isArray(n.props.children)?n.props.children.map(Md):Md(n.props.children)}return n},hC=function(t){return _d(Sd(t))},uC=function(t,n){delete n.__k,U0(Md(t),n)};var k0=bi({props:{content:{default:!1},offsetX:{triggerUpdate:!1},offsetY:{triggerUpdate:!1}},init:function(t,n){var i=arguments.length>2&&arguments[2]!==void 0?arguments[2]:{},r=i.style,s=r===void 0?{}:r,o=!!t&&fl(t)==="object"&&!!t.node&&typeof t.node==="function",a=il(o?t.node():t);a.style("position")==="static"&&a.style("position","relative"),n.tooltipEl=a.append("div").attr("class","float-tooltip-kap"),Object.entries(s).forEach(function(c){var h=oC(c,2),f=h[0],u=h[1];return n.tooltipEl.style(f,u)}),n.tooltipEl.style("left","-10000px").style("display","none");var l="tooltip-".concat(Math.round(Math.random()*1000000000000));n.mouseInside=!1,a.on("mousemove.".concat(l),function(c){n.mouseInside=!0;var h=el(c),f=a.node(),{offsetWidth:u,offsetHeight:p}=f,g=[n.offsetX===null||n.offsetX===void 0?"-".concat(h[0]/u*100,"%"):typeof n.offsetX==="number"?"calc(-50% + ".concat(n.offsetX,"px)"):n.offsetX,n.offsetY===null||n.offsetY===void 0?p>130&&p-h[1]<100?"calc(-100% - 6px)":"21px":typeof n.offsetY==="number"?n.offsetY<0?"calc(-100% - ".concat(Math.abs(n.offsetY),"px)"):"".concat(n.offsetY,"px"):n.offsetY];n.tooltipEl.style("left",h[0]+"px").style("top",h[1]+"px").style("transform","translate(".concat(g.join(","),")")),n.content&&n.tooltipEl.style("display","inline")}),a.on("mouseover.".concat(l),function(){n.mouseInside=!0,n.content&&n.tooltipEl.style("display","inline")}),a.on("mouseout.".concat(l),function(){n.mouseInside=!1,n.tooltipEl.style("display","none")})},update:function(t){if(t.tooltipEl.style("display",!!t.content&&t.mouseInside?"inline":"none"),!t.content)t.tooltipEl.text("");else if(t.content instanceof HTMLElement)t.tooltipEl.text(""),t.tooltipEl.append(function(){return t.content});else if(typeof t.content==="string")t.tooltipEl.text(t.content);else if(hC(t.content))t.tooltipEl.text(""),uC(t.content,t.tooltipEl.node());else t.tooltipEl.style("display","none"),console.warn("Tooltip content is invalid, skipping.",t.content,t.content.toString())}});var fC=null;var z0=(e)=>{if(e instanceof Array)e.forEach(z0);else{if(e.map)e.map.dispose();e.dispose()}},G0=(e)=>{if(e.geometry)e.geometry.dispose();if(e.material)z0(e.material);if(e.texture)e.texture.dispose();if(e.children)e.children.forEach(G0)},dC=(e)=>{while(e.children.length){let t=e.children[0];e.remove(t),G0(t)}},$e=window.THREE?window.THREE:{WebGLRenderer:Oh,Scene:Ko,PerspectiveCamera:$t,Raycaster:zr,SRGBColorSpace:Lr,TextureLoader:ha,Vector2:se,Vector3:L,Box3:Pn,Color:ke,Mesh:Bt,SphereGeometry:Xi,MeshBasicMaterial:Or,BackSide:Vt,Timer:kr},wd=bi({props:{width:{default:window.innerWidth,onChange(e,t,n){isNaN(e)&&(t.width=n)}},height:{default:window.innerHeight,onChange(e,t,n){isNaN(e)&&(t.height=n)}},viewOffset:{default:[0,0]},backgroundColor:{default:"#000011"},backgroundImageUrl:{},onBackgroundImageLoaded:{},showNavInfo:{default:!0},skyRadius:{default:50000},objects:{default:[]},lights:{default:[]},enablePointerInteraction:{default:!0,onChange(e,t){t.hoverObj=null,t.tooltip&&t.tooltip.content(null)},triggerUpdate:!1},pointerRaycasterThrottleMs:{default:50,triggerUpdate:!1},lineHoverPrecision:{default:1,triggerUpdate:!1},pointsHoverPrecision:{default:1,triggerUpdate:!1},hoverOrderComparator:{triggerUpdate:!1},hoverFilter:{default:()=>!0,triggerUpdate:!1},tooltipContent:{triggerUpdate:!1},hoverDuringDrag:{default:!1,triggerUpdate:!1},clickAfterDrag:{default:!1,triggerUpdate:!1},onHover:{default:()=>{},triggerUpdate:!1},onClick:{default:()=>{},triggerUpdate:!1},onRightClick:{triggerUpdate:!1}},methods:{tick:function(e){if(e.initialised){e.controls.enabled&&e.controls.update&&e.controls.update(Math.min(1,e.timer.update().getDelta())),e.postProcessingComposer?e.postProcessingComposer.render():e.renderer.render(e.scene,e.camera),e.extraRenderers.forEach((n)=>n.render(e.scene,e.camera));let t=+new Date;if(e.enablePointerInteraction&&t-e.lastRaycasterCheck>=e.pointerRaycasterThrottleMs){e.lastRaycasterCheck=t;let n=null;if(e.hoverDuringDrag||!e.isPointerDragging){let i=this.intersectingObjects(e.pointerPos.x,e.pointerPos.y);e.hoverOrderComparator&&i.sort((s,o)=>e.hoverOrderComparator(s.object,o.object));let r=i.find((s)=>e.hoverFilter(s.object))||null;n=r?r.object:null,e.intersection=r||null}if(n!==e.hoverObj)e.onHover(n,e.hoverObj,e.intersection),e.tooltip.content(n?ze(e.tooltipContent)(n,e.intersection)||null:null),e.hoverObj=n}e.tweenGroup.update()}return this},getPointerPos:function(e){let{x:t,y:n}=e.pointerPos;return{x:t,y:n}},cameraPosition:function(e,t,n,i){let r=e.camera;if(t&&e.initialised){let l=t,c=n||{x:0,y:0,z:0};if(e.povPosTween?.end(),e.povTgtTween?.end(),!i)s(l),o(c);else{let h=Object.assign({},r.position),f=a();e.tweenGroup.add(e.povPosTween=new Ef(h).to(l,i).easing(Ri.Quadratic.Out).onUpdate(s).onComplete(function(){e.povPosTween=void 0,e.tweenGroup.remove(this)}).start()),e.tweenGroup.add(e.povTgtTween=new Ef(f).to(c,i/3).easing(Ri.Quadratic.Out).onUpdate(o).onComplete(function(){e.povTgtTween=void 0,e.tweenGroup.remove(this)}).start())}return this}return Object.assign({},r.position,{lookAt:a()});function s(l){let{x:c,y:h,z:f}=l;if(c!==void 0)r.position.x=c;if(h!==void 0)r.position.y=h;if(f!==void 0)r.position.z=f}function o(l){let c=new $e.Vector3(l.x,l.y,l.z);if(e.controls.enabled&&e.controls.target)e.controls.target=c;else r.lookAt(c)}function a(){return Object.assign(new $e.Vector3(0,0,-1000).applyQuaternion(r.quaternion).add(r.position))}},zoomToFit:function(e,t=0,n=10,i,r){return this.fitToBbox(this.getBbox(i),t,n,r)},fitToBbox:function(e,t,n=0,i=10,r=!1){let s=e.camera;if(t){s.updateMatrixWorld();let o=new $e.Vector3,a=new $e.Vector3,l=new $e.Vector3,c=new $e.Vector3;s.getWorldPosition(c),s.getWorldDirection(l),o.crossVectors(l,s.up).normalize(),a.crossVectors(o,l).normalize();let f=(1-i*2/e.height)*s.fov/2*(Math.PI/180),u=Math.atan(Math.tan(f)*s.aspect),p=new $e.Vector3((t.x[0]+t.x[1])/2,(t.y[0]+t.y[1])/2,(t.z[0]+t.z[1])/2),g=r?l.clone().multiplyScalar(c.distanceTo(p)).add(c):p,y=Math.max(0,...[new $e.Vector3(t.x[0],t.y[0],t.z[0]),new $e.Vector3(t.x[0],t.y[0],t.z[1]),new $e.Vector3(t.x[0],t.y[1],t.z[0]),new $e.Vector3(t.x[0],t.y[1],t.z[1]),new $e.Vector3(t.x[1],t.y[0],t.z[0]),new $e.Vector3(t.x[1],t.y[0],t.z[1]),new $e.Vector3(t.x[1],t.y[1],t.z[0]),new $e.Vector3(t.x[1],t.y[1],t.z[1])].map((b)=>{let S=b.clone().sub(g);return Math.max(Math.abs(S.dot(a))/Math.tan(f),Math.abs(S.dot(o))/Math.tan(u))-S.dot(l)})),m=l.clone().negate(),d={x:g.x+m.x*y,y:g.y+m.y*y,z:g.z+m.z*y};this.cameraPosition(d,g,n)}return this},getBbox:function(e,t=()=>!0){let n=new $e.Box3,i=e.objects.filter(t);if(!i.length)return null;return i.forEach((r)=>n.expandByObject(r)),Object.assign(...["x","y","z"].map((r)=>({[r]:[n.min[r],n.max[r]]})))},getScreenCoords:function(e,t,n,i){let r=new $e.Vector3(t,n,i);return r.project(this.camera()),{x:(r.x+1)*e.width/2,y:-(r.y-1)*e.height/2}},getSceneCoords:function(e,t,n,i=0){let r=new $e.Vector2(t/e.width*2-1,-(n/e.height)*2+1),s=new $e.Raycaster;return s.setFromCamera(r,e.camera),Object.assign({},s.ray.at(i,new $e.Vector3))},intersectingObjects:function(e,t,n){let i=new $e.Vector2(t/e.width*2-1,-(n/e.height)*2+1),r=new $e.Raycaster;return r.params.Line.threshold=e.lineHoverPrecision,r.params.Points.threshold=e.pointsHoverPrecision,r.setFromCamera(i,e.camera),r.intersectObjects(e.objects,!0)},renderer:(e)=>e.renderer,scene:(e)=>e.scene,camera:(e)=>e.camera,postProcessingComposer:(e)=>e.postProcessingComposer,controls:(e)=>e.controls,tbControls:(e)=>e.controls,_destructor:function(e){dC(e.scene),e.controls?.dispose(),e.renderer?.dispose(),e.postProcessingComposer?.dispose()}},stateInit:()=>({scene:new $e.Scene,camera:new $e.PerspectiveCamera,timer:new $e.Timer,tweenGroup:new wf,lastRaycasterCheck:0}),init(e,t,{controlType:n="trackball",useWebGPU:i=!1,rendererConfig:r={},extraRenderers:s=[],waitForLoadComplete:o=!0}={}){if(e.innerHTML="",e.appendChild(t.container=document.createElement("div")),t.container.className="scene-container",t.container.style.position="relative",t.container.appendChild(t.navInfo=document.createElement("div")),t.navInfo.className="scene-nav-info",t.navInfo.textContent={orbit:"Left-click: rotate, Mouse-wheel/middle-click: zoom, Right-click: pan",trackball:"Left-click: rotate, Mouse-wheel/middle-click: zoom, Right-click: pan",fly:"WASD: move, R|F: up | down, Q|E: roll, up|down: pitch, left|right: yaw"}[n]||"",t.navInfo.style.display=t.showNavInfo?null:"none",t.tooltip=new k0(t.container),t.pointerPos=new $e.Vector2,t.pointerPos.x=-2,t.pointerPos.y=-2,["pointermove","pointerdown"].forEach((a)=>t.container.addEventListener(a,(l)=>{if(a==="pointerdown"&&(t.isPointerPressed=!0),!t.isPointerDragging&&l.type==="pointermove"&&(l.pressure>0||t.isPointerPressed)&&(l.pointerType==="mouse"||l.movementX===void 0||[l.movementX,l.movementY].some((h)=>Math.abs(h)>1))&&(t.isPointerDragging=!0),t.enablePointerInteraction){let h=c(t.container);t.pointerPos.x=l.pageX-h.left,t.pointerPos.y=l.pageY-h.top}function c(h){let f=h.getBoundingClientRect(),u=window.pageXOffset||document.documentElement.scrollLeft,p=window.pageYOffset||document.documentElement.scrollTop;return{top:f.top+p,left:f.left+u}}},{passive:!0})),t.container.addEventListener("pointerup",(a)=>{if(!t.isPointerPressed)return;if(t.isPointerPressed=!1,t.isPointerDragging){if(t.isPointerDragging=!1,!t.clickAfterDrag)return}requestAnimationFrame(()=>{if(a.button===0)t.onClick(t.hoverObj||null,a,t.intersection);if(a.button===2&&t.onRightClick)t.onRightClick(t.hoverObj||null,a,t.intersection)})},{passive:!0,capture:!0}),t.container.addEventListener("contextmenu",(a)=>{if(t.onRightClick)a.preventDefault()}),t.renderer=new(i?fC:$e.WebGLRenderer)(Object.assign({antialias:!0,alpha:!0},r)),t.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio)),t.container.appendChild(t.renderer.domElement),t.extraRenderers=s,t.extraRenderers.forEach((a)=>{a.domElement.style.position="absolute",a.domElement.style.top="0px",a.domElement.style.pointerEvents="none",t.container.appendChild(a.domElement)}),t.postProcessingComposer=new mf(t.renderer),t.postProcessingComposer.addPass(new gf(t.scene,t.camera)),t.controls=new{trackball:af,orbit:hf,fly:uf}[n](t.camera,t.renderer.domElement),n==="fly")t.controls.movementSpeed=300,t.controls.rollSpeed=Math.PI/6,t.controls.dragToLook=!0;if(n==="trackball"||n==="orbit")t.controls.minDistance=0.1,t.controls.maxDistance=t.skyRadius,t.controls.addEventListener("start",()=>{t.controlsEngaged=!0}),t.controls.addEventListener("change",()=>{if(t.controlsEngaged)t.controlsDragging=!0}),t.controls.addEventListener("end",()=>{t.controlsEngaged=!1,t.controlsDragging=!1});[t.renderer,t.postProcessingComposer,...t.extraRenderers].forEach((a)=>a.setSize(t.width,t.height)),t.camera.aspect=t.width/t.height,t.camera.updateProjectionMatrix(),t.camera.position.z=1000,t.scene.add(t.skysphere=new $e.Mesh),t.skysphere.visible=!1,t.loadComplete=t.scene.visible=!o,window.scene=t.scene},update(e,t){if(e.width&&e.height&&(t.hasOwnProperty("width")||t.hasOwnProperty("height"))){let{width:i,height:r}=e;e.container.style.width=`${i}px`,e.container.style.height=`${r}px`,[e.renderer,e.postProcessingComposer,...e.extraRenderers].forEach((o)=>o.setSize(i,r)),e.camera.aspect=i/r;let s=e.viewOffset.slice(0,2);s.some((o)=>o)&&e.camera.setViewOffset(i,r,...s,i,r),e.camera.updateProjectionMatrix()}if(t.hasOwnProperty("viewOffset")){let{width:i,height:r}=e,s=e.viewOffset.slice(0,2);s.some((o)=>o)?e.camera.setViewOffset(i,r,...s,i,r):e.camera.clearViewOffset()}if(t.hasOwnProperty("skyRadius")&&e.skyRadius)e.controls.hasOwnProperty("maxDistance")&&t.skyRadius&&(e.controls.maxDistance=Math.min(e.controls.maxDistance,e.skyRadius)),e.camera.far=e.skyRadius*2.5,e.camera.updateProjectionMatrix(),e.skysphere.geometry=new $e.SphereGeometry(e.skyRadius);if(t.hasOwnProperty("backgroundColor")){let i=Ti(e.backgroundColor).alpha;if(i===void 0)i=1;e.renderer.setClearColor(new $e.Color(p0(1,e.backgroundColor)),i)}if(t.hasOwnProperty("backgroundImageUrl"))if(!e.backgroundImageUrl)e.skysphere.visible=!1,e.skysphere.material.map=null,!e.loadComplete&&n();else new $e.TextureLoader().load(e.backgroundImageUrl,(i)=>{i.colorSpace=$e.SRGBColorSpace,e.skysphere.material=new $e.MeshBasicMaterial({map:i,side:$e.BackSide}),e.skysphere.visible=!0,e.onBackgroundImageLoaded&&setTimeout(e.onBackgroundImageLoaded),!e.loadComplete&&n()});if(t.hasOwnProperty("showNavInfo")&&(e.navInfo.style.display=e.showNavInfo?null:"none"),t.hasOwnProperty("lights"))(t.lights||[]).forEach((i)=>e.scene.remove(i)),e.lights.forEach((i)=>e.scene.add(i));if(t.hasOwnProperty("objects"))(t.objects||[]).forEach((i)=>e.scene.remove(i)),e.objects.forEach((i)=>e.scene.add(i));function n(){e.loadComplete=e.scene.visible=!0}}});function H0(e,t){let n=new t;return n._destructor&&n._destructor(),{linkProp:function(i){return{default:n[i](),onChange(r,s){s[e][i](r)},triggerUpdate:!1}},linkMethod:function(i){return function(r,...s){let o=r[e],a=o[i](...s);return a===o?this:a}}}}var Ed=window.THREE?window.THREE:{AmbientLight:pa,DirectionalLight:da,REVISION:Bo},pC=170,V0=H0("forceGraph",ef),mC=Object.assign(...["jsonUrl","graphData","numDimensions","dagMode","dagLevelDistance","dagNodeFilter","onDagError","nodeRelSize","nodeId","nodeVal","nodeResolution","nodeColor","nodeAutoColorBy","nodeOpacity","nodeVisibility","nodeThreeObject","nodeThreeObjectExtend","nodePositionUpdate","linkSource","linkTarget","linkVisibility","linkColor","linkAutoColorBy","linkOpacity","linkWidth","linkResolution","linkCurvature","linkCurveRotation","linkMaterial","linkThreeObject","linkThreeObjectExtend","linkPositionUpdate","linkDirectionalArrowLength","linkDirectionalArrowColor","linkDirectionalArrowRelPos","linkDirectionalArrowResolution","linkDirectionalParticles","linkDirectionalParticleSpeed","linkDirectionalParticleOffset","linkDirectionalParticleWidth","linkDirectionalParticleColor","linkDirectionalParticleResolution","linkDirectionalParticleThreeObject","forceEngine","d3AlphaDecay","d3VelocityDecay","d3AlphaMin","ngraphPhysics","warmupTicks","cooldownTicks","cooldownTime","onEngineTick","onEngineStop"].map((e)=>({[e]:V0.linkProp(e)}))),gC=Object.assign(...["refresh","getGraphBbox","d3Force","d3ReheatSimulation","emitParticle"].map((e)=>({[e]:V0.linkMethod(e)}))),dl=H0("renderObjs",wd),_C=Object.assign(...["width","height","backgroundColor","showNavInfo","enablePointerInteraction"].map((e)=>({[e]:dl.linkProp(e)}))),vC=Object.assign(...["lights","cameraPosition","postProcessingComposer"].map((e)=>({[e]:dl.linkMethod(e)})),{graph2ScreenCoords:dl.linkMethod("getScreenCoords"),screen2GraphCoords:dl.linkMethod("getSceneCoords")}),yC=bi({props:{nodeLabel:{default:"name",triggerUpdate:!1},linkLabel:{default:"name",triggerUpdate:!1},linkHoverPrecision:{default:1,onChange:(e,t)=>t.renderObjs.lineHoverPrecision(e),triggerUpdate:!1},enableNavigationControls:{default:!0,onChange(e,t){let n=t.renderObjs.controls();if(n)n.enabled=e,e&&n.domElement&&n.domElement.dispatchEvent(new PointerEvent("pointerup"))},triggerUpdate:!1},enableNodeDrag:{default:!0,triggerUpdate:!1},onNodeDrag:{default:()=>{},triggerUpdate:!1},onNodeDragEnd:{default:()=>{},triggerUpdate:!1},onNodeClick:{triggerUpdate:!1},onNodeRightClick:{triggerUpdate:!1},onNodeHover:{triggerUpdate:!1},onLinkClick:{triggerUpdate:!1},onLinkRightClick:{triggerUpdate:!1},onLinkHover:{triggerUpdate:!1},onBackgroundClick:{triggerUpdate:!1},onBackgroundRightClick:{triggerUpdate:!1},showPointerCursor:{default:!0,triggerUpdate:!1},...mC,..._C},methods:{zoomToFit:function(e,t,n,...i){return e.renderObjs.fitToBbox(e.forceGraph.getGraphBbox(...i),t,n),this},pauseAnimation:function(e){if(e.animationFrameRequestId!==null)cancelAnimationFrame(e.animationFrameRequestId),e.animationFrameRequestId=null;return this},resumeAnimation:function(e){if(e.animationFrameRequestId===null)this._animationCycle();return this},_animationCycle(e){if(e.enablePointerInteraction)this.renderer().domElement.style.cursor=null;e.forceGraph.tickFrame(),e.renderObjs.tick(),e.animationFrameRequestId=requestAnimationFrame(this._animationCycle)},scene:(e)=>e.renderObjs.scene(),camera:(e)=>e.renderObjs.camera(),renderer:(e)=>e.renderObjs.renderer(),controls:(e)=>e.renderObjs.controls(),_destructor:function(e){this.pauseAnimation(),this.graphData({nodes:[],links:[]}),e.forceGraph._destructor?.(),e.renderObjs._destructor()},...gC,...vC},stateInit:({controlType:e,rendererConfig:t,extraRenderers:n})=>{let i=new ef;return{forceGraph:i,renderObjs:wd({controlType:e,rendererConfig:t,extraRenderers:n}).objects([i]).lights([new Ed.AmbientLight(13421772,Math.PI),new Ed.DirectionalLight(16777215,0.6*Math.PI)])}},init:function(e,t){e.innerHTML="",e.appendChild(t.container=document.createElement("div")),t.container.style.position="relative";let n=document.createElement("div");t.container.appendChild(n),t.renderObjs(n);let i=t.renderObjs.camera(),r=t.renderObjs.renderer(),s=t.renderObjs.controls();s.enabled=!!t.enableNavigationControls,t.lastSetCameraZ=i.position.z;let o;t.container.appendChild(o=document.createElement("div")),o.className="graph-info-msg",o.textContent="",t.forceGraph.onLoading(()=>{o.textContent="Loading..."}).onFinishLoading(()=>{o.textContent=""}).onUpdate(()=>{if(t.graphData=t.forceGraph.graphData(),i.position.x===0&&i.position.y===0&&i.position.z===t.lastSetCameraZ&&t.graphData.nodes.length)i.lookAt(t.forceGraph.position),t.lastSetCameraZ=i.position.z=Math.cbrt(t.graphData.nodes.length)*pC}).onFinishUpdate(()=>{if(t._dragControls){let a=t.graphData.nodes.find((l)=>l.__initialFixedPos&&!l.__disposeControlsAfterDrag);if(a)a.__disposeControlsAfterDrag=!0;else t._dragControls.dispose();t._dragControls=void 0}if(t.enableNodeDrag&&t.enablePointerInteraction&&t.forceEngine==="d3"){let a=t._dragControls=new Bh(t.graphData.nodes.map((l)=>l.__threeObj).filter((l)=>l),i,r.domElement);a.addEventListener("dragstart",function(l){let c=ai(l.object);if(!c)return;s.enabled=!1,l.object.__initialPos=l.object.position.clone(),l.object.__prevPos=l.object.position.clone();let h=c.__data;!h.__initialFixedPos&&(h.__initialFixedPos={fx:h.fx,fy:h.fy,fz:h.fz}),!h.__initialPos&&(h.__initialPos={x:h.x,y:h.y,z:h.z}),["x","y","z"].forEach((f)=>h[`f${f}`]=h[f]),r.domElement.classList.add("grabbable")}),a.addEventListener("drag",function(l){let c=ai(l.object);if(!c)return;if(!l.object.hasOwnProperty("__graphObjType")){let p=l.object.__initialPos,g=l.object.__prevPos,y=l.object.position;c.position.add(y.clone().sub(g)),g.copy(y),y.copy(p)}let{__data:h,position:f}=c,u={x:f.x-h.x,y:f.y-h.y,z:f.z-h.z};["x","y","z"].forEach((p)=>h[`f${p}`]=h[p]=f[p]),t.forceGraph.d3AlphaTarget(0.3).resetCountdown(),h.__dragged=!0,t.onNodeDrag(h,u)}),a.addEventListener("dragend",function(l){let c=ai(l.object);if(!c)return;delete l.object.__initialPos,delete l.object.__prevPos;let h=c.__data;if(h.__disposeControlsAfterDrag)a.dispose(),delete h.__disposeControlsAfterDrag;let{__initialFixedPos:f,__initialPos:u}=h,p={x:u.x-h.x,y:u.y-h.y,z:u.z-h.z};if(f){if(["x","y","z"].forEach((g)=>{let y=`f${g}`;if(f[y]===void 0)delete h[y]}),delete h.__initialFixedPos,delete h.__initialPos,h.__dragged)delete h.__dragged,t.onNodeDragEnd(h,p)}if(t.forceGraph.d3AlphaTarget(0).resetCountdown(),t.enableNavigationControls)s.enabled=!0,s._status&&s._onPointerCancel?.(),s.domElement&&s.domElement.ownerDocument&&s.domElement.ownerDocument.dispatchEvent(new PointerEvent("pointerup",{pointerType:"touch"}));r.domElement.classList.remove("grabbable")})}}),Ed.REVISION<155&&(t.renderObjs.renderer().useLegacyLights=!1),t.renderObjs.hoverOrderComparator((a,l)=>{let c=ai(a);if(!c)return 1;let h=ai(l);if(!h)return-1;let f=(u)=>u.__graphObjType==="node";return f(h)-f(c)}).tooltipContent((a)=>{let l=ai(a);return l?ze(t[`${l.__graphObjType}Label`])(l.__data)||"":""}).hoverDuringDrag(!1).onHover((a)=>{let l=ai(a);if(l!==t.hoverObj){let c=t.hoverObj?t.hoverObj.__graphObjType:null,h=t.hoverObj?t.hoverObj.__data:null,f=l?l.__graphObjType:null,u=l?l.__data:null;if(c&&c!==f){let p=t[`on${c==="node"?"Node":"Link"}Hover`];p&&p(null,h)}if(f){let p=t[`on${f==="node"?"Node":"Link"}Hover`];p&&p(u,c===f?h:null)}r.domElement.classList[(l&&t[`on${f==="node"?"Node":"Link"}Click`]||!l&&t.onBackgroundClick)&&ze(t.showPointerCursor)(u)?"add":"remove"]("clickable"),t.hoverObj=l}}).clickAfterDrag(!1).onClick((a,l)=>{let c=ai(a);if(c){let h=t[`on${c.__graphObjType==="node"?"Node":"Link"}Click`];h&&h(c.__data,l)}else t.onBackgroundClick&&t.onBackgroundClick(l)}).onRightClick((a,l)=>{let c=ai(a);if(c){let h=t[`on${c.__graphObjType==="node"?"Node":"Link"}RightClick`];h&&h(c.__data,l)}else t.onBackgroundRightClick&&t.onBackgroundRightClick(l)}),this._animationCycle()}});function ai(e){let t=e;while(t&&!t.hasOwnProperty("__graphObjType"))t=t.parent;return t}function Td(e,t){(t==null||t>e.length)&&(t=e.length);for(var n=0,i=Array(t);n<t;n++)i[n]=e[n];return i}function xC(e){if(Array.isArray(e))return e}function bC(e){if(Array.isArray(e))return Td(e)}function SC(e){if(e===void 0)throw ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function MC(e,t,n){return t=pl(t),LC(e,X0()?Reflect.construct(t,n||[],pl(e).constructor):t.apply(e,n))}function wC(e,t){if(!(e instanceof t))throw TypeError("Cannot call a class as a function")}function EC(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,NC(i.key),i)}}function TC(e,t,n){return t&&EC(e.prototype,t),Object.defineProperty(e,"prototype",{writable:!1}),e}function pl(e){return pl=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(t){return t.__proto__||Object.getPrototypeOf(t)},pl(e)}function AC(e,t){if(typeof t!="function"&&t!==null)throw TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&Ad(e,t)}function X0(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],function(){}))}catch(t){}return(X0=function(){return!!e})()}function CC(e){if(typeof Symbol<"u"&&e[Symbol.iterator]!=null||e["@@iterator"]!=null)return Array.from(e)}function RC(e,t){var n=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(n!=null){var i,r,s,o,a=[],l=!0,c=!1;try{if(s=(n=n.call(e)).next,t===0){if(Object(n)!==n)return;l=!1}else for(;!(l=(i=s.call(n)).done)&&(a.push(i.value),a.length!==t);l=!0);}catch(h){c=!0,r=h}finally{try{if(!l&&n.return!=null&&(o=n.return(),Object(o)!==o))return}finally{if(c)throw r}}return a}}function PC(){throw TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function IC(){throw TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function LC(e,t){if(t&&(typeof t=="object"||typeof t=="function"))return t;if(t!==void 0)throw TypeError("Derived constructors may only return object or undefined");return SC(e)}function Ad(e,t){return Ad=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(n,i){return n.__proto__=i,n},Ad(e,t)}function W0(e,t){return xC(e)||RC(e,t)||q0(e,t)||PC()}function oo(e){return bC(e)||CC(e)||q0(e)||IC()}function DC(e,t){if(typeof e!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var i=n.call(e,t);if(typeof i!="object")return i;throw TypeError("@@toPrimitive must return a primitive value.")}return String(e)}function NC(e){var t=DC(e,"string");return typeof t=="symbol"?t:t+""}function q0(e,t){if(e){if(typeof e=="string")return Td(e,t);var n={}.toString.call(e).slice(8,-1);return n==="Object"&&e.constructor&&(n=e.constructor.name),n==="Map"||n==="Set"?Array.from(e):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?Td(e,t):void 0}}var ao=typeof window<"u"&&window.THREE?window.THREE:{CanvasTexture:ra,Sprite:ta,SpriteMaterial:bs,SRGBColorSpace:Lr},OC=function(e){function t(){var n,i=arguments.length>0&&arguments[0]!==void 0?arguments[0]:"",r=arguments.length>1&&arguments[1]!==void 0?arguments[1]:10,s=arguments.length>2&&arguments[2]!==void 0?arguments[2]:"rgba(255, 255, 255, 1)";return wC(this,t),n=MC(this,t,[new ao.SpriteMaterial]),n._text="".concat(i),n._textHeight=r,n._color=s,n._backgroundColor=!1,n._padding=0,n._borderWidth=0,n._borderRadius=0,n._borderColor="white",n._offsetX=0,n._offsetY=0,n._strokeWidth=0,n._strokeColor="white",n._fontFace="system-ui",n._fontSize=90,n._fontWeight="normal",n._canvas=document.createElement("canvas"),n._genCanvas(),n}return AC(t,e),TC(t,[{key:"text",get:function(){return this._text},set:function(i){this._text=i,this._genCanvas()}},{key:"textHeight",get:function(){return this._textHeight},set:function(i){this._textHeight=i,this._genCanvas()}},{key:"color",get:function(){return this._color},set:function(i){this._color=i,this._genCanvas()}},{key:"backgroundColor",get:function(){return this._backgroundColor},set:function(i){this._backgroundColor=i,this._genCanvas()}},{key:"padding",get:function(){return this._padding},set:function(i){this._padding=i,this._genCanvas()}},{key:"borderWidth",get:function(){return this._borderWidth},set:function(i){this._borderWidth=i,this._genCanvas()}},{key:"borderRadius",get:function(){return this._borderRadius},set:function(i){this._borderRadius=i,this._genCanvas()}},{key:"borderColor",get:function(){return this._borderColor},set:function(i){this._borderColor=i,this._genCanvas()}},{key:"offsetX",get:function(){return this._offsetX},set:function(i){this._offsetX=i,this._genCanvas()}},{key:"offsetY",get:function(){return this._offsetY},set:function(i){this._offsetY=i,this._genCanvas()}},{key:"fontFace",get:function(){return this._fontFace},set:function(i){this._fontFace=i,this._genCanvas()}},{key:"fontSize",get:function(){return this._fontSize},set:function(i){this._fontSize=i,this._genCanvas()}},{key:"fontWeight",get:function(){return this._fontWeight},set:function(i){this._fontWeight=i,this._genCanvas()}},{key:"strokeWidth",get:function(){return this._strokeWidth},set:function(i){this._strokeWidth=i,this._genCanvas()}},{key:"strokeColor",get:function(){return this._strokeColor},set:function(i){this._strokeColor=i,this._genCanvas()}},{key:"_genCanvas",value:function(){var i=this,r=this._canvas,s=r.getContext("2d"),o=1/this.textHeight,a=Array.isArray(this.borderWidth)?this.borderWidth:[this.borderWidth,this.borderWidth],l=a.map(function(P){return P*i.fontSize*o}),c=Array.isArray(this.borderRadius)?this.borderRadius:[this.borderRadius,this.borderRadius,this.borderRadius,this.borderRadius],h=c.map(function(P){return P*i.fontSize*o}),f=Array.isArray(this.padding)?this.padding:[this.padding,this.padding],u=f.map(function(P){return P*i.fontSize*o}),p=[this.offsetX,this.offsetY].map(function(P){return P*i.fontSize*o}),g=this.text.split(`
`),y="".concat(this.fontWeight," ").concat(this.fontSize,"px ").concat(this.fontFace);s.font=y;var m=Math.max.apply(Math,oo(g.map(function(P){return s.measureText(P).width}))),d=this.fontSize*g.length,b=m+l[0]*2+u[0]*2,S=d+l[1]*2+u[1]*2;if(r.width=b+Math.abs(p[0]),r.height=S+Math.abs(p[1]),s.translate.apply(s,oo(p.map(function(P){return Math.max(0,P)}))),this.borderWidth){if(s.strokeStyle=this.borderColor,l[0]){var _=l[0]/2;s.lineWidth=l[0],s.beginPath(),s.moveTo(_,h[0]),s.lineTo(_,S-h[3]),s.moveTo(b-_,h[1]),s.lineTo(b-_,S-h[2]),s.stroke()}if(l[1]){var x=l[1]/2;s.lineWidth=l[1],s.beginPath(),s.moveTo(Math.max(l[0],h[0]),x),s.lineTo(b-Math.max(l[0],h[1]),x),s.moveTo(Math.max(l[0],h[3]),S-x),s.lineTo(b-Math.max(l[0],h[2]),S-x),s.stroke()}if(this.borderRadius){var w=Math.max.apply(Math,oo(l)),T=w/2;s.lineWidth=w,s.beginPath(),[!!h[0]&&[h[0],T,T,h[0]],!!h[1]&&[b-h[1],b-T,T,h[1]],!!h[2]&&[b-h[2],b-T,S-T,S-h[2]],!!h[3]&&[h[3],T,S-T,S-h[3]]].filter(function(P){return P}).forEach(function(P){var D=W0(P,4),W=D[0],R=D[1],I=D[2],k=D[3];s.moveTo(W,I),s.quadraticCurveTo(R,I,R,k)}),s.stroke()}}if(this.backgroundColor)if(s.fillStyle=this.backgroundColor,!this.borderRadius)s.fillRect(l[0],l[1],b-l[0]*2,S-l[1]*2);else s.beginPath(),s.moveTo(l[0],h[0]),[[l[0],h[0],b-h[1],l[1],l[1],l[1]],[b-l[0],b-l[0],b-l[0],l[1],h[1],S-h[2]],[b-l[0],b-h[2],h[3],S-l[1],S-l[1],S-l[1]],[l[0],l[0],l[0],S-l[1],S-h[3],h[0]]].forEach(function(P){var D=W0(P,6),W=D[0],R=D[1],I=D[2],k=D[3],z=D[4],te=D[5];s.quadraticCurveTo(W,k,R,z),s.lineTo(I,te)}),s.closePath(),s.fill();s.translate.apply(s,oo(l)),s.translate.apply(s,oo(u)),s.font=y,s.fillStyle=this.color,s.textBaseline="bottom";var v=this.strokeWidth>0;if(v)s.lineWidth=this.strokeWidth*this.fontSize/10,s.strokeStyle=this.strokeColor;if(g.forEach(function(P,D){var W=(m-s.measureText(P).width)/2,R=(D+1)*i.fontSize;v&&s.strokeText(P,W,R),s.fillText(P,W,R)}),this.material.map)this.material.map.dispose();var A=this.material.map=new ao.CanvasTexture(r);A.colorSpace=ao.SRGBColorSpace;var N=this.textHeight*g.length+a[1]*2+f[1]*2+Math.abs(this.offsetY);this.scale.set(N*r.width/r.height,N,0)}},{key:"clone",value:function(){return new this.constructor(this.text,this.textHeight,this.color).copy(this)}},{key:"copy",value:function(i){return ao.Sprite.prototype.copy.call(this,i),this.color=i.color,this.backgroundColor=i.backgroundColor,this.padding=i.padding,this.borderWidth=i.borderWidth,this.borderColor=i.borderColor,this.offsetX=i.offsetX,this.offsetY=i.offsetY,this.fontFace=i.fontFace,this.fontSize=i.fontSize,this.fontWeight=i.fontWeight,this.strokeWidth=i.strokeWidth,this.strokeColor=i.strokeColor,this}}])}(ao.Sprite);export{yC as ForceGraph3D,OC as SpriteText};
