# VPKR
### a totally pronounceable jQuery UI widget

VPKR is a filterable, hierarchical data table. It combines the functionality of a data table, an accordion, and an autocomplete.

 - **Flexible data source:** Accepts inline HTML, JSON, or asynchronous AJAX function
 - **Searchability:** Typeahead search bar makes sense to users
 - **Hierarchy:** Accepts a hierarchical data set and displays as expandable trees
 - **Versatility:** Configure "actions" as functions which operate on data records, add form controls to table rows
 - **Simplicity:** Small, light, does only the above, doesn't make a mess of the DOM
 - **Pronounciation:** "Vip-kurr" (or "vee-picker" if you're boring)

## Installation
Keep it old school.
```sh
$ bower install zetlen/vpkr
```
```html
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js"></script>
<script src="bower_components/vpkr/js/jquery-ui-1.8.9.custom.min.js"></script>
<script src="bower_components/vpkr/js/jquery.vpkr-0.1.js"></script>
```

This plugin was made before AMDs or CommonJS packages were common practice, but it uses normal jQuery plugin style and should be easy to shim.