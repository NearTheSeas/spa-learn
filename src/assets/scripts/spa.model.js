spa.model = (function() {

    var configMap = { anon_id: 'a0' },
        stateMap = {
            // 匿名用户
            anon_user: null,
            // 客户端id序列
            cid_serial: 0,
            // 用户cid 映射
            people_cid_map: {},
            // 用户集合
            people_db: TAFFY(),
            // 当前用户
            user: null,
            // 是否已进入聊天室
            is_connected: false
        },
        // 是否使用假数据
        isFakeData = true,
        personProto, makeCid, clearPeopleDb, completeLogin, makePerson, removePerson, people, chat, initModule;

    // person公共方法，用于继承
    personProto = {
        get_is_user: function() {
            return this.cid === stateMap.user.cid;
        },
        get_is_anon: function() {
            return this.cid === stateMap.anon_user.cid;
        }
    };

    // 创建客户端cid
    makeCid = function() {
        return 'c' + String(stateMap.cid_serial++);
    };

    // 清空用户集合
    clearPeopleDb = function() {
        var user = stateMap.user;
        stateMap.people_db = TAFFY();
        stateMap.people_cid_map = {};
        // 当前用户不清除
        if (user) {
            stateMap.people_db.insert(user);
            stateMap.people_cid_map[user.cid] = user;
        }
    };

    // 用户登录成功
    completeLogin = function(user_list) {
        var user_map = user_list[0];
        delete stateMap.people_cid_map[user_map.cid];
        stateMap.user.cid = user_map._id;
        stateMap.user.id = user_map._id;
        stateMap.user.css_map = user_map.css_map;
        stateMap.people_cid_map[user_map._id] = stateMap.user;
        chat.join();
        $.gevent.publish('spa-login', [stateMap.user]);
    }

    // 创建用户
    makePerson = function(person_map) {
        var person,
            cid = person_map.cid,
            css_map = person_map.css_map,
            id = person_map.id,
            name = person_map.name;

        if (cid === undefined || !name) {
            throw 'client id and name required';
        }

        // 继承公共方法
        person = Object.create(personProto);
        person.cid = cid;
        person.name = name;
        person.css_map = css_map;

        if (id) { person.id = id }

        // 缓存用户
        stateMap.people_cid_map[cid] = person;
        stateMap.people_db.insert(person);

        return person;
    };

    // 删除用户
    removePerson = function(person) {
        if (!person) {
            return false;
        }
        // 不清除匿名用户
        if (person.id === configMap.anon_id) {
            return false;
        }
        stateMap.people_db({ cid: person.cid }).remove();
        if (person.cid) {
            delete stateMap.people_cid_map[person.cid];
        }
        return true;
    };
    // 对用户进行管理
    people = (function() {
        var get_by_cid, get_db, get_user, login, logout;
        // 根据cid获取用户
        get_by_cid = function(cid) {
            return stateMap.people_cid_map[cid];
        };
        // 获取用户集合
        get_db = function() {
            return stateMap.people_db;
        };
        // 返回当前用户
        get_user = function() {
            return stateMap.user;
        };
        // 用户登录
        login = function(name) {
            var sio = isFakeData ? spa.fake.mockSio : spa.data.getSio();
            stateMap.user = makePerson({
                cid: makeCid(),
                css_map: { top: 25, left: 25, 'background-color': '#8f8' },
                name: name
            });
            sio.on('userupdate', completeLogin);
            sio.emit('adduser', {
                cid: stateMap.user.cid,
                css_map: stateMap.user.css_map,
                name: stateMap.user.name
            });
        };
        // 用户退出
        logout = function() {
            var user = stateMap.user;
            chat._leave();
            stateMap.user = stateMap.anon_user;
            clearPeopleDb();
            $.gevent.publish('spa-logout', [user]);
            return is_removed;
        };

        return {
            get_by_cid: get_by_cid,
            get_db: get_db,
            get_user: get_user,
            login: login,
            logout: logout
        };
    }());

    // 聊天室
    chat = (function() {
        var _publish_listchange,
            _publis_updatechat,
            _update_list,
            _leave_chat,
            _join_chat,
            get_chatee,
            send_msg,
            set_chatee,
            update_avatar,
            chatee = null;

        // 更新用户列表
        _update_list = function(arg_list) {
            var i, person_map, make_person_map, person, people_list = arg_list[0],
                is_chatee_online = false;
            clearPeopleDb();
            PERSON:
                for (var i = 0; i < people_list.length; i++) {
                    person_map = people_list[i];
                    if (!person_map.name) {
                        continue PERSON;
                    };
                    // 更新当前用户的样式
                    if (stateMap.user && stateMap.user.id === person_map._id) {
                        stateMap.user.css_map = person_map.css_map;
                        continue PERSON;
                    };
                    make_person_map = {
                        cid: person_map._id,
                        css_map: person_map.css_map,
                        id: person_map._id,
                        name: person_map.name
                    };
                    person = makePerson(make_person_map);
                    // 更新用户列表是判断 聊天对象是否在列表中
                    if (chatee && chatee.id === make_person_map.id) {
                        is_chatee_online = true;
                        chatee = person;
                    }
                    makePerson(make_person_map);
                }
            stateMap.people_db.sort('name');
            if (chatee && !is_chatee_online) { set_chatee(''); }
        };
        // 列表变更事件
        _publish_listchange = function(arg_list) {
            _update_list(arg_list);
            $.gevent.publish('spa-listchange', [arg_list]);
        };
        // 
        _publis_updatechat = function(arg_list) {
                var msg_map = arg_list[0];
                if (!chatee) {
                    set_chatee(msg_map.sender_id);
                } else if (msg_map.sender_id !== stateMap.user.id && msg_map.sender_id !== chatee.id) {
                    set_chatee(msg_map.sender_id);
                }
                $.gevent.publish('spa-updatechat', [msg_map]);
            }
            // 离开聊天室
        _leave_chat = function(argument) {
            var sio = isFakeData ? spa.fase.mockSio : spa.data.getSio();
            chatee = null;
            stateMap.is_connected = false;
            if (sio) { sio.emit('leavechat'); }
        };

        get_chatee = function() {
            return chatee;
        };
        // 加入聊天室
        join_chat = function() {
            var sio;
            if (stateMap.is_connected) {
                return false;
            }
            if (stateMap.user.get_is_anon()) {
                console.warn('user must be defined before joining chart');
                return false;
            }
            sio = isFakeData ? spa.fake.mockSio : spa.data.getSio();
            sio.on('listchange', _publish_listchange);
            sio.on('updatechat', _publis_updatechat);
            stateMap.is_connected = true;
            return true;
        };;
        send_msg = function(msg_text) {
            var msg_map,
                sio = isFakeData ? spa.fake.mockSio : spa.data.getSio();
            if (!sio) {
                return false;
            }
            if (!(stateMap.user && chatee)) {
                return false;
            }
            msg_map = {
                dest_id: chatee.id,
                dest_name: chatee.name,
                sender_id: stateMap.user.id,
                msg_text: msg_text
            };

            _publis_updatechat([msg_map]);
            sio.emit('updatechat', msg_map);
            return true;
        };

        set_chatee = function(person_id) {
            var new_chatee;
            new_chatee = stateMap.people_cid_map[person_id];
            if (new_chatee) {
                if (chatee && chatee.id === new_chatee.id) {
                    return false;
                }
            } else {
                new_chatee = null;
            }
            $.gevent.publish('spa.set_chatee', { old_chatee: chatee, new_chatee: new_chatee });
            chatee = new_chatee;
            return true;
        };

        update_avatar = function(avator_update_map) {
            var sio = isFakeData ? spa.fake.mockSio : spa.data.getSio();
            if (sio) {
                sio.emit('updateavatar', avator_update_map);
            }
        };
        return {
            _leave: _leave_chat,
            get_chatee: get_chatee,
            join: join_chat,
            sender_msg: send_msg,
            set_chatee: set_chatee,
            update_avatar: update_avatar
        };
    }());
    initModule = function() {
        var i, people_list, person_map;
        stateMap.anon_user = makePerson({
            cid: configMap.anon_id,
            id: configMap.anon_id,
            name: 'anonymous'
        });
        stateMap.user = stateMap.anon_user;

        // if (isFakeData) {
        //     people_list = spa.fake.getPeopleList();
        //     for (var i = 0; i < people_list.length; i++) {
        //         person_map = people_list[i];
        //         makePerson({
        //             cid: person_map._id,
        //             css_map: person_map.css_map,
        //             id: person_map._id,
        //             name: person_map.name
        //         });
        //     }
        // }
    };

    return {
        initModule: initModule,
        people: people,
        chat: chat
    };
}());
