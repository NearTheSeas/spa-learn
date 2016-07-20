spa.shell = (function() {
    /*  begin module scope variables */
    // 静态配置
    var configMap = {
            // 页面结构
            main_html: String() +
                ' <div class="spa-shell-head">' +
                '    <div class="spa-shell-head-logo">' +
                '       <h1>SPA</h1>' +
                '       <p>javascript end to end</p>' +
                '    </div>' +
                '    <div class="spa-shell-head-acct"></div>' +
                // '    <div class="spa-shell-head-search"></div>' +
                '</div>' +
                '<div class="spa-shell-main ">' +
                '    <div class="spa-shell-main-nav"></div>' +
                '    <div class="spa-shell-main-content"></div>' +
                '</div>' +
                '<div class="spa-shell-footer"></div>' +
                '<div class="spa-shell-modal"></div>',
            // 聊天框 展开收起配置
            chat_extend_time: 1000,
            chat_retract_time: 300,
            chat_extend_height: 450,
            chat_retract_heigth: 15,
            chat_extend_title: 'Click to retract',
            chat_retract_title: 'Click to extend',

            // resize事件间隔
            resize_interval: 200,

            // 锚点状态映射
            anchor_schema_map: {
                chat: {
                    opened: true,
                    closed: true
                }
            }
        },
        // 动态信息
        stateMap = {
            // 页面容器
            $container: null,
            // 聊天框状态
            // is_chat_retracted: true,
            // 保存当前锚点值
            anchor_map: {},
            resize_idto: undefined
        },
        // 缓存jQuery元素
        jqueryMap = {},
        // 声明事件函数
        setJqueryMap, setChatAnchor, copyAnchorMap, changeAnchorPart, onHashChange, initModule, onResize, onTapAcct, onLogin, onLogout;



    /* ========================== begin utility methods ======================== */
    // returns copy of stored anchor map; minimizes overhead
    copyAnchorMap = function() {
        return $.extend(true, {}, stateMap.anchor_map);
    };

    /* ========================== begin dom methods ==========================  */
    // begin dom method /etJqueryMap/
    setJqueryMap = function() {
        var $container = stateMap.$container;
        jqueryMap = {
            $container: $container,
            $acct: $container.find('.spa-shell-head-acct'),
            $nav: $container.find('.spa-shell-main-nav')
        };
    };

    // begin dom method /changeAnchorPart/
    // Purpose : change part of the URI anchor component
    // Argumetns: 
    //  * arg_map - The map describing what part of the URI anchor we want changed
    // Returns : boolean 
    //  * true - the Anchor portion of the URI was update
    //  * false - the Anchor portion of the URI could not be updated
    // Action :
    //  The current anchor rep stored in stateMap.anchor_map
    //  This method 
    //      * Creates a copy of this map using copyAnchorMap()
    //      * Modifies the key-values using arg_map
    //      * Manages the distinction between independent and dependent values in the encoding
    //      * Attempts to change the URI using uriAnchor
    //      * Returns true on success, and false on failure
    changeAnchorPart = function(arg_map) {
        var
        // 复制修改前的状态
            anchor_map_revise = copyAnchorMap(),
            // 是否成功修改
            bool_return = true,
            // 要修改的独立键
            key_name,
            // 要修改的关联键
            key_name_dep;

        // begin merge changes into anchor map
        KEYVAL:
            for (key_name in arg_map) {
                if (arg_map.hasOwnProperty(key_name)) {
                    // skip dependent keys during iteration
                    if (key_name.indexOf('_') === 0) {
                        continue KEYVAL;
                    }
                    // update independent key value
                    anchor_map_revise[key_name] = arg_map[key_name];

                    // update matching dependent key
                    key_name_dep = '_' + key_name;
                    if (arg_map[key_name_dep]) {
                        anchor_map_revise[key_name_dep] = arg_map[key_name_dep];
                    } else {
                        delete anchor_map_revise[key_name_dep];
                        delete anchor_map_revise['_s' + key_name_dep];
                    }
                }
            };
        // begin attempt to update URI ; revert if not successful
        try {
            $.uriAnchor.setAnchor(anchor_map_revise);
        } catch (error) {
            // replace URI with existing state
            $.uriAnchor.setAnchor(stateMap.anchor_map, null, true);
            bool_return = true;
        }

        return bool_return;
    };


    // begin callback method /setChatAnchor/
    // Example : setChatAnchor('closed');
    // Purpose : Change the chat component of the anchor
    // Arguments : 
    //  * position_type -may be 'closed' or 'opened'
    // Action : 
    //  Changes the URI anchor parameter 'chat' to the requested value if poibible
    //  Returns : 
    //      * true - requested anchor part was updated 
    //      * false - requested anchor part was not updated
    //  Thorws : none

    /* ========================== begin event handlers ==========================  */
    // begin event handler /onHashchange/
    // Purpose : Handles the hashchange event
    // Arguments : 
    //  * event - jQuery event object
    // Settings : none
    // Returns : false
    // Action :
    //  * Parses the URI anchor component 
    //  * Compares proposed application state with current
    //  * Adjust the application only where proposed state differs from existing and is allowed by anchor schema
    onHashchange = function(event) {
        var
            anchor_map_previous = copyAnchorMap(),
            anchor_map_proposed, is_ok = true,
            _s_chat_previous, _s_chat_proposed,
            s_chat_proposed;
        //attempt to parse anchor
        try {
            anchor_map_proposed = $.uriAnchor.makeAnchorMap();
        } catch (error) {
            $.uriAnchor.setAnchor(anchor_map_previous, null, true);
            return false;
        };
        stateMap.anchor_map = anchor_map_proposed;
        // convenience vars  参考 https://segmentfault.com/a/1190000002668503
        _s_chat_previous = anchor_map_previous._s_chat;
        _s_chat_proposed = anchor_map_proposed._s_chat;

        // begin adjust chat component if changed
        if (!anchor_map_previous || _s_chat_previous !== _s_chat_proposed) {
            s_chat_proposed = anchor_map_proposed.chat;
            switch (s_chat_proposed) {
                case 'opened':
                    is_ok = spa.chat.setSliderPosition('opened');
                    break;
                case 'closed':
                    is_ok = spa.chat.setSliderPosition('closed');
                    break;
                default:
                    spa.chat.setSliderPosition('closed');
                    delete anchor_map_proposed.chat;
                    $.uriAnchor.setAnchor(anchor_map_proposed, null, true);
            }
        }

        // begin revert anchor if slider change denied
        if (!is_ok) {
            if (anchor_map_previous) {
                $.uriAnchor.setAnchor(anchor_map_previous, null, true);
                stateMap.anchor_map = anchor_map_previous;
            } else {
                delete anchor_map_proposed.chat;
                $.uriAnchor.setAnchor(anchor_map_proposed, null, true);
            }
        }
        return false;
    };

    onTapAcct = function(event) {
        var acct_text, user_name, user = spa.model.people.get_user();
        if (user.get_is_anon()) {
            user_name = prompt('Please sigin-in');
            spa.model.people.login(user_name);
            jqueryMap.$acct.text('...processing...');
        } else {
            spa.model.people.logout();
        }
        return false;
    };

    onLogin = function(event, login_user) {
        jqueryMap.$acct.text(login_user.name);
    };

    onLogout = function(event, logout_user) {
        jqueryMap.$acct.text('Please sigin-in');
    };

    // begin event handler /onResize/
    onResize = function() {
        if (stateMap.resize_idto) {
            return true;
        }
        spa.chat.handleResize();
        stateMap.resize_idto = setTimeout(
            function() {
                stateMap.resize_idto = undefined;
            }, configMap.resize_interval);
        return true;
    };

    // =============== begin callbacks ================= 
    // begin callback method /setChatAnchor/
    // Example : setChatAnchor('closed')
    // Purpose : Change the chat component of the anchor
    // Arguments :
    //  * position_type - may be 'closed' or 'opened'
    // Action : 
    //  Changes the URI anchor parameter 'chat' to the requested value if possible.
    // Returns :
    //  * true - requested anchor part was updated 
    //  * false - requested anchor part was not updated
    //  Throws : none
    setChatAnchor = function(position_type) {
        return changeAnchorPart({ chat: position_type });
    };

    /* ========================== begin public method ==========================  */
    // begin public method /initModule/
    // Example : spa.shell.initModule( $('#app_div_id') );
    // purpose : 
    //  Directs the Shell to offerr its capability to the user
    // Arguments : 
    //  * $container( example: $('#app_div_id'))
    //    A jquery collection that should represent a single DOM container
    // Action:
    //  Populates $container with the shell of the UI and then configures and initializes feature modules
    //  The Shell is also responsible for browser-wide issues such as URI anchor and cookie management
    // Return : none
    // THrows : none
    initModule = function($container) {
        stateMap.$container = $container;
        $container.html(configMap.main_html);
        // 缓存jQuery对象，减少查询次数，优化效率
        setJqueryMap();

        // 配置锚关系映射
        $.uriAnchor.configModule({
            schema_map: configMap.anchor_schema_map
        });

        // configure and initialize feature feature modules 
        spa.chat.configModule({
            // 传递 ’设置锚点‘ 方法
            set_chat_anchor: setChatAnchor,
            chat_model: spa.model.chat,
            people_model: spa.model.people
        });

        $.gevent.subscribe($container, 'spa-login', onLogin);
        $.gevent.subscribe($container, 'spa-logout', onLogout);

        jqueryMap.$acct.text('Please sign-in').bind('utap', onTapAcct);

        // 初始化子模块
        spa.chat.initModule(jqueryMap.$container);

        // Handle URI anchor change events 
        // This is done /after/ all feature modules are configured and initialied, otherwise they will not be ready to handle the trigger event,
        // whic is used to ensure the anchor is considered on-load
        $(window).bind('resize', onResize).bind('hashchange', onHashchange).trigger('hashchange');

    };

    return { initModule: initModule };
}());
