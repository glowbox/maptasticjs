/*
Numeric Javascript
Copyright (C) 2011 by Sébastien Loisel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
!function(){function r(t,n,o,e){if(o===n.length-1)return e(t);var f,u=n[o],c=Array(u);for(f=u-1;f>=0;--f)c[f]=r(t[f],n,o+1,e);return c}function t(r){for(var t=[];"object"==typeof r;)t.push(r.length),r=r[0];return t}function n(r){var n,o;return"object"==typeof r?(n=r[0],"object"==typeof n?(o=n[0],"object"==typeof o?t(r):[r.length,n.length]):[r.length]):[]}function o(r){var t,n=r.length,o=Array(n);for(t=n-1;-1!==t;--t)o[t]=r[t];return o}function e(t){return"object"!=typeof t?t:r(t,n(t),0,o)}function f(r,t){t=t||!1;var n,o,f,u,a,h,i,l,g,v=r.length,y=v-1,b=new Array(v);for(t||(r=e(r)),f=0;v>f;++f){for(i=f,h=r[f],g=c(h[f]),o=f+1;v>o;++o)u=c(r[o][f]),u>g&&(g=u,i=o);for(b[f]=i,i!=f&&(r[f]=r[i],r[i]=h,h=r[f]),a=h[f],n=f+1;v>n;++n)r[n][f]/=a;for(n=f+1;v>n;++n){for(l=r[n],o=f+1;y>o;++o)l[o]-=l[f]*h[o],++o,l[o]-=l[f]*h[o];o===y&&(l[o]-=l[f]*h[o])}}return{LU:r,P:b}}function u(r,t){var n,o,f,u,c,a=r.LU,h=a.length,i=e(t),l=r.P;for(n=h-1;-1!==n;--n)i[n]=t[n];for(n=0;h>n;++n)for(f=l[n],l[n]!==n&&(c=i[n],i[n]=i[f],i[f]=c),u=a[n],o=0;n>o;++o)i[n]-=i[o]*u[o];for(n=h-1;n>=0;--n){for(u=a[n],o=n+1;h>o;++o)i[n]-=i[o]*u[o];i[n]/=u[n]}return i}var c=Math.abs;solve=function(r,t,n){return u(f(r,n),t)}}();


var Maptastic = function(config) {

  var getProp = function(cfg, key, defaultVal){
    if(cfg && cfg.hasOwnProperty(key) && (cfg[key] !== null)) {
      return cfg[key];
    } else {
      return defaultVal;
    }
  }

  var showLayerNames       = getProp(config, 'labels', true);
  var showCrosshairs       = getProp(config, 'crosshairs', false);
  var showScreenBounds     = getProp(config, 'screenbounds', false);
  var autoSave             = getProp(config, 'autoSave', true);
  var autoLoad             = getProp(config, 'autoLoad', true);
  var layerList            = getProp(config, 'layers', []);
  var layoutChangeListener = getProp(config, 'onchange', function(){} );
  var localStorageKey      = 'maptastic.layers';

  var canvas = null;
  var context = null;

  var layers = [];

  var configActive = false;

  var dragging = false;
  var dragOffset = [];

  var selectedLayer = null;
  var selectedPoint = null;
  var selectionRadius = 20;
  var hoveringPoint = null;
  var hoveringLayer = null;
  var dragOperation = "move";
  var isLayerSoloed = false;

  var mousePosition = [];
  var mouseDelta = [];
  var mouseDownPoint = [];

	// Compute linear distance.
	var distanceTo = function(x1, y1, x2, y2) {
	  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
	}

  var pointInTriangle = function(point, a, b, c) {
		var s = a[1] * c[0] - a[0] * c[1] + (c[1] - a[1]) * point[0] + (a[0] - c[0]) * point[1];
		var t = a[0] * b[1] - a[1] * b[0] + (a[1] - b[1]) * point[0] + (b[0] - a[0]) * point[1];

		if ((s < 0) != (t < 0)) {
		return false;
		}

		var A = -b[1] * c[0] + a[1] * (c[0] - b[0]) + a[0] * (b[1] - c[1]) + b[0] * c[1];
		if (A < 0.0) {
		s = -s;
		t = -t;
		A = -A;
		}

		return s > 0 && t > 0 && (s + t) < A;
	};

	// determine if a point is inside a layer quad.
	var pointInLayer = function(point, layer) {
	  var a = pointInTriangle(point, layer.targetPoints[0], layer.targetPoints[1], layer.targetPoints[2]);
	  var b = pointInTriangle(point, layer.targetPoints[3], layer.targetPoints[0], layer.targetPoints[2]);
	  return a || b;
	};

  var notifyChangeListener = function() {
    layoutChangeListener();
  };

	var draw = function() {
	  if(!configActive){
	    return;
	  }
	  
	  context.strokeStyle = "red";
	  context.lineWidth = 2;
	  context.clearRect(0, 0, canvas.width, canvas.height);	  
	  
	  for(var i = 0; i < layers.length; i++) {
	    
	  	if(layers[i].visible){
	  		layers[i].element.style.visibility = "visible";

		    // Draw layer rectangles.
		    context.beginPath();
		    if(layers[i] === hoveringLayer){
		      context.strokeStyle = "red";
		    } else if(layers[i] === selectedLayer){
		      context.strokeStyle = "red";
		    } else {
		      context.strokeStyle = "white";
		    }
		    context.moveTo(layers[i].targetPoints[0][0], layers[i].targetPoints[0][1]);
		    for(var p = 0; p < layers[i].targetPoints.length; p++) {
		      context.lineTo(layers[i].targetPoints[p][0], layers[i].targetPoints[p][1]);
		    }
		    context.lineTo(layers[i].targetPoints[3][0], layers[i].targetPoints[3][1]);
		    context.closePath();
		    context.stroke();

		    // Draw corner points.
		    var centerPoint = [0,0];
		    for(var p = 0; p < layers[i].targetPoints.length; p++) {

		      if(layers[i].targetPoints[p] === hoveringPoint){
		        context.strokeStyle = "red";
		      } else if( layers[i].targetPoints[p] === selectedPoint ) {
		        context.strokeStyle = "red";
		      } else {
		        context.strokeStyle = "white";
		      }
		      
		      centerPoint[0] += layers[i].targetPoints[p][0];
		      centerPoint[1] += layers[i].targetPoints[p][1];
		      
		      context.beginPath();
		      context.arc(layers[i].targetPoints[p][0], layers[i].targetPoints[p][1],
		        selectionRadius / 2, 0, 2 * Math.PI, false);
		      context.stroke();
		    }

		    // Find the average of the corner locations for an approximate center.
		    centerPoint[0] /= 4;
		    centerPoint[1] /= 4;


		    if(showLayerNames) {
		      // Draw the element ID in the center of the quad for reference.
		      var label = layers[i].element.id.toUpperCase();
		      context.font="16px sans-serif";
		      context.textAlign = "center";
		      var metrics = context.measureText(label);
		      var size = [metrics.width + 8, 16 + 16]
		      context.fillStyle = "white";
		      context.fillRect(centerPoint[0] - size[0] / 2, centerPoint[1] - size[1] + 8, size[0], size[1]);
		      context.fillStyle = "black";
		      context.fillText(label, centerPoint[0], centerPoint[1]);
		    }
	    } else {
	  		layers[i].element.style.visibility = "hidden";
	  	}
	  }

	  // Draw mouse crosshairs
	  if(showCrosshairs) {
	    context.strokeStyle = "yellow";
	    context.lineWidth = 1;
	    
	    context.beginPath();
	    
	    context.moveTo(mousePosition[0], 0);
	    context.lineTo(mousePosition[0], canvas.height);

	    context.moveTo(0, mousePosition[1]);
	    context.lineTo(canvas.width, mousePosition[1]);
	    
	    context.stroke();
	  }

	  if(showScreenBounds) {

	  	context.fillStyle = "black";
	    context.lineWidth = 4;
	  	context.fillRect(0,0,canvas.width,canvas.height);
	  	
	  	context.strokeStyle = "#909090";
	  	context.beginPath();
	  	var stepX = canvas.width / 10;
	  	var stepY = canvas.height / 10;

	  	for(var i = 0; i < 10; i++) {
	  		context.moveTo(i * stepX, 0);
	    	context.lineTo(i * stepX, canvas.height);

	    	context.moveTo(0, i * stepY);
	    	context.lineTo(canvas.width, i * stepY);
			}
	    context.stroke();
			
			context.strokeStyle = "white";
	    context.strokeRect(2, 2, canvas.width-4,canvas.height-4);

	    var fontSize = Math.round(stepY * 0.6);
	    context.font = fontSize + "px mono,sans-serif";
	    context.fillRect(stepX*2+2, stepY*3+2, canvas.width-stepX*4-4, canvas.height-stepY*6-4);
	    context.fillStyle = "white";
	    context.fontSize = 20;
	    context.fillText(canvas.width + " x " + canvas.height, canvas.width/2, canvas.height/2 + (fontSize * 0.75));
	    context.fillText('display size', canvas.width/2, canvas.height/2 - (fontSize * 0.75));
	  }
	};

	var swapLayerPoints = function(layerPoints, index1, index2){
		var tx = layerPoints[index1][0];
		var ty = layerPoints[index1][1];
		layerPoints[index1][0] = layerPoints[index2][0];
		layerPoints[index1][1] = layerPoints[index2][1];
		layerPoints[index2][0] = tx;
		layerPoints[index2][1] = ty;
	}

	var init = function(){
	  canvas = document.createElement('canvas');
	  
	  canvas.style.display = 'none';
	  canvas.style.position = 'fixed';
	  canvas.style.top = '0px';
	  canvas.style.left = '0px';
	  canvas.style.zIndex = '1000000';

	  context = canvas.getContext('2d');

	  document.body.appendChild(canvas);
	  
	  window.addEventListener('resize', resize );
	  
	  // UI events
	  window.addEventListener('mousemove', mouseMove);
	  window.addEventListener('mouseup', mouseUp);
	  window.addEventListener('mousedown', mouseDown);
	  window.addEventListener('keydown', keyDown);

	  resize();
	};

	var rotateLayer = function(layer, angle) {
		var s = Math.sin(angle);
		var c = Math.cos(angle);

		var centerPoint = [0, 0];
    for(var p = 0; p < layer.targetPoints.length; p++) {
      centerPoint[0] += layer.targetPoints[p][0];
      centerPoint[1] += layer.targetPoints[p][1];
    }

    centerPoint[0] /= 4;
    centerPoint[1] /= 4;

    for(var p = 0; p < layer.targetPoints.length; p++) {
    	var px = layer.targetPoints[p][0] - centerPoint[0];
    	var py = layer.targetPoints[p][1] - centerPoint[1];

			layer.targetPoints[p][0] = (px * c) - (py * s) + centerPoint[0];
    	layer.targetPoints[p][1] = (px * s) + (py * c) + centerPoint[1];
    }
	}

	var scaleLayer = function(layer, scale) {

		var centerPoint = [0, 0];
    for(var p = 0; p < layer.targetPoints.length; p++) {
      centerPoint[0] += layer.targetPoints[p][0];
      centerPoint[1] += layer.targetPoints[p][1];
    }

    centerPoint[0] /= 4;
    centerPoint[1] /= 4;

    for(var p = 0; p < layer.targetPoints.length; p++) {
    	var px = layer.targetPoints[p][0] - centerPoint[0];
    	var py = layer.targetPoints[p][1] - centerPoint[1];

			layer.targetPoints[p][0] = (px * scale) + centerPoint[0];
    	layer.targetPoints[p][1] = (py * scale) + centerPoint[1];
    }
	}

	var keyDown = function(event) {
	  if(!configActive){
	    if(event.keyCode == 32 && event.shiftKey){
	      setConfigEnabled(true);
	      return;
	    } else {
	      return;
	    }
	  }

	  var key = event.keyCode;

	  var increment = event.shiftKey ? 10 : 1;
	  var dirty = false;
	  var delta = [0, 0];

	  console.log(key);
	  switch(key){

	    case 32: // spacebar
	      if(event.shiftKey){
	        setConfigEnabled(false);
	        return;
	      }
	    break;

	    case 37: // left arrow
	      delta[0] -= increment;
	    break;

	    case 38: // up arrow
	      delta[1] -= increment;
	    break;

	    case 39: // right arrow
	      delta[0] += increment;
	    break;

	    case 40: // down arrow
	      delta[1] += increment;
	    break;

	    case 67: // c key, toggle crosshairs
	      showCrosshairs = !showCrosshairs;
	      dirty = true;
	    break;

	    case 83: // s key, solo/unsolo quads
	      if(!isLayerSoloed) {

	      	if(selectedLayer != null) {
		      	for(var i = 0; i < layers.length; i++){
		      		layers[i].visible = false;
		      	}
		      	selectedLayer.visible = true;
		      	dirty = true;
		      	isLayerSoloed = true;
		      }
	      } else {
	      	for(var i = 0; i < layers.length; i++){
		      		layers[i].visible = true;
		      	}
	      	isLayerSoloed = false;
	      	dirty = true;

	      }
	    break;

	    case 66: // b key, toggle projector bounds rectangle.
	    	showScreenBounds = !showScreenBounds;
	    	draw();
	    break;

	    case 72: // h key, flip horizontal.
	    	if(selectedLayer) {
	    		swapLayerPoints(selectedLayer.sourcePoints, 0, 1);
	    		swapLayerPoints(selectedLayer.sourcePoints, 3, 2);
	    		updateTransform();
	    		draw();
	    	}
	    break;

	    case 86: // v key, flip vertical.
	    	if(selectedLayer) {
	    		swapLayerPoints(selectedLayer.sourcePoints, 0, 3);
	    		swapLayerPoints(selectedLayer.sourcePoints, 1, 2);
	    		updateTransform();
	    		draw();
	    	}
	    break;

	    case 82: // r key, rotate 90 degrees.
	    	if(selectedLayer) {
	    		rotateLayer(selectedLayer, Math.PI / 2);
	    		//rotateLayer(selectedLayer, 0.002);
	    		updateTransform();
	    		draw();
	    	}
	    break;
	  }

	  // if a layer or point is selected, add the delta amounts (set above via arrow keys)
	  if(!showScreenBounds) {
		  if(selectedPoint) {
		    selectedPoint[0] += delta[0];
		    selectedPoint[1] += delta[1];
		    dirty = true;
		  } else if(selectedLayer) {
		  	if(event.altKey == true) {
					rotateLayer(selectedLayer,  delta[0] * 0.01);
		      scaleLayer(selectedLayer,  (delta[1] * -0.005) + 1.0);
		  	} else {
			    for(var i = 0; i < selectedLayer.targetPoints.length; i++){
			      selectedLayer.targetPoints[i][0] += delta[0];
			      selectedLayer.targetPoints[i][1] += delta[1];
			    }
			  }
		    dirty = true;
		  }
		}

	  // update the transform and redraw if needed
	  if(dirty){
	    updateTransform();
	    draw();
      if(autoSave){
        saveSettings();
      }
      notifyChangeListener();
	  }
	};

	var mouseMove = function(event) {
	  if(!configActive){
	    return;
	  }

	  event.preventDefault();

	  mouseDelta[0] = event.clientX - mousePosition[0];
	  mouseDelta[1] = event.clientY - mousePosition[1];

	  mousePosition[0] = event.clientX;
	  mousePosition[1] = event.clientY;

	  if(dragging) {

	    var scale = event.shiftKey ? 0.1 : 1;
	    
	    if(selectedPoint) {  
	      selectedPoint[0] += mouseDelta[0] * scale;
	      selectedPoint[1] += mouseDelta[1] * scale;
	    } else if(selectedLayer) {
	      
	      // Alt-drag to rotate and scale
	    	if(event.altKey == true){
		      rotateLayer(selectedLayer,  mouseDelta[0] * (0.01 * scale));
		      scaleLayer(selectedLayer,  (mouseDelta[1] * (-0.005 * scale)) + 1.0);
	    	} else {
		    	for(var i = 0; i < selectedLayer.targetPoints.length; i++){
		        selectedLayer.targetPoints[i][0] += mouseDelta[0] * scale;
		        selectedLayer.targetPoints[i][1] += mouseDelta[1] * scale;
		      }	
	    	}
	    }

	    updateTransform();
      if(autoSave){
        saveSettings();
      }
	    draw();
      notifyChangeListener();

	  } else {
	    var dirty = false;

	    canvas.style.cursor = 'default';
	    var mouseX = event.clientX;
	    var mouseY = event.clientY;
	    
	    var previousState = (hoveringPoint != null);
	    var previousLayer = (hoveringLayer != null);

	    hoveringPoint = null;

	    for(var i = 0; i < layers.length; i++) {
	      var layer = layers[i];
	      if(layer.visible){
		      for(var p = 0; p < layer.targetPoints.length; p++) {
		        var point = layer.targetPoints[p];
		        if(distanceTo(point[0], point[1], mouseX, mouseY) < selectionRadius) {
		          canvas.style.cursor = 'pointer';
		          hoveringPoint = point;
		          break;
		        }
		      }
	    	}
	    }

	    hoveringLayer = null;
	    for(var i = 0; i < layers.length; i++) {
	      if(layers[i].visible && pointInLayer(mousePosition, layers[i])){
	        hoveringLayer = layers[i];
	        break;
	      }
	    }

	    if( showCrosshairs || 
	        (previousState != (hoveringPoint != null)) || 
	        (previousLayer != (hoveringLayer != null))
	      ) {
	      draw();
	    }
	  }
	};

	var mouseUp = function(event) {
	  if(!configActive){
	    return;
	  }
	  event.preventDefault();
	  
	  dragging = false;
	};

	var mouseDown = function(event) {
	  if(!configActive || showScreenBounds) {
	    return;
	  }
	  event.preventDefault();

	  hoveringPoint = null;
	  
	  if(hoveringLayer){
	    selectedLayer = hoveringLayer;
	    dragging = true;
	  } else {
	    selectedLayer = null;
	  }

	  selectedPoint = null;

	  var mouseX = event.clientX;
	  var mouseY = event.clientY;

	  mouseDownPoint[0] = mouseX;
	  mouseDownPoint[1] = mouseY;

	  for(var i = 0; i < layers.length; i++) {
	    var layer = layers[i];
	    for(var p = 0; p < layer.targetPoints.length; p++){
	      var point = layer.targetPoints[p];
	      if(distanceTo(point[0], point[1], mouseX, mouseY) < selectionRadius) {
	        selectedLayer = layer;
	        selectedPoint = point;
	        dragging = true;
	        dragOffset[0] = event.clientX - point[0];
	        dragOffset[1] = event.clientY - point[1];
	        //draw();
	        break;
	      }
	    }
	  }
	  draw();
	  return false;
	};

	var addLayer = function(target, targetPoints) {

	  var element;

	  if(typeof(target) == 'string') {
	    element = document.getElementById(target);
	    if(!element) {
	      throw("Maptastic: No element found with id: " + target);
	    }
	  } else if (target instanceof HTMLElement) {
	    element = target;
	  }

    var exists = false;
    for(var n = 0; n < layers.length; n++){
      if(layers[n].element.id == element.id) {
        layers[n].targetPoints = clonePoints(layout[i].targetPoints)
        exists = true;
      }
    }

	  var offsetX = element.offsetLeft;
	  var offsetY = element.offsetTop;

	  element.style.position = 'fixed';
	  element.style.display = 'block';
	  element.style.top = '0px';
	  element.style.left = '0px';
	  element.style.padding = '0px';
	  element.style.margin = '0px';

	  var layer = {
	  	'visible' : true,
	    'element' : element,
	    'width' : element.clientWidth,
	    'height' : element.clientHeight,
	    'sourcePoints' : [],
	    'targetPoints' : []
	  };
	  layer.sourcePoints.push( [0, 0], [layer.width, 0], [layer.width, layer.height], [0, layer.height]);
	  
	  if(targetPoints) {
	    layer.targetPoints = clonePoints(targetPoints);
	  } else {
	    layer.targetPoints.push( [0, 0], [layer.width, 0], [layer.width, layer.height], [0, layer.height]);  
	    for(var i = 0; i < layer.targetPoints.length; i++){
	      layer.targetPoints[i][0] += offsetX;
	      layer.targetPoints[i][1] += offsetY;
	    }
	  }
	  
	  layers.push(layer);

	  updateTransform();
	};

  var saveSettings = function() {
    localStorage.setItem(localStorageKey, JSON.stringify(getLayout(layers)));
  };

  var loadSettings = function() {
    if(localStorage.getItem(localStorageKey)){
      var data = JSON.parse(localStorage.getItem(localStorageKey));
      
      for(var i = 0; i < data.length; i++) {
        for(var n = 0; n < layers.length; n++){
          if(layers[n].element.id == data[i].id) {
            layers[n].targetPoints = clonePoints(data[i].targetPoints);
            layers[n].sourcePoints = clonePoints(data[i].sourcePoints);
          }
        }
      }
      updateTransform();
    }
  }

	var updateTransform = function() {
	  var transform = ["", "-webkit-", "-moz-", "-ms-", "-o-"].reduce(function(p, v) { return v + "transform" in document.body.style ? v : p; }) + "transform";
	  for(var l = 0; l < layers.length; l++){

	    for (var a = [], b = [], i = 0, n = layers[l].sourcePoints.length; i < n; ++i) {
	      var s = layers[l].sourcePoints[i], t = layers[l].targetPoints[i];
	      a.push([s[0], s[1], 1, 0, 0, 0, -s[0] * t[0], -s[1] * t[0]]), b.push(t[0]);
	      a.push([0, 0, 0, s[0], s[1], 1, -s[0] * t[1], -s[1] * t[1]]), b.push(t[1]); 
	    }

	    var X = solve(a, b, true);
	    var matrix = [
	      X[0], X[3], 0, X[6],
	      X[1], X[4], 0, X[7],
	        0,    0,  1,   0,
	      X[2], X[5], 0,   1
	    ];

	    layers[l].element.style[transform] = "matrix3d(" + matrix.join(',') + ")";
	    layers[l].element.style[transform + "-origin"] = "0px 0px 0px";
	  }
	}

	var setConfigEnabled = function(enabled){
	  configActive = enabled;
	  canvas.style.display = enabled ? 'block' : 'none';

	  if(!enabled) {
	    selectedPoint = null;
	    selectedLayer = null;
	    dragging = false;
	    showScreenBounds = false;
	  } else {
	    draw();
	  }
	};

	var clonePoints = function(points){
	  var clone = [];
	  for(var p = 0; p < points.length; p++){
	    clone.push( points[p].slice(0,2) );
	  }
	  return clone;
	};

	var resize = function() {
	  viewWidth = window.innerWidth;
	  viewHeight = window.innerHeight;
	  canvas.width = window.innerWidth;
	  canvas.height = window.innerHeight;

	  draw();
	};

  var getLayout = function() {
    var layout = [];
    for(var i = 0; i < layers.length; i++) {
      layout.push({
        'id': layers[i].element.id,
        'targetPoints': clonePoints(layers[i].targetPoints),
        'sourcePoints': clonePoints(layers[i].sourcePoints)
      });
    }
    return layout;
  }

  var setLayout = function(layout){
    for(var i = 0; i < layout.length; i++) {
      var exists = false;
      for(var n = 0; n < layers.length; n++){
        if(layers[n].element.id == layout[i].id) {
          console.log("Setting points.");
          layers[n].targetPoints = clonePoints(layout[i].targetPoints);
          layers[n].sourcePoints = clonePoints(layout[i].sourcePoints);
          exists = true;
        }
      }

      if(!exists) {
        var element = document.getElementById(layout[i].id);
        if(element) {
          addLayer(element, layout[i].targetPoints);
        } else {
          console.log("Maptastic: Can't find element: " + layout[i].id);
        }
      } else {
        console.log("Maptastic: Element '" + layout[i].id + "' is already mapped.");
      }
    }
    updateTransform();
    draw();
  }

  init();

  // if the config was just an element or string, interpret it as a layer to add.

  for(var i = 0; i < layerList.length; i++){
    if((layerList[i] instanceof HTMLElement) || (typeof(layerList[i]) === 'string')) {
      addLayer(layerList[i]);
    }
  }

  for(var i = 0; i < arguments.length; i++){
    if((arguments[i] instanceof HTMLElement) || (typeof(arguments[i]) === 'string')) {
      addLayer(arguments[i]);
    }
  }

  if(autoLoad){
    loadSettings();
  }

  return {
  	'getLayout' : function() {
		  return getLayout();
		},
		'setLayout' : function(layout) {
			setLayout(layout);
		},
		'setConfigEnabled' : function(enabled){
			setConfigEnabled(enabled);
		},
		'addLayer' : function(target, targetPoints){
			addLayer(target, targetPoints);
		}
  }
};