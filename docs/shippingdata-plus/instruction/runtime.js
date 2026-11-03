(function() {
    var LANG_META = {
        uk: {
            htmlLang: 'uk',
            title: 'Модуль «Shipping Data Plus» для OpenCart',
            description: 'Shipping Data Plus — TTN, трекінг і резервні копії довідників перевізників для OpenCart',
            favicon: 'https://oc-max.com/docs/shippingdata-plus/images/favicon.ico'
        },
        en: {
            htmlLang: 'en',
            title: 'Shipping Data Plus module for OpenCart',
            description: 'Shipping Data Plus — consignment numbers, tracking links, and carrier directory backups for OpenCart',
            favicon: 'https://oc-max.com/docs/shippingdata-plus/images/favicon.ico'
        },
        ru: {
            htmlLang: 'ru',
            title: 'Модуль «Shipping Data Plus» для OpenCart',
            description: 'Shipping Data Plus — номера отправлений, трекинг и резервные копии справочников перевозчиков для OpenCart',
            favicon: 'https://oc-max.com/docs/shippingdata-plus/images/favicon.ico'
        }
    };

    function activePanel() {
        return $('.lang-panel:visible');
    }

    function applyMeta(code) {
        var meta = LANG_META[code] || LANG_META.uk;
        document.documentElement.lang = meta.htmlLang;
        document.title = meta.title;
        $('meta[name="description"]').attr('content', meta.description);
        $('#favicon').attr('href', meta.favicon);
    }

    function switchLang(code) {
        if (!LANG_META[code]) {
            code = 'uk';
        }
        $('.lang-panel').addClass('d-none').hide();
        $('#lang-' + code).removeClass('d-none').show();
        applyMeta(code);
        try {
            localStorage.setItem('instruction_lang', code);
        } catch (e) {}
        if (window.history && window.history.replaceState) {
            var url = new URL(window.location.href);
            url.searchParams.set('lang', code);
            window.history.replaceState(null, '', url.toString());
        }
    }

    $(function() {
        var params = new URLSearchParams(window.location.search);
        var lang = params.get('lang');
        if (!lang) {
            try {
                lang = localStorage.getItem('instruction_lang');
            } catch (e) {}
        }
        if (!LANG_META[lang]) {
            if (lang === 'ua') {
                lang = 'uk';
            }
        }
        if (!LANG_META[lang]) {
            lang = 'uk';
        }
        switchLang(lang);

        $(document).on('click', '.lang-switch', function(e) {
            e.preventDefault();
            var code = $(this).data('lang');
            if (code === 'ua') {
                code = 'uk';
            }
            switchLang(code);
        });

        $(document).on('click', '.link-goto', function(e) {
            e.preventDefault();
            var id = $(this).attr('href');
            var target = activePanel().find(id);
            if (!target.length) {
                return;
            }
            $('html, body').animate({scrollTop: target.offset().top - 70}, 1500);
        });

        function markSearch() {
            var panel = activePanel();
            var keyword = panel.find('#input-text_to_find').val();
            var scope = panel.find('.container-fluid').first();
            var options = {
                className: 'badge bg-warning text-dark',
                separateWordSearch: false
            };
            scope.unmark({
                done: function() {
                    scope.mark(keyword, options);
                    var first = panel.find('mark:first');
                    if (first.length) {
                        $('html, body').animate({scrollTop: first.offset().top - 70}, 1500);
                    }
                }
            });
        }

        $(document).on('click', '#button-search', markSearch);

        $(document).on('change', '#input-text_to_find', function() {
            if (!this.value) {
                activePanel().find('.container-fluid').first().unmark();
            }
        });
    });
})();
