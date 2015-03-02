/*
* jQuery VPKR Plugin v0.1
* Searchable, filterable, styleable tree tables. 
* Licensed under the MIT license.
* Copyright 2011, James Zetlen 
*
* Based on:
* jQuery treeTable Plugin 2.3.0
* http://ludo.cubicphuse.nl/jquery-plugins/treeTable/
*
* Copyright 2010, Ludo van den Boom
* Dual licensed under the MIT or GPL Version 2 licenses.
*/
(function ($) {

    var vpkrGUID = 0, // counter for multiple vpkrs on a page
        vpkrEvent = null,

		regexRegex = /[.*+?|()\\[\\]{}\\\\]/g,
		actionLabelRegex = /[^a-z]/g,
		
		getPaddingLeft = function ($obj) {
            var paddingLeft = parseInt($obj.css('padding-left'), 10);
            return (isNaN(paddingLeft)) ? this.options.indent : paddingLeft;
        };

    $.widget('ui.vpkr', {

        options: {
            actions: {},
            tree: false,
            expandable: false,
            clickToExpand: false,
            checkable: false,
            data: null,
            dataMap: {
                id: 'id',
                name: "name",
                parentId: "parentId"
            },
            paginate: false,
            paginatePageSize: 200,
            paginateForwardText: "More...",
            paginateBackwardText: "Previous...",
			searchBox: true,
            searchDelay: 100,
            searchMinChars: 1,
            searchText: "Search...",
            childPrefix: "child-of-",
            indent: 20,
            initialState: "collapsed",
            wrap: true,
            width: 500,
            height: 200
        },

        // private object methods

        _create: function () {

            var vpkr = this,
				elm = this.element;

            this._prefix = 'vpkr' + (vpkrGUID++) + '-node-'; // unique value

            this._cpRegex = new RegExp(this.options.childPrefix + '(\\S+)'); // extract parent ID

			this._items = [];
			
			// add the class to, and style, the table
            this.$table = elm.addClass('vpkr-table').attr({ 'border': 0, 'cellpadding': 0, 'cellspacing': 0 });
			
			 // add an expandable class, which is required for CSS
	        this.options.expandable && elm.addClass('expandable');
            
			// create and append the containers
			elm.wrap('<div class="vpkr-container"><div class="vpkr-table-container"></div></div>');
			this.$tablecontainer = elm.parent();
			this.$container = this.$tablecontainer.parent();
			
			// set dimensions
            this.$container.css('width', this.options.width);
            this.$tablecontainer.css('height', this.options.height);

			// if no name is set, set a name for form building
            this.options.name = this.options.name || this._prefix;
			
			// add search box
			if (this.options.searchBox) {
				this.$searchBox = $('<div id="' + this._prefix + 'search-box" class="vpkr-search-box ui-corner-top"><label for="' + this._prefix + 'search-input">Search</label><span class="ui-icon ui-icon-search vpkr-search-icon"></span>').prependTo(this.$container);
				this.$searchInput = $('<input type="text" value="' + this.options.searchText + '" id="' + this._prefix + 'search-input" />').appendTo(this.$searchBox);
				this.$showAllButton = $('<span class="vpkr-show-all" id="' + this._prefix + 'show-all"><span class="ui-icon ui-icon-circle-close">&nbsp;</span></span>').appendTo(this.$searchBox);
				this.$searchInput.css('width', this.options.width - parseInt(this.$searchInput.css('padding-left')) + parseInt(this.$searchInput.css('padding-right')) - 2);
			}

            // pagination constants
            if (this.options.paginate) {
                this.options.paginatePageSize -= this.options.paginatePageSize % 2; // this number must be even
                this._paginationOffset = 0;
            }
			
			
			// tree expander
			// save the HTML of the expander, since we'll use it once instead of the jqobj
			this._expander = '<td class="expander-row"><span class="expander"><span class="ui-icon ui-icon-triangle-1-e vpkr-closearrow"></span><span class="ui-icon ui-icon-triangle-1-s vpkr-openarrow"></span></span></td>';
			if (this.options.tree && !this.options.data) {
				// store a jqobj of the expander, since we'll append it via jquery
	            this.$expander = $(this._expander);
			}

            // now to populate!
            if ($.isArray(this.options.data)) {
                // data has been argued directly into the function, yay
                this._populate(this.options.data);

            } else if ($.isPlainObject(this.options.data) && this.options.data.populate) {
                // a callback is being argued, so run the callback and then populate.
                vpkr.$container.addClass('vpkr-loading');
                this.options.data.populate(function (data) { vpkr._populate(data); vpkr.$container.removeClass('vpkr-loading'); }, this.options.paginatePageSize, this._paginationOffset);

            } else {
                // Populate inline. If there are no contents, then there is a search.
                this._populate();

            }

            return this.element

        },

        _createPaginators: function () {

            var vpkr = this,
                atBeginning = vpkr._paginationOffset === 0,
                atEnd = vpkr._items.length < vpkr.options.paginatePageSize, // should only happen if the service returns fewer records than were requested
                paginationString = vpkr.searchTerm ? '' : "Showing " + (vpkr._paginationOffset + 1) + " - " +
                                   (vpkr._items.length + vpkr._paginationOffset) +
                                   (vpkr.options.totalCount ? " of " + vpkr.options.totalCount : ""); // if there's a total count, display it!

            function page(e, dir) {

                var targetPaginator = $(e.target).closest('.vpkr-paginator'),
                    lastRecord = vpkr.$table.find('tr:last')[0].id, // for scrolling later
                    firstRecord = vpkr.$table.find('tr:first')[0].id, // for scrolling later
                    count = vpkr.options.paginatePageSize / 2,
                    newOffset = dir ? vpkr._paginationOffset + vpkr.options.paginatePageSize : vpkr._paginationOffset - count,
                    dataMethod = vpkr.searchTerm ? "search" : "populate";

                targetPaginator.addClass('vpkr-loading');

                vpkr.update(dataMethod, newOffset, count, function (newData) {

                    var arr = [];

                    // the following routine looks complicated, but it's not too bad -- we're just appending or prepending the new data to the old one depending on which way we're going

                    if (!dir) { // paginated backwards

                        vpkr._paginationOffset -= newData.length;
                        arr = [].concat(newData, vpkr._items); // prepend new data
                        vpkr._items = arr.slice(0, vpkr.options.paginatePageSize); // slice into max records

                    } else { // paginated forwards

                        vpkr._paginationOffset += newData.length;
                        arr = [].concat(vpkr._items, newData); // append new data
                        vpkr._items = arr.slice(arr.length - vpkr.options.paginatePageSize);
                    }

                    targetPaginator.removeClass('vpkr-loading');

                    vpkr._populate(vpkr._items);

                    // if tree mode, filter the new results on the search term, to open the correct trees
                    if (vpkr.searchTerm && vpkr.options.tree) {
                        vpkr.filter(vpkr.searchTerm);
                    }

                    lastRecord = $('#' + lastRecord);
                    firstRecord = $('#' + firstRecord);
                    vpkr.$tablecontainer[0].scrollTop = dir ? lastRecord.position().top - vpkr.$tablecontainer.height() + (lastRecord.height() * 4) : firstRecord.position().top - (firstRecord.height() * 1.5);

                });

            }

            if (this.$paginatorForward) {
                this.$paginatorForward.find('span').text(paginationString);
            } else {
                this.$paginatorForward = $('<p class="vpkr-paginator ui-state-highlight"><span class="vpkr-paginator-breadcrumb">' + paginationString + '</span><a href="#">' + this.options.paginateForwardText + '</a></p>').appendTo(this.$tablecontainer).bind("click", function (e) {
                    e.preventDefault();
                    page(e, true); // page forward!
                });
            }
            if (this.$paginatorBackward) {
                this.$paginatorBackward.find('span').text(paginationString);
            } else {
                this.$paginatorBackward = $('<p class="vpkr-paginator ui-state-highlight"><span class="vpkr-paginator-breadcrumb">' + paginationString + '</span><a href="#">' + this.options.paginateBackwardText + '</a></p>').prependTo(this.$tablecontainer).bind("click", function (e) {
                    e.preventDefault();
                    page(e, false); // page backward!
                });
            }

            // show and hide paginators
            this.$paginatorBackward[0].style.display = atBeginning ? "none" : "";
            this.$paginatorForward[0].style.display = atEnd ? "none" : "";

        },

        _getParentOf: function ($obj) {
            var m = $obj[0].className.match(this._cpRegex);
            if (m && m[1]) {
                return $('#' + m[1]);
            }
            return null;
        },

        _getChildrenOf: function ($obj) {
            return this.$table.find("." + this.options.childPrefix + $obj[0].id);
        },

        _init: function () {
			
			var searchInput, active, numChars, vpkr = this, exitSearch;
			
			// attach any actions
			if (this.options.actions) {
				$.each(vpkr.options.actions, function (actionLabel, action) {
					vpkr.$table.delegate('a.vpkr-action-' + actionLabel.toLowerCase().replace(actionLabelRegex, '_'), 'click', function (e) {
	                    // actions are executed as clickthroughs, and receive the event and the original data, pulled out from $.data
	                    e.preventDefault();
	                    var tr = $(this).closest('tr');
	                    action.call(tr, e, vpkr._items[tr.index()]); // TODO: make sure this call to .index() is more or less performant
	                    vpkr._trigger('actionTaken', e, { 'vpkr': vpkr, 'action': actionLabel });
	                });
				})
			}
			
			
            // attach events and manage searching if there's a searchinput
			if (this.$searchInput) {

	            searchInput = this.$searchInput;
				active = false;
				numChars = 0;
				exitSearch = function (e) {
					var b;
				    vpkrEvent = e;
					vpkr.clearSearch();
					b = searchInput.removeClass('text-entered')[0];
					b.value = b.defaultValue;
					b.blur();
				};

	            // attach events -- while unattaching any that might preexist.
	            searchInput.unbind('.vpkr').bind('keydown.vpkr', function (e) {

	                var keyCode = $.ui.keyCode,
						container = vpkr.$tablecontainer[0],
						scrollingHeight = vpkr.$rows.height(),
						searchViaAjax = (vpkr.options.data && vpkr.options.data.search),
						search = searchViaAjax ?
							function (term) {
							    if (!vpkr.dataCache && vpkr.$rows) {
							        vpkr.dataCache = {
							            html: vpkr.$rows.clone(),
							            items: [].concat(vpkr._items)
							        }
							    }
							    vpkr.$table.html('');
							    vpkr.$container.addClass('vpkr-loading');
							    vpkr.searchXHR = vpkr.options.data.search(term, function (data) { vpkr.$container.removeClass('vpkr-loading'); vpkr._populate(data); vpkr.filter(term); }, vpkr.options.paginatePageSize, 0);
							}
							:
							function (term) {
							    vpkr.filter(term)
							},
						pagingHeight = container.scrollHeight - scrollingHeight,
						elm = this;

	                vpkrEvent = e; // central location for last event. TODO: maybe allow multiple events at once.

	                switch (e.which) {

	                    case keyCode.ESCAPE:
	                        exitSearch(e);
	                        return;
	                        break;
	                    case keyCode.PAGE_DOWN:
	                        container.scrollTop += pagingHeight;
	                        break;
	                    case keyCode.PAGE_UP:
	                        container.scrollTop -= pagingHeight;
	                        break;
	                    case keyCode.UP:
	                        container.scrollTop -= scrollingHeight;
	                        e.preventDefault();
	                        break;
	                    case keyCode.DOWN:
	                        container.scrollTop += scrollingHeight;
	                        e.preventDefault();
	                        break;
	                    default:
	                        vpkr.$container.addClass('vpkr-search-entered');
	                        if (active) { clearTimeout(active); }
	                        active = setTimeout(function () {
	                            var term = elm.value.replace(regexRegex, "\\&");
	                            if (term !== vpkr.searchTerm) {
	                                vpkr.searchTerm = term;
	                                if (vpkr.searchTerm == '' || elm.value == elm.defaultValue) { // replace the default value
	                                    vpkr.clearSearch(); // don't run exitSearch, which blurs the field -- just clear the search.
	                                    return;
	                                }
	                                if (vpkr.searchTerm.length >= vpkr.options.searchMinChars) {
	                                    vpkr._trigger('searchEntered', vpkrEvent, { 'vpkr': vpkr, term: vpkr.searchTerm });
	                                    search(vpkr.searchTerm);
	                                }
	                            }
	                        }, vpkr.options.searchDelay);
	                        break;

	                }

	            })


					.bind('focus.vpkr', function () {
					    if (this.value == vpkr.options.searchText) {
					        $(this).val('').addClass('text-entered');
					    }
					}).bind('blur.vpkr', function () {
					    if (this.value == '') {
					        this.value = vpkr.options.searchText;
					        $(this).removeClass('text-entered');
					    }
				});
				// search button
	            this.$searchBox.find('.vpkr-search-icon').unbind('.vpkr').bind('click.vpkr', function () { vpkr.$searchInput.focus(); });

	            // search kill button
	            this.options.showAllButton && this.options.showAllButton.unbind('.vpkr').bind('click.vpkr', exitSearch);
			}
            return this.element

        },

        _initTree: function (row, isExpanding) {

            var vpkr = this,

			makeRow = function (rowNum, tr) {

			    var $tr = $(tr),
					parent_row,
					expander_cell,
					listing_cell,
					padding,
					isChild = $tr[0].className.search(vpkr.options.childPrefix) !== -1;

			    // Initialize root nodes only if possible
			    if (!vpkr.options.expandable || !isChild || isExpanding) {

			        if (!$tr.hasClass("initialized")) {
			            $tr.addClass("initialized");

			            var childNodes = vpkr._getChildrenOf($tr);

			            if (!$tr.hasClass("parent") && childNodes.length > 0) {
			                $tr.addClass("parent");
			                expander_cell = $tr.children('td.expander-row');
			                listing_cell = $tr.children('td.item-name');
			                padding = getPaddingLeft(listing_cell) + vpkr.options.indent;

			                childNodes.each(function () {
			                    $(this).children().not('.expander-row')[0].style.paddingLeft = padding + "px";
			                });

			                if (vpkr.options.expandable) {
			                    var handler = function () { vpkr._toggleBranch($tr) };
			                    if (vpkr.options.clickToExpand) {
			                        listing_cell.css('cursor', 'pointer').bind('click.vpkr', handler);
			                    }
			                    expander_cell.bind('click.vpkr', handler);

			                    // Check for a class set explicitly by the user, otherwise set the default class
			                    if (!($tr.hasClass("expanded") || $tr.hasClass("collapsed"))) {
			                        $tr.addClass(vpkr.options.initialState);
			                    }

			                    if ($tr.hasClass("expanded")) {
			                        vpkr.expand($tr);
			                    }
			                }
			            }

			        }
			    } else if (vpkr.options.initialState == "collapsed") {
			        $tr[0].style.display = "none"; // performance. .hide() not necessary here.
			    }

			    // rearrange if necessary -- the data may have come out of order
			    if (isChild && !isExpanding) {
			        parent_row = vpkr._getParentOf($tr);
			        $tr.children('td.item-name')[0].style.paddingLeft = (getPaddingLeft(parent_row.children('.item-name')) + vpkr.options.indent) + 'px';
			        $tr.insertAfter(parent_row);
			    }

			    return $tr;

			}

            if (row) {
                return makeRow(0, row);
            }

            this.$rows.each(makeRow);

        },

        _populate: function (data) {

            var vpkr = this, row = null, $tr = null, useFilter = data && data.search, tbody = $('<tbody></tbody>');

            // create a template TR for performance. Don't jQuery it yet, since we'll do faster string operations with it for now. The string is left without a </tr>, for appending.
            var trTpt = '<tr id="' + vpkr._prefix + '{{id}}"{{childClass}}>' + vpkr._expander + '<td class="searchable item-name">' + (vpkr.options.checkable ? '<input class="vpkr-' + vpkr.options.checkable + '" type="' + vpkr.options.checkable + '" name="' + vpkr.options.name + '" id="' + vpkr.options.name + '-{{id}}" value="{{id}}" /><label for="' + vpkr.options.name + '-{{id}}">{{name}}</label>' : '{{name}}') + '</td>';

            // append actions to template, delegate actions
            $.each(vpkr.options.actions, function (actionLabel) {
                var actionClass = 'vpkr-action-' + actionLabel.toLowerCase().replace(actionLabelRegex, '_');
                trTpt += '<td class="vpkr-action" align="right"><a href="javascript:void(0)" class="' + actionClass + '">' + actionLabel + '</a></td>'; // faster than the append operation
            });

            // close the TR as a string.
            trTpt += '</tr>';

            if (data) {

                vpkr._items = data;

                // table is not populated -- the data must then be serialized JSON. populate the table with it.

                vpkr.$table.html(''); // empty() has some problems with tables.

                for (var i = 0; i < data.length; i++) {

                    // clone out the trTpt;
                    row = trTpt;

                    // produce the row from the template by replacing the {{}} placeholders
                    for (_i in vpkr.options.dataMap) {
                        row = row.split('{{' + _i + '}}').join(data[i][vpkr.options.dataMap[_i]]);
                    }

                    // add child class to object if it's marked as a child
                    row = row.split('{{childClass}}').join(data[i].parentId && data[i].parentId !== 0 ? ' class="' + vpkr.options.childPrefix + vpkr._prefix + data[i].parentId + '"' : '');

                    // push our cell into tbody object
                    tbody.append($(row));

                }

                vpkr.$table.append(tbody);

                // cache the rows for filtering if necessary
                vpkr.$rows = vpkr.$table.find('tr');

                // paginate if necessary!
                if (vpkr.options.paginate) {
                    vpkr._createPaginators();
                }

				// init tree if necessary. We need to do another loop, since every tree row needs to analyze the rest of the tree before building itself
	            // TODO: Figure out if we can do some object modeling to be able to build the tree during this loop.
	            vpkr.options.tree && vpkr._initTree();

            } else {

                // table data is already populated! build search records from HTML.

                vpkr.$rows = vpkr.$table.find('tr').each(function () {

                    // TODO: Work on the static option. It needs it.

                    $tr = $(this);

                    searchRecord = {
                        searchText: (function () { var str = []; $tr.find('.searchable').each(function (ind, elm) { str[ind] = $(elm).text() }); return str.join(' '); } ()),
                        obj: $tr,
                        // if there's child-of class, we need to figure out what the parent element is, and store a reference to it. Anticipate that the parent element might not exist and don't die.
                        parentObj: vpkr._getParentOf($tr)
                    };

                    // add to search records
                    vpkr._items.push(searchRecord);

                    // init tree if necessary
                    if (vpkr.options.tree) {
                        var expander = $tr.children('.expander-row');
                        if (expander.length === 0) {
                            $tr.prepend(vpkr.$expander.clone());
                        }
                        vpkr._initTree($tr);
                    } else {
						$tr.children()[0].style.paddingLeft = "15px";
					}

                });

            }

            this._trigger('dataPopulated', vpkrEvent || null, { 'vpkr': vpkr, 'data': data });

            return this.element
        },

        _setOption: function (key, value) {

            $.Widget.prototype._setOption.apply(this, arguments);

            if (key === "expandable") {
                this.element.addClass('expandable');
            }

            if (key.indexOf("paginate") !== -1) {
                if (this.options.paginate) {
                    this._createPaginators();
                } else {
                    this.$paginatorForward && this.$paginatorForward.remove();
                    this.$paginatorForward = null;
                    this.$paginatorBackward && this.$paginatorBackward.remove();
                    this.$paginatorBackward = null;
                }
            }

            if (key === "searchText") {
                this.searchInput.value = value;
            }

            if (key === "height" || key === "width") {
                this.$container.css('width', this.options.width);
                this.$table.parent().css('height', this.options.height);
                var w = parseInt(this.$searchInput.css('padding-left')) + parseInt(this.$searchInput.css('padding-right')) - 2;
                this.$searchInput.css('width', this.options.width - w);
            }

        },

        _toggleBranch: function ($obj) {
            if ($obj.hasClass("collapsed")) {
                this.expand($obj);
            } else {
                this.collapse($obj);
            }
        },

        // public methods

        collapse: function ($tr) {
            var vpkr = this;

            $tr.addClass("collapsed").removeClass('expanded');

            vpkr._getChildrenOf($tr).each(function () {
                if (!$(this).hasClass("collapsed")) {
                    vpkr.collapse($(this));
                }
                this.style.display = "none";
            });

            return this.element
        },

        destroy: function () {

            if (this.options.wrap) {
                this.$container.replaceWith(this.$table);
            }

            if (this.$searchBox) {
                this.$searchBox.remove();
            }

            if (this.data) {
                this.$table.html('');
            }

            $.Widget.prototype.destroy.call(this);

        },

        expand: function ($tr) {
            var vpkr = this;

            $tr.removeClass("collapsed").addClass("expanded");

            vpkr._getChildrenOf($tr).each(function () {
                if (!$(this).hasClass("initialized")) { vpkr._initTree($(this), true); }
                if ($(this).is(".expanded.parent")) {
                    vpkr.expand($(this));
                }
                this.style.display = '';
            });

            return this.element
        },

        clearSearch: function () {
            this._trigger('searchClearing', vpkrEvent, { vpkr: this });
            this.$container.removeClass('vpkr-search-entered').removeClass('vpkr-loading');
            if (this.searchXHR) { // if an xhr is in progress, cancel it
                this.searchXHR.abort();
            }
            this._results = [];
            this.searchTerm = null;
            var vpkr = this;
            if (vpkr.dataCache) {
                vpkr.$table.html(vpkr.dataCache.html);
                vpkr.$rows = vpkr.dataCache.html;
                vpkr._items = vpkr.dataCache.items;
                vpkr.dataCache = null;
            } else if (this._items) {
                $.each(this._items, function (inx, item) {
                    if (!item.obj) {
                        item.obj = $('#' + vpkr._prefix + item.id)
                    }
                    item.obj.removeClass('not-a-result');
                    if (vpkr.options.expandable && item.obj.hasClass('expanded')) {
                        vpkr.collapse(item.obj)
                    }
                })
            } else {
                this.update();
            }
            this._trigger('searchCleared', vpkrEvent, { vpkr: this });
            return this.element
        },

        filter: function (str) {
            var results = this._results = [], vpkr = this, re = new RegExp(str, 'i');
            $.each(this._items, function (ix, item) {
                if (!item.obj) {
                    item.obj = $('#' + vpkr._prefix + item.id);
                }
                if (!item.searchText) {
                    item.searchText = item[vpkr.options.dataMap.name] + ' ' + item[vpkr.options.dataMap.id];
                }

                if (vpkr.options.tree && vpkr.options.expandable && item.obj.hasClass('parent')) {
                    vpkr.collapse(item.obj);
                }
                if (item.searchText.search(re) == -1) {

                    item.obj.addClass('not-a-result');

                } else {
                    results.push(item);
                    item.obj.removeClass('not-a-result')
                }
            })

            vpkr.options.tree && vpkr.options.expandable && $.each(results, function (ix, result) {
                var r = result, p;
                if (r.parentId) {
                    if (!r.parentObj) {
                        r.parentObj = $('#' + vpkr._prefix + r[vpkr.options.dataMap.parentId]);
                    }
                    p = r.parentObj;
                    while (p) {
                        if (!p.hasClass('expanded')) {
                            vpkr.expand(p.removeClass('not-a-result'))
                        }
                        p = vpkr._getParentOf(p);
                    }
                }
            })

            return this.element

        },

        update: function (type, offset, count, callback) {
			
			var vpkr = this,
            // these arguments will be supplied to the function
            	args = [callback || function (data) { vpkr._populate(data) }, count || this.options.paginatePageSize, offset === 0 ? 0 : (offset || this._paginationOffset)];

            // if there's a searchterm, add the search term to the array
            if (vpkr.searchTerm && type === "search") { args.unshift(vpkr.searchTerm); }

            // run the appropriate data function
            this.options.data[type || "populate"].apply(this, args);

            return this.element
        }

    });

})(jQuery);