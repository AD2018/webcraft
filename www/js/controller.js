import Saves from './saves.js';
import {Vector, Helpers} from './helpers.js';

let app = angular.module('gameApp', []);

let injectParams = ['$scope', '$timeout'];
let gameCtrl = function($scope, $timeout) {

    // Load text file
    $scope.loadTextFile = function(url) {
        return fetch(url).then(response => response.text());
    };

    // sun dir
    $scope.sunDir = {
        value: new Vector(1.1493, 1.0293, 0.6293),
        apply: function() {
            // 0.84 1 -1
            if(typeof Game != 'undefined') {
                Game.world.renderer.sunDir = [this.value.x, this.value.y, this.value.z];
            }
        },
        getValue: function() {
            // 1.1493, 1.0293, 0.6293
            return [this.value.x, this.value.y, this.value.z].join(', ');
        }
    };

    $scope.isMobileBrowser = function() {
        return 'ontouchstart' in document.documentElement;
    }

    //
    $scope.player = {
        action: function(name, state) {
            console.log(state, name);
            switch(name) {
                case 'atack': {
                    let button_id = 1;
                    let shiftKey = false;
                    Game.world.localPlayer.pickAt.setEvent({button_id: button_id, shiftKey: shiftKey});
                    break;
                }
                case 'jump': {
                    Game.world.localPlayer.keys[KEY.SPACE] = state;
                    break;
                }
                case 'walk': {
                    Game.world.localPlayer.keys[KEY.W] = state;
                    break;
                }
                case 'place': {
                    let button_id = 3;
                    let shiftKey = false;
                    Game.world.localPlayer.pickAt.setEvent({button_id: button_id, shiftKey: shiftKey});
                    break;
                }
            }
        }
    };

    // Texture packs
    $scope.texture_pack = {
        list: [
            {id: 'default', name: 'Default', value: 'terrain'},
            {id: 'hd', name: '32', value: 'terrain_hd'},
            {id: 'kenney', name: 'Kenney', value: 'terrain_kenney'},
            {id: '1px', name: '1px', value: 'terrain_1px'},
            {id: '128', name: '128', value: 'terrain_128'}
        ],
        next: function() {
            let current = this.getCurrent();
            let index = 0;
            for(let i in this.list) {
                let tp = this.list[i];
                if(tp.value == current.value) {
                    index = i;
                    break;
                }
            }
            this.select(++index);
        },
        select: function(index) {
            index = index % this.list.length;
            $scope.settings.form.texture_pack = this.list[index].value;
        },
        getCurrent: function() {
            for(let tp of this.list) {
                if(tp.value == $scope.settings.form.texture_pack) {
                    return tp;
                }
            }
        }
    };

    import('/js/game.js')
        .then(module => {
            $scope.Game = window.Game = module.Game;
            window.MOUSE    = module.MOUSE;
            window.BLOCK    = module.BLOCK;
            window.KEY      = module.KEY;
            $scope.settings.load();
            $scope.boot.init();
            $scope.login.init();
            $scope.skin.init();
        });

    // Current window
    $scope.current_window = 'main';

    // Settings
    $scope.settings = {
        form: {
            hd: false,
            texture_pack: 'terrain_hd',
            mipmap: false
        },
        save: function() {
            localStorage.setItem('settings', JSON.stringify(this.form));
        },
        load: function() {
            let form = localStorage.getItem('settings');
            if(form) {
                this.form = Object.assign(this.form, JSON.parse(form));
            }
        }
    };

    // https://ru.namemc.com/minecraft-skins/trending/top?page=5
    $scope.skin = {
        // visible: false,
        list: [],
        index: 0,
        loading: true,
        open: function() {
            $scope.current_window = 'skin';
        },
        close: function() {
            $scope.current_window = 'main';
        },
        next: function() {
            this.index++;
            if(this.index == this.list.length) {
                this.index = 0;
            }
        },
        prev: function() {
            this.index--;
            if(this.index < 0) {
                this.index = this.list.length - 1;
            }
        },
        save: function() {
            localStorage.setItem('skin', this.list[this.index].id);
            $scope.Game.skin = this.list[this.index];
            this.close();
        },
        getById: function(skin_id) {
            for(let item of this.list) {
                if(item.id == skin_id) {
                    return item;
                }
            }
            return this.list[0];
        },
        getURLById: function(skin_id) {
            return './media/skins/' + skin_id + '.png';
        },
        init: function() {
            let that = this;
            Helpers.loadJSON('/data/skins.json', function(list) {
                that.loading = false;
                for(let item of list) {
                    item.file = that.getURLById(item.id)
                }
                that.list = list;
                let s = localStorage.getItem('skin');
                if(s) {
                    for(let i in list) {
                        if(list[i].id == s) {
                            that.index = parseInt(i);
                            break;
                        }
                    }
                }
                $scope.Game.skins = that;
                $scope.Game.skin = list[that.index];
            });
        }
    };

    // Login
    $scope.login = {
        ok: false,
        loading: false,
        form: {
            username: ''
        },
        submit: function() {
            if(!this.form.username) {
                return false;
            }
            localStorage.setItem('username', this.form.username);
            this.init();
        },
        init: function() {
            this.form.username = localStorage.getItem('username');
            this.ok = !!this.form.username;
            $scope.Game.username = this.form.username;
        }
    };

    // Boot
    $scope.boot = {
        loading: false,
        latest_save: false,
        init: function() {
            this.saves = new Saves(function(instance) {
                $scope.Game.saves = instance;
            });
            $scope.demoMaps.load();
        }
    };

    // My games
    $scope.mygames = {
        list: [],
        load: function() {
            let list = localStorage.getItem('mygames');
            if(list) {
                list = JSON.parse(list);
                if(list) {
                    for(let item of list) {
                        if(!item.hasOwnProperty('id')) {
                            item.id = item._id;
                        }
                    }
                    this.list = list;
                }
            }
        },
        save: function() {
            localStorage.setItem('mygames', JSON.stringify(this.list));
        },
        add: function(form) {
            this.list.push(form);
            this.save();
        }
    };

    // Генараторы мира
    $scope.generators = {
        index: 0,
        list: [
            {id: 'biome2', title: 'Стандартный'},
            {id: 'city', title: 'Город'},
            {id: 'city2', title: 'Город 2'},
            {id: 'flat', title: 'Плоский мир'}
        ],
        next: function() {
            this.index = (this.index + 1) % this.list.length;
            $scope.newgame.form.generator.id = this.getCurrent().id;
        },
        getCurrent: function() {
            return this.list[this.index];
        }
    };

    // New world
    $scope.newgame = {
        form: {
            id: '',
            title: '',
            generator: {
                id: $scope.generators.list[0].id
            },
            seed: ''
        },
        submit: function() {
            $scope.mygames.add(this.form);
            $scope.settings.save();
            $scope.current_window = 'loading';
            this.form = $scope.Game.createNewWorld(this.form);
            $scope.boot.saves.addNew(this.form);
            $scope.Game.initGame(this.form, $scope.settings.form);
        },
        open: function() {
            $scope.current_window = 'newgame';
            this.form.seed = Helpers.getRandomInt(1000000, 4000000000) + '';
            this.form.id = Helpers.generateID();
        },
        close: function() {
            $scope.current_window = 'main';
        }
    }

    // Start world
    $scope.StartWorld = function(world_name) {
        $scope.settings.save();
        $scope.boot.saves.load(world_name, function(saved_world) {
            $scope.Game.initGame(saved_world, $scope.settings.form);
        }, function(err) {
            alert('World not found');
        });
    };

    // Demo maps
    $scope.demoMaps = {
        loading: false,
        map_running: false,
        list: [],
        load: function() {
            let that = this;
            that.loading = true;
            Helpers.loadJSON('./data/demo_maps.json', function(response) {
                $timeout(function() {
                    that.list = response;
                    that.loading = false;
                });
            });
        },
        run: function(item) {
            let that = this;
            $scope.settings.save();
            that.map_running = true;
            $timeout(function() {
                $scope.boot.saves.load(item.id, function(row) {
                    $scope.Game.initGame(row, $scope.settings.form);
                }, function(err) {
                    Helpers.loadJSON(item.url, function(row) {
                        $timeout(function(){
                            $scope.Game.initGame(row, $scope.settings.form);
                        });
                    });
                });
            }, 0);
        }
    };

}

gameCtrl.$inject = injectParams;
app.controller('gameCtrl', gameCtrl);

// myEnter directive
let myEnterInjectParams = ['$q'];
let directive = function($q) {
    return function(scope, element, attrs) {
        element.bind('keydown keypress', function(event) {
            if(event.which === 13) {
                if(!event.shiftKey) {
                    scope.$apply(function() {
                        scope.$eval(attrs.myEnter);
                    });
                    event.preventDefault();
                }
            }
        });
    };
};
directive.$inject = myEnterInjectParams;
app.directive('myEnter', directive);