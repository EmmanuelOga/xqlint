exports.StaticContext = function (parent, pos) {
    'use strict';

    var Errors = require('./errors');
    var StaticError = Errors.StaticError;
    var StaticWarning = Errors.StaticWarning;
    
    var emptyPos = { sl:0, sc: 0, el: 0, ec: 0 };
    var namespaces = {};
    
    var getVarKey = function(qname) {
        return qname.uri + '#' + qname.name;
    };

    if(!parent) {
        namespaces['http://jsoniq.org/functions'] = {
            prefix: 'jn',
            pos: emptyPos,
            type: 'module',
            override: true
        };
        namespaces['http://www.w3.org/2005/xpath-functions'] = {
            prefix: 'fn',
            pos: emptyPos,
            type: 'module',
            override: true
        };
        namespaces['http://www.w3.org/2005/xquery-local-functions'] = {
            prefix: 'local',
            pos: emptyPos,
            type: 'declare',
            override: true
        };
        namespaces['http://www.w3.org/2001/XMLSchema-instance'] = {
            prefix: 'xsi',
            pos: emptyPos,
            type: 'declare'
        };
        namespaces['http://www.w3.org/2001/XMLSchema'] = {
            prefix: 'xs',
            pos: emptyPos,
            type: 'declare'
        };
        namespaces['http://www.w3.org/XML/1998/namespace'] = {
            prefix: 'xml',
            pos: emptyPos,
            type: 'declare'
        };
    }

    return {
        parent: parent,
        pos: pos,

        defaultFunctionNamespace: '',
        defaultElementNamespace: '',
        namespaces: namespaces,
        addNamespace: function (uri, prefix, pos, type) {
            if(prefix === '' && type === 'module') {
                throw new StaticWarning('Avoid this type of import. Use import module namespace instead');
            }
            //Check for empty target namespace
            if (uri === '') {
                throw new StaticError('XQST0088', 'empty target namespace in module import or module declaration', pos);
            }

            //Check for duplicate target namespace
            var namespace = this.getNamespace(uri);
            if (namespace && namespace.type === type && type !== 'declare' && !namespace.override) {
                throw new StaticError('XQST0047', '"' + uri + '": duplicate target namespace', pos);
            } else if (namespace && (namespace.type === 'declare' || type === 'declare')) {
                throw new StaticWarning('"' + namespace.uri + '" already bound to the "' + namespace.prefix + '" prefix', pos);
            }

            //Check for duplicate prefix
            namespace = this.getNamespaceByPrefix(prefix);
            if (namespace && !namespace.override) {
                throw new StaticError('XQST0033', '"' + prefix + '": namespace prefix already bound to "' + namespace.uri + '"', pos);
            }

            this.namespaces[uri] = {
                prefix: prefix,
                pos: pos,
                type: type
            };

        },
        getNamespace: function (uri) {
            var that = this;
            while (that) {
                var namespace = that.namespaces[uri];
                if (namespace) {
                    return namespace;
                }
                that = that.parent;
            }

        },

        getNamespaceByPrefix: function (prefix) {
            var handler = function (uri) {
                var namespace = that.namespaces[uri];
                if (namespace.prefix === prefix) {
                    namespace.uri = uri;
                    throw namespace;
                }
            };
            var that = this;
            while (that) {
                try {
                    Object.keys(that.namespaces).forEach(handler);
                } catch (e) {
                    return e;
                }
                that = that.parent;
            }

        },
        
        resolveQName: function(value, pos){
            var qname = {
                uri: '',
                prefix: '',
                name: ''
            };
            var idx;
            if (value.substring(0, 2) === 'Q{') {
                idx = value.indexOf('}');
                qname.uri = value.substring(2, idx);
                qname.name = value.substring(idx + 1);
            } else {
                idx = value.indexOf(':');
                qname.prefix = value.substring(0, idx);
                var namespace = this.getNamespaceByPrefix(qname.prefix);
                if(!namespace && qname.prefix !== '') {
                    throw new StaticError('XPST0081', '"' + qname.prefix + '": can not expand prefix of lexical QName to namespace URI', pos);
                }
                if(namespace) {
                    qname.uri = namespace.uri;
                }
                qname.name = value.substring(idx + 1);
            }
            return qname;
        },
        
        variables: {},
    
        addVariable: function(qname, type, pos){
            var key = getVarKey(qname);
            if(type === 'VarDecl' && this.variables[key]) {
                throw new StaticError('XQST0049', '"' + qname.name + '": duplicate variable declaration', pos);
            }
            this.variables[key] = {
                type: type,
                pos: pos
            };
            return this;
        },
        
        getVariable: function(qname) {
            var key = getVarKey(qname);
            var that = this;
            while(that) {
                if(that.variables[key]) {
                    return that.variables[key];
                }
                that = that.parent;
            }
        },
        
        addVarRef: function(qname, pos){
            var varDecl = this.getVariable(qname);
            if(!varDecl) {
                throw new StaticError('XPST0008', '"' + qname.name + '": undeclared variable', pos);
            }
        }
        
        
    };
};