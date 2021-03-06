!function(name, module, context){
	//>>excludeStart("moduleTmpl", pragmas.moduleTmpl);
	if(typeof window.define !== 'undefined' && 'amd' in define)
		define([!('jQuery' in window)? 'echoQuery' : 'jQuery'], module)
	else
	//>>excludeEnd("moduleTmpl");
		module($)
}('Echo', function($){
	$ = $ || window.jQuery
	// Private
	var _slice = Array.prototype.slice
	


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	/*	
	pub/sub plugin
	*/	
	window._subscache = {}
	var _publish = function(/* String */topic, /* Array */args){
		if(_subscache[topic])
			$.each(_subscache[topic], function(subscription){
				subscription.apply(this, args || []);
			});
	};
	
	var _subscribe = function(/* String */topic, /* Function */callback){
		if(!_subscache[topic]){
			_subscache[topic] = [];
		}
		_subscache[topic].push(callback);
		return [topic, callback]; // Array
	};
	
	var _unsubscribe = function(/* Array */topic, /*Function*/callback){
		if(!cache[topic]) return
		if(!callback) {
			_subscache[topic] = null
			delete _subscache[topic]
			return true
		} else {
			$.each(_subscache[topic], function(idx, val){
				if(callback === val){
					_subscache[topic].splice(idx, 1);
				}
			});
			return true
		}
	};
	
	
	
	
	
	
	
	// ~~~~~~~~~~~~~ Echo core ~~~~~~~~~~~~~~~~~~~~~
	var _ecAttr = 'data-echo-bind'
	var _ecSel = '[' + _ecAttr + ']'
	var _ecKey = '__ec__'
	var _ecItemTagId = 'ec_item_id'
	var _ecDataId = 'data-echo-id'
	var _ecDataIdSel = '[' + _ecDataId + ']'
	var _ecObsVal = '__ecVal__'
	var _ecTmplNode = '__ecTpl__'
	var _regex = {
		each : /foreach\s*:/
	}
	window._modelDb = {}
	var _moduleDb = {}
	var _docIsReady = false
	var _echoProps = ['template', 'foreach', 'if', 'update', 'init', 'bornready', 'value', 'text']
	var _domProps = ['click', 'submit', 'blur', 'mouseover', 'mouseout']
	
	function _isTemplateNode(node){
		return node.hasAttribute(_ecAttr) && _regex.each.test(node.getAttribute(_ecAttr))
	}
	function _isEchoNode(node){
		return node.hasAttribute(_ecAttr)
	}
	function _isDomNode(obj){
		return 'nodeName' in obj
	}
	
	function _setModelEchoProperties(obj, val){
		if('defineProperty' in Object){
			Object.defineProperty(obj, _ecKey, {
				enumerable: false,
				writable: false,
				value : {}
			})
			Object.defineProperties(obj[_ecKey], {
				"id" : {
					value : val.id,
					writable : false
				},
				"sels" : {
					value : val.sels,
					writable : false
				}
			})
		}
		else
			obj[_ecKey] = val
		return obj
	}
	
	function _getDeps(/* Array*/ deps){
		return deps.map(function(depName){
			return _moduleDb[depName]
		})
	}
	
	function _getModelId(item){
		return _ecKey in item? item[_ecKey].id : null
	}
	
	function _getModel(item){
		return _modelDb[_getModelId(item)]	
	}
	
	function _getModelListeners(modelInst){
		return modelInst[_ecKey].sels
	}
	
	function _updateSubscribeTemplate(){
		var args = _slice.call(arguments),
			observableObj = args[args.length - 1],  // Array or Object that was converted to an observable
			modelInst = _getModel(observableObj) // get active instance of the model
		$(_getModelListeners(modelInst)).each(function(){
			var modelId = _getModelId(observableObj)
			$(_ecDataIdSel, this).each(function(){
				if(this.getAttribute(_ecDataId).indexOf(modelId) > -1)
					$(this).trigger('Echo:update', args)
			})
		})
		
	}
	
	function _applyMakeup(modelInst, sels){
		//TODO check type of modelInst
		var np = (modelInst.constructor && ('__' + modelInst.constructor.name) || '__Echo') + '_' + new Date().getTime()
		if(!_modelDb[np]) { //e.g _modelDb.TodoList
			_modelDb[np] = []
			_subscribe(np + ':update', _updateSubscribeTemplate)
		}
		
		_modelDb[np] = _setModelEchoProperties(modelInst, {id : np, sels : sels})
		
		for(var prop in modelInst){
			if(modelInst[prop] instanceof _EchoArray)
				_setModelEchoProperties(modelInst[prop], {id : np})
		}
		
		return modelInst
	}
	
	function _parse(str){
		var attrObj = {}
		$.each(str.split(','), function(keyVal){
			var pair = keyVal.split(':')
			attrObj[pair[0].trim()] = pair[1].trim()
		})
		return attrObj
	}
	
	function _getEchoAttrs(node){
		var nodeAttrs = node.getAttribute(_ecAttr)
		var bindAttrs = {}
		if(nodeAttrs)
			try { 
				bindAttrs = new Function('return { ' + nodeAttrs + '}')() 
			} catch(e){
				bindAttrs = _parse(nodeAttrs)
			}
		return bindAttrs
	}
	
	
	function _getEchoEventData(e){
		var data = e.data
	 	return {
	 		type : data[0],
	 		item : data[1],
	 		itemIdx : data[2],
	 		itemParent : data[data.length - 1]
	 	}
	}
	
	
	
	
	
	
	
	
	// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	function _getTemplateFrag(template, item, itemIdx, itemParent){
		var $frag = $('<div />'), fragDiv = $frag[0]
		var tag = itemIdx
		
		if($.isPlainObject(item) && !$.isEchoArray(item)) { item = [item] }
		
		$.each(item, function(val, i){
			var div = document.createElement('div')
			div.innerHTML = template
			$(_ecSel, div).each(function(){
				var tmplNode = this
				var echoAttrs = _getEchoAttrs(tmplNode)
				if(echoAttrs.text in val){
					if('if' in echoAttrs && echoAttrs['if'] in val || 1)
						tmplNode.innerText = val[echoAttrs.text]
				}
			})
			$(div.children).each(function(){
				$(this).data(_ecItemTagId, tag && tag++ || i)
				fragDiv.appendChild(this)
			})
		})
		return fragDiv
	}
	
	
	// called on the node which is listening to "Echo:update" or "<Model>:update" events
	function _viewUpdateTemplateEchoEvent(e){
	 	var s = _getEchoEventData(e)
	 	var tmpl = $(this).data('template')
	 	if(s.item){
	 		Echo.append(this, Echo.getTemplateNodes(tmpl, s.item, s.itemIdx, s.itemParent), function(node, idxItem, parentItem){
	 			_traverseChildrenAndBind(node, _bindEventsEcho, _getModel(parentItem) || parentItem, Echo)
	 		}, s.itemIdx, s.itemParent)
	 	} else {
	 		var parentNode = this
	 		$('nodeType' in s.itemIdx? s.itemIdx : $(parentNode).children()[s.itemIdx]).remove()
	 	}
	 }
	 
	 
	 //TODO refactor
	 // called on the node which is listening to "Echo:update" or "<Model>:update" events
	function _viewValueDOMEchoEvent(e){
		var s = _getEchoEventData(e)
	 	var eattr = _getEchoAttrs(this)
	 	var $parent = _getModel(s.itemParent)
	 	var $data = s.item
	 	this.value = _getActualValueFromObject(eattr.value, $data, $parent)
	}
	function _viewUpdateDOMEchoEvent(e){
		var s = _getEchoEventData(e)
	 	var eattr = _getEchoAttrs(this)
	 	var $parent = _getModel(s.itemParent)
	 	var $data = s.item
	 	this['inner' + ('innerText' in this? 'Text' : 'HTML')] = _getActualValueFromObject(eattr.text, $data, $parent)
	}
	//TODO refactor
	
	
	
	
	
	
	// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	function _traverseChildrenAndBind(node, fn, data, context){
		if(_isEchoNode(node))
			fn.call(context, node, data)
		
		if(!_isTemplateNode(node)){
			return $(node).children().each(function(){
				_traverseChildrenAndBind(this, fn, data, context)
			})
		}
	}
	
	function _getBoundAttrValue(value, context){
		var res;
		if($.isFunction(value))
			res = $.proxy(value, context)
		else if(typeof value === 'string' && $.isFunction(context[value]))
			res = $.proxy(context[value], context)
		else res = value in context? context[value] : value
		return res
	}
	
	function _getActualValueFromObject(echoAttrVal, $data, $parent){
		if($.isPlainObject(echoAttrVal) && ('get' in echoAttrVal)) echoAttrVal = echoAttrVal.get()
		var res
		try{
			res = new Function('$data', '$parent', 'return ' + echoAttrVal)($data, $parent)
		} catch(e){
			res = echoAttrVal
		}
	 	return res
	}
	
	function _isInsideATemplate(node){
		var $parent = $(node).closest(_ecSel), parent = $parent[0], nodeIsInATemplate = false
		while($parent.length > 0){
			if(_ecTmplNode in parent || _regex.each.test($parent[0].getAttribute(_ecAttr))) { nodeIsInATemplate = true; parent[_ecTmplNode] = true; break; }
			$parent = $parent.closest(_ecSel)
		}
		return nodeIsInATemplate
	}
	
	
	/**
	 * Iterates over the 'foreach' dom node
	 * @param prop - foreach property to iterate over
	 * @param objToIterate - object to iterate over
	 * @param node - DOM node containing the template
	 */
	function _templateIteratorEcho(node, objToIterate, modelObj){
		var template = node.innerHTML.trim(), $node = $(node)
		if($.isEchoArray(objToIterate)){
			node.innerHTML = ''
			Echo.append(node, Echo.getTemplateNodes(template, objToIterate))
		}
		 $node.on('Echo:update', _viewUpdateTemplateEchoEvent).data('template', template)
	}
	
	function _bindDomEventsEcho(node, echoAttrs, context){
		//console.log('binding dom event', node, key, value)
		$.each(echoAttrs, function(value, key){
			if(_domProps.indexOf(key) > -1){
				value = _getBoundAttrValue(value, context) // gets the proxied function
				if(key === 'submit') //TODO check why this is required and why 'on' method is not working
					node.onsubmit = function(e){
						e.preventDefault()
						var res = value(this)
						//console.log(res, this)
						return res
					}
				else 
					$(node).on(key, function(e){
						var res = value(e.target, e.currentTarget, e)
						return res || e.preventDefault()
					})
			}
		})
	}
	
	
	function _updateDOMOnInitEcho(type, node, echoAttrVal, context){
	 	var $parent = _getModel(context)
	 	var $data = context
	 	var res
		switch(type){
			case 'value':
				if(res = _getActualValueFromObject(echoAttrVal, $data, $parent)) node.value = res
				break;
			case 'text':
			 	if(res = _getActualValueFromObject(echoAttrVal, $data, $parent)) node.innerHTML = res
			 	break;
			 default:
			 	break;
		}
	}
	
	function _tagNodeOn(node){
		var tmp = node.getAttribute(_ecDataId) || ''
		node.setAttribute(_ecDataId, tmp + (tmp.length > 0? '|' : '') + _getModelId(this))
	}
	
	function _subscribeEventsEcho(node, echoAttrs, context){
		var self = Echo, templateReady = 'foreach' in echoAttrs? false : true
		var $data = context
		$.each(echoAttrs, function(value, key){
			value = _getBoundAttrValue(value, context)
			if(_echoProps.indexOf(key) > -1){
				switch(key){
					case 'text':
						if(!_isInsideATemplate(node)){
							_tagNodeOn.call($data, node)
							_updateDOMOnInitEcho('text', node, value, $data)
							$(node).on('Echo:update', _viewUpdateDOMEchoEvent)
						}
						break;
					case 'value':
						if(!_isInsideATemplate(node)){
							_tagNodeOn.call($data, node)
							_updateDOMOnInitEcho('value', node, value, $data)
							$(node).on('Echo:update', _viewValueDOMEchoEvent)
						}
						break;
					case 'update' :
						break;
					case 'bornReady' : break;
					case 'init' :
						if(templateReady && _docIsReady)
							value(node) 
						break;
					case 'foreach' :
						_tagNodeOn.call($data, node)
						node[_ecTmplNode] = true
						_templateIteratorEcho(node, value, context)
						_bindEventsEcho($(_ecSel, node), context)
						templateReady = true
						if('init' in echoAttrs) context[echoAttrs.init].call(context, node)
						break;
					default: break;
				}
			}
		})
	}
	
	/**
	 * @desc This loops through all 'data-echo-bind' nodes and captures and applies corresponding bindings on the echo observable object 
	 */
	function _bindEventsEcho(nodeToBind, modelObj){
		var self = Echo, nodes = _isDomNode(nodeToBind)? [nodeToBind] : _slice.call(nodeToBind), $data = modelObj
		$.each(nodes, function(node, i){
			// get all 'data-echo-bind' attributes on this node and capture and apply corresponding bindings in echo observable object
			var echoAttrs = _getEchoAttrs(node)
			_bindDomEventsEcho(node, echoAttrs, $data)
			_subscribeEventsEcho(node, echoAttrs, $data)
		})
	}
	
	



	
	
	
	
	
	
	// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	var _EchoArray = function(array, context){
		return new _EchoArray.prototype.init(array, context)
	}
	_EchoArray.prototype = {
		constructor : _EchoArray,
		
		init : function(/* Array or Object */array, /* Object or Function*/context){
			for(var i = 0, l = array.length; i < l && (this[i] = array[i]); i++){}
			this.length = l
			//this.__context = context
		},
		
		push : function(item){
			var idx = Array.prototype.push.call(this, item)
			_publish(_getModelId(this) + ':update', ['push', item, idx - 1, this])
			return this
		},
		
		pop : function(){
			var popped = Array.prototype.pop.call(this)
			_publish(_getModelId(this) + ':update', ['pop', null, this.length, this])
			return this
		},
		
		remove : function(domItem){
			var idx = parseInt(_isDomNode(domItem)? $(domItem).data(_ecItemTagId) : domItem)
			Array.prototype.splice.call(this, idx, 1)
			_publish(_getModelId(this) + ':update', ['remove', null, domItem, this])
			return this
		},
		
		concat : function(items){
			var arr = this, oldLen = this.length
			$.each(items, function(item){
				arr[arr.length] = item
				arr.length++
			})
			_publish(_getModelId(this) + ':update', ['concat', items, oldLen, this])
			return this
		},
		
		
		forEach : Array.prototype.forEach
	}
	_EchoArray.prototype.init.prototype = _EchoArray.prototype;
	$.isEchoArray = function(arr){
		return arr instanceof _EchoArray
	}
	
	
	
	
	
	
	
	
	// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	window.Echo = {
		
		define : function(name, module, context){
			var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m  // thanks Angularjs
			var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg //TODO add later
			var moduleString = module.toString()
			var args = moduleString.match(FN_ARGS)[1].split(',')
			
			if(!_moduleDb[name]) _moduleDb[name] = module
			return module.apply(context || module, _getDeps(args))
		},
		
		observableArray : function(array, context){
			return _EchoArray(array, context || Echo.observableArray.caller)
		},
		
		observable : function(val){
			var ret = {
				get : function(){
					return this[_ecObsVal]
				},
				set: function(v){
					this[_ecObsVal] = v
					_publish(_getModelId(this) + ':update', ['set', v, null, this])
				}
			}
			ret[_ecObsVal] = val
			return ret
		},
		
		append : function(parentNode, childNodes, callback){
			var self = this, options = _slice.call(arguments, 3)
			while(childNodes.length !== 0){
				parentNode.appendChild(childNodes[0])
				callback && callback.apply(self, [parentNode.lastElementChild].concat(options))
			}
			return this
		},
		
		// TODO data is only arrays for now. Should be done for objects also
		getHtml : function(){
			return _getTemplateFrag.apply(this, arguments).innerHTML
		},
		
		getTemplateNodes : function(){
			return _getTemplateFrag.apply(this, arguments).children
		},
		
		subscribables : _subscribeEventsEcho,
		
		bindDomEvent : _bindDomEventsEcho,
		
		bind : function(/* Object */modelObj, /* String */sels){
			// variables
			var self = this

			modelObj = _applyMakeup(modelObj || {}, sels) // tag the object as an echo observable
			
			var $modelNodes = $(sels || document); // get nodes which will listen to changes to the echo observable
			$modelNodes.each(function(){
				_traverseChildrenAndBind(this, _bindEventsEcho, modelObj, self)
			})
		} // bind ends
	}
	
	document.onreadystatechange = function(){
		if (document.readyState === 'interactive') {
			_docIsReady = true
		}
	}
	
	return Echo;
}, this)
