
var Maptastic = function(config) {

  var getProp = function(cfg, key, defaultVal){
    if(cfg && cfg.hasOwnProperty(key)){
      return cfg[key];
    } else {
      return defaultVal;
    }
  }

  var showLayerNames  = getProp(config, 'showLayerNames', true);
  var showCrosshairs  = getProp(config, 'crosshairs', false);
  var autoSave        = getProp(config, 'autoSave', true);
  var layerList       = getProp(config, 'layers', []);
  var layoutChangeListener = getProp(config, 'onchange', function(){} );
  var localStorageKey = 'maptastic.layers';

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

  var mousePosition = [];
  var mouseDelta = [];


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
	  }

	  // Draw mouse crosshairs
	  if(showCrosshairs) {
	    context.strokeStyle = "yellow";
	    context.lineWidth = "1px";
	    
	    context.beginPath();
	    
	    context.moveTo(mousePosition[0], 0);
	    context.lineTo(mousePosition[0], canvas.height);

	    context.moveTo(0, mousePosition[1]);
	    context.lineTo(canvas.width, mousePosition[1]);
	    
	    context.stroke();
	  }
	};

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

	     case 83: // s key, manually stop dragging (fix annoying trackpad behavior when fine-tuning)
	      dragging = false;
	      dirty = true;
	    break;
	  }

	  // if a layer or point is selected, add the delta amounts (set above via arrow keys)
	  if(selectedPoint) {
	    selectedPoint[0] += delta[0];
	    selectedPoint[1] += delta[1];
	    dirty = true;
	  } else if(selectedLayer) {
	    for(var i = 0; i < selectedLayer.targetPoints.length; i++){
	      selectedLayer.targetPoints[i][0] += delta[0];
	      selectedLayer.targetPoints[i][1] += delta[1];
	    }
	    dirty = true;
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
	      for(var i = 0; i < selectedLayer.targetPoints.length; i++){
	        selectedLayer.targetPoints[i][0] += mouseDelta[0] * scale;
	        selectedLayer.targetPoints[i][1] += mouseDelta[1] * scale;
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

	      for(var p = 0; p < layer.targetPoints.length; p++) {
	        var point = layer.targetPoints[p];
	        if(distanceTo(point[0], point[1], mouseX, mouseY) < selectionRadius) {
	          canvas.style.cursor = 'pointer';
	          hoveringPoint = point;
	          break;
	        }
	      }
	    }

	    hoveringLayer = null;
	    for(var i = 0; i < layers.length; i++) {
	      if(pointInLayer(mousePosition, layers[i])){
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
	  if(!configActive){
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

	  element.style.position = 'absolute';
	  element.style.display = 'block';
	  element.style.top = '0px';
	  element.style.left = '0px';
	  element.style.padding = '0px';
	  element.style.margin = '0px';

	  var layer = {
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
        'targetPoints': clonePoints(layers[i].targetPoints)
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
		},
    'saveLayout' : function(){
      saveSettings();
    },
    'loadLayout' : function(){
      loadSettings();
    }
  }
};