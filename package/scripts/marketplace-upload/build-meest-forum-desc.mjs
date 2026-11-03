import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../../docs/meest/listing');

const BRAND = 'rgb(0, 97, 175)';
const brandStrong = (text) => `<strong style="color:${BRAND};">${text}</strong>`;
const cardTitle = (text) => `<span style="color:${BRAND};">${text}</span>`;
const h6 = (t) => `\t\t<h6 style="background-color:#f8f9fa;color:${BRAND};font-size:1rem;">\n\t\t\t${t}\n\t\t</h6>`;

const card = (title, body) => `<div style="background-color:#f8f9fa;border:1px solid rgba(0,0,0,0.125);color:#212529;font-size:16px;text-align:left;">
\t<div style="background-color:rgba(0,0,0,0.03);border-bottom:1px solid rgba(0,0,0,0.125);padding:0.75rem 1.25rem;">
\t\t${cardTitle(title)}
\t</div>

\t<div style="padding:1.25rem;">
${body}
\t</div>
</div>`;

const ul = (items) => {
  const lines = items.map((item) => {
    if (typeof item === 'string') {
      return `\t\t\t<li>\n\t\t\t\t<span>&nbsp;</span>${item}\n\t\t\t</li>`;
    }
    const [head, sub] = item;
    const subUl = sub.map((s) => `\t\t\t\t\t<li>\n\t\t\t\t\t\t${s}\n\t\t\t\t\t</li>`).join('\n');
    return `\t\t\t<li>\n\t\t\t\t${head}\n\t\t\t\t<ul>\n${subUl}\n\t\t\t\t</ul>\n\t\t\t</li>`;
  }).join('\n');
  return `\t\t<ul style="background-color:#f8f9fa;color:#212529;font-size:16px;">\n${lines}\n\t\t</ul>`;
};

const chip = (text, color) =>
  `<span style="color:#ffffff;"><strong><span style="text-align:center;vertical-align:baseline;"><span style="background-color:${color};">${text}</span></span></strong></span>`;

const OC = '<abbr title="Бесплатная платформа для электронной коммерции с открытым исходным кодом"><abbr title="Бесплатная платформа для электронной коммерции с открытым исходным кодом">OpenCart</abbr></abbr>';

const locales = {
  uk: {
    out: 'description.forum.uk.html',
    name: 'Meest ПОШТА',
    moduleFor: `Meest ПОШТА для ${OC}`,
    intro: [
      `${brandStrong('Meest ПОШТА')} — український поштово-логістичний оператор із широкою мережею відділень, доступними тарифами, швидкою та надійною доставкою.`,
      `Модуль ${brandStrong(`Meest ПОШТА для ${OC}`)} дозволяє легко підключити доставку до вашого інтернет-магазину та автоматизувати весь процес роботи з відправленнями. Покупці можуть обрати доставку ${chip('у відділення', '#27ae60')}, ${chip('поштомат', '#27ae60')} або ${chip("кур'єром на адресу", '#27ae60')}, а магазин автоматично отримує актуальні дані про міста, точки доставки та вартість доставки через ${chip('API Meest', '#dc3545')} або тарифні таблиці.`,
      `Безпосередньо з адмін-панелі OpenCart доступні ${chip('створення ТТН', '#27ae60')}, формування реєстрів, друк маркувань та відстеження відправлень. Автоматизація через ${chip('Cron', '#27ae60')} забезпечує регулярне оновлення довідників, синхронізацію статусів замовлень і контроль доставки.`,
      `Усе необхідне для швидкої та зручної роботи з ${brandStrong('Meest ПОШТА')} — в одному модулі.`,
      `Доповнення є авторською розробкою і захищено відповідними правами. Повний текст ліцензії: <a href="https://oc-max.com/docs/meest/license.md" rel="noopener noreferrer" target="_blank">license.md</a>`,
    ],
    demoIntro: 'За посиланнями нижче можна перейти на демонстраційний сайт. Для доступу в адмін-панель використовуйте наступні дані: логін і пароль -',
    demoButtons: ['Панель адміністратора', 'Створення/редагування накладної', 'Список накладних', 'Магазин'],
    sections: {
      features: 'Функціональні можливості',
      main: 'Основні можливості',
      spoiler: 'Спойлер',
      admin: 'Можливості для адміністратора',
      cn: 'Можливості для роботи з накладними та реєстрами',
      client: 'Можливості для клієнта',
      languages: 'Підтримувані мови',
      compatibility: 'Сумісність',
      license: 'Ліцензія',
      requirements: 'Вимоги',
    },
    mainFeatures: [
      'гнучкі налаштування для трьох способів доставки Meest ПОШТА',
      'зручне ручне і автоматичне оновлення довідників, областей, міст і відділень',
      'створення, редагування та видалення накладних',
      'максимальне заповнення форми накладної в автоматичному режимі',
      'перегляд списку накладних та реєстрів безпосередньо в адмін-панелі',
      'автоматичне відстеження відправлень, зміна статусів замовлення та відправлення сповіщень',
      'завантаження та друк накладних, маркувань і реєстрів у PDF або в браузері',
      'попередній розрахунок вартості доставки через API або тарифні таблиці',
      'розрахунок орієнтовного терміну доставки',
      'вибір та пошук міст, відділень і поштоматів; додаткові поля для адресної доставки',
    ],
    cnParagraph:
      "При перегляді замовлення у панелі адміністратора, якщо клієнт обрав сумісний спосіб доставки Meest ПОШТА, з'являється кнопка для роботи з накладною. Можна створити накладну на основі замовлення або призначити вже існуючу. Під час створення модуль максимально заповнює форму автоматично. Якщо накладна вже є — доступні редагування та видалення. Також можна відкрити список усіх накладних.",
    langList: ['українська', 'англійська', 'російська'],
    langNote:
      'Інтерфейс модуля та довідники Meest відображаються відповідно до мови адмін-панелі та налаштувань OpenCart. Назви міст і відділень синхронізуються з API Meest.',
    compatList: [
      `${OC} v. 1.5.Х.Х, 2.X.X.Х, 3.Х.Х.Х (а також збірки на базі ${OC} відповідних версій)`,
      'форми замовлення:<span>&nbsp;</span><a href="https://opencartforum.com/files/file/9168-one-page-checkout-prostoe-oformlenie-zakaza/" rel=""><span style="color:#0033ff;">One Page Checkout - Просте оформлення замовлення</span></a>, Smart Checkout шаблонів від <a href="https://market.octemplates.net/" rel=""><span style="color:#0033ff;">OCTemplates</span></a>, Simple checkout &amp; registration - максимальний функціонал. Стандартне оформлення замовлень, Ajax Quick Checkout - тільки вибір міста та відділення',
      'модулі повідомлень: стандартний e-mail,<span>&nbsp;</span><a href="https://opencartforum.com/files/file/3550-smsfly-order" rel=""><span style="color:#0033ff;">SmsFly order</span></a>',
      'редактори замовлень:<span>&nbsp;</span><a href="https://opencartforum.com/ru/files/file/9279-menedzher-zamovlen-redaktor-zamovlen/" rel=""><span style="color:#0033ff;">Менеджер Замовлень</span></a>',
    ],
    adaptNote:
      'Можлива потреба в адаптації для конкретних версій. Адаптацію для інших модулів і шаблонів виконаємо&nbsp;<span style="background-color:rgb(40,167,69);color:rgb(255,255,255);font-size:12px;padding:0.25em 0.4em;text-align:center;vertical-align:baseline;">по запиту за ДОДАТКОВУ ПЛАТУ</span>.',
    licenseItems: [
      'придбавши додаток, ви отримуєте доступ до безкоштовних оновлень та технічної підтримки протягом року',
      'ліцензія діє на один домен і всі його піддомени, включно з тестовими сайтами',
      'інформація щодо отримання ліцензії доступна після встановлення модуля',
      'активація ліцензії — автоматично або вручну протягом години після покупки',
      'повний текст: <a href="https://oc-max.com/docs/meest/license.md" target="_blank">Ліцензійний договір (license.md)</a>',
    ],
    licenseFooter: 'Доповнення є авторською розробкою і захищено відповідними правами.',
    requirements: ['ionCube Loader версії 5.0 і вище', 'PHP бібліотека cURL', 'PHP версії 5.6 і вище'],
    warning:
      'Перед встановленням на працюючому інтернет-магазині рекомендуємо виконати встановлення та тестування модуля на тестовому сайті або піддомені!',
    instructionNote:
      'Детальна інструкція з встановлення, налаштування, оновлення та видалення модуля доступна в архіві у файлі instruction.html',
  },
  en: {
    out: 'description.forum.en.html',
    name: 'Meest POSHTA',
    moduleFor: `Meest POSHTA module for ${OC}`,
    intro: [
      `${brandStrong('Meest POSHTA')} is a Ukrainian postal and logistics operator with a wide branch network, affordable rates, and fast, reliable delivery.`,
      `The ${brandStrong(`Meest POSHTA module for ${OC}`)} lets you easily connect delivery to your online store and automate the entire shipment workflow. Customers can choose delivery ${chip('to a branch', '#27ae60')}, ${chip('parcel locker', '#27ae60')} or ${chip('by courier to the address', '#27ae60')}, while the store automatically receives up-to-date data on cities, delivery points, and shipping cost via the ${chip('Meest API', '#dc3545')} or tariff tables.`,
      `Directly from the OpenCart admin panel you can ${chip('create a CN', '#27ae60')}, build registries, print labels, and track shipments. Automation via ${chip('Cron', '#27ae60')} keeps directories updated, syncs order statuses, and controls delivery.`,
      `Everything you need for fast, convenient work with ${brandStrong('Meest POSHTA')} — in one module.`,
      `The extension is proprietary software protected by applicable rights. Full license text: <a href="https://oc-max.com/docs/meest/license.md" rel="noopener noreferrer" target="_blank">license.md</a>`,
    ],
    demoIntro:
      'The links below lead to the demo site. For admin panel access use login and password -',
    demoButtons: ['Admin Panel', 'Create/Edit Consignment Note', 'Consignment Note List', 'Store'],
    sections: {
      features: 'Functional Capabilities',
      main: 'Main capabilities',
      spoiler: 'Spoiler',
      admin: 'Admin capabilities',
      cn: 'Consignment note and registry capabilities',
      client: 'Customer capabilities',
      languages: 'Supported languages',
      compatibility: 'Compatibility',
      license: 'License',
      requirements: 'Requirements',
    },
    mainFeatures: [
      'flexible settings for three Meest POSHTA delivery methods',
      'convenient manual and automatic update of directories, regions, cities, and departments',
      'creating, editing, and deleting consignment notes',
      'maximum auto-completion of the CN form',
      'viewing CN and registry lists directly in the admin panel',
      'automatic shipment tracking, order status changes, and notification delivery',
      'downloading and printing CNs, labels, and registries as PDF or in the browser',
      'preliminary delivery cost calculation via API or tariff tables',
      'approximate delivery time calculation',
      'selection and search of cities, departments, and parcel lockers; additional fields for address delivery',
    ],
    cnParagraph:
      'When viewing an order with a compatible Meest POSHTA delivery method, CN actions appear in the admin panel. You can create a CN from the order or assign an existing one. The form is filled automatically from the order. If a CN already exists, edit and delete are available. You can also open the full CN list.',
    langList: ['Ukrainian', 'English', 'Russian'],
    langNote:
      'The module interface and Meest directories follow the admin panel language and OpenCart settings. City and department names sync from the Meest API.',
    compatList: [
      `${OC} v. 1.5.x, 2.x, 3.x (and builds based on ${OC} of corresponding versions)`,
      'checkout forms:<span>&nbsp;</span><a href="https://opencartforum.com/files/file/9168-one-page-checkout-prostoe-oformlenie-zakaza/" rel=""><span style="color:#0033ff;">One Page Checkout</span></a>, <u>Smart Checkout</u> templates from <a href="https://market.octemplates.net/" rel=""><span style="color:#0033ff;">OCTemplates</span></a>, Simple checkout &amp; registration — full functionality. Standard checkout, Ajax Quick Checkout — city and department selection only',
      'notification modules: standard e-mail,<span>&nbsp;</span><a href="https://opencartforum.com/files/file/3550-smsfly-order" rel=""><span style="color:#0033ff;">SmsFly order</span></a>',
      'order editors:<span>&nbsp;</span><a href="https://opencartforum.com/ru/files/file/9279-menedzher-zamovlen-redaktor-zamovlen/" rel=""><span style="color:#0033ff;">Order Manager</span></a>',
    ],
    adaptNote:
      'Adaptation may be required for specific versions. Adaptation for other modules and templates is available&nbsp;<span style="background-color:rgb(40,167,69);color:rgb(255,255,255);font-size:12px;padding:0.25em 0.4em;text-align:center;vertical-align:baseline;">on request for an ADDITIONAL FEE</span>.',
    licenseItems: [
      'after purchase you get access to free updates and technical support for one year',
      'the license applies to one domain and all its subdomains, including test sites',
      'license information is available after module installation',
      'license activation — automatically or manually within one hour after purchase',
      'full text: <a href="https://oc-max.com/docs/meest/license.md" target="_blank">License agreement (license.md)</a>',
    ],
    licenseFooter: 'The extension is proprietary software protected by applicable rights.',
    requirements: ['ionCube Loader version 5.0 and above', 'PHP cURL library', 'PHP version 5.6 and above'],
    warning:
      'Before installing on a live online store, we recommend installing and testing the module on a test site or subdomain!',
    instructionNote:
      'Detailed instructions for installation, configuration, update, and removal are available in the archive in instruction.html',
  },
  ru: {
    out: 'description.forum.ru.html',
    name: 'Meest ПОШТА',
    moduleFor: `Meest ПОШТА для ${OC}`,
    intro: [
      `${brandStrong('Meest ПОШТА')} — украинский почтово-логистический оператор с широкой сетью отделений, доступными тарифами, быстрой и надежной доставкой.`,
      `Модуль ${brandStrong(`Meest ПОШТА для ${OC}`)} позволяет легко подключить доставку к вашему интернет-магазину и автоматизировать весь процесс работы с отправлениями. Покупатели могут выбрать доставку ${chip('в отделение', '#27ae60')}, ${chip('почтомат', '#27ae60')} или ${chip('курьером на адрес', '#27ae60')}, а магазин автоматически получает актуальные данные о городах, точках доставки и стоимости доставки через ${chip('API Meest', '#dc3545')} или тарифные таблицы.`,
      `Прямо из админ-панели OpenCart доступны ${chip('создание ТТН', '#27ae60')}, формирование реестров, печать маркировок и отслеживание отправлений. Автоматизация через ${chip('Cron', '#27ae60')} обеспечивает регулярное обновление справочников, синхронизацию статусов заказов и контроль доставки.`,
      `Все необходимое для быстрой и удобной работы с ${brandStrong('Meest ПОШТА')} — в одном модуле.`,
      `Дополнение является авторской разработкой и защищено соответствующими правами. Полный текст лицензии: <a href="https://oc-max.com/docs/meest/license.md" rel="noopener noreferrer" target="_blank">license.md</a>`,
    ],
    demoIntro:
      'По ссылкам, предоставленным ниже, можно перейти на демонстрационный сайт. Для доступа в админ-панель используйте следующие данные: логин и пароль -',
    demoButtons: ['Панель администратора', 'Создание/редактирование накладной', 'Список накладных', 'Магазин'],
    sections: {
      features: 'Функциональные возможности',
      main: 'Основные возможности',
      spoiler: 'Спойлер',
      admin: 'Возможности для администратора',
      cn: 'Возможности для работы с накладными и реестрами',
      client: 'Возможности для клиента',
      languages: 'Поддерживаемые языки',
      compatibility: 'Совместимость',
      license: 'Лицензия',
      requirements: 'Требования',
    },
    mainFeatures: [
      'гибкие настройки для трех способов доставки Meest ПОШТА',
      'удобное ручное и автоматическое обновление справочников, областей, городов и отделений',
      'создание, редактирование и удаление накладных',
      'максимальное автозаполнение формы накладной',
      'просмотр списка накладных и реестров в админ-панели',
      'автоматическое отслеживание отправлений, смена статусов заказа и отправка уведомлений',
      'загрузка и печать накладных, маркировок и реестров в PDF или в браузере',
      'предварительный расчет стоимости доставки через API или тарифные таблицы',
      'расчет ориентировочного срока доставки',
      'выбор и поиск городов, отделений и почтоматов; дополнительные поля для адресной доставки',
    ],
    cnParagraph:
      'При просмотре заказа в панели администратора, если клиент выбрал совместимый способ доставки Meest ПОШТА, появляется кнопка для работы с накладной. Можно создать накладную на основе заказа или назначить уже существующую. При создании модуль максимально заполняет форму автоматически. Если накладная уже есть — доступны редактирование и удаление. Также можно открыть список всех накладных.',
    langList: ['украинский', 'английский', 'русский'],
    langNote:
      'Интерфейс модуля и справочники Meest отображаются в соответствии с языком админ-панели и настройками OpenCart. Названия городов и отделений синхронизируются из API Meest.',
    compatList: [
      `${OC} v. 1.5.X.X, 2.X.X.X, 3.X.X.X (а также сборки на базе ${OC} соответствующих версий)`,
      'формы заказа:<span>&nbsp;</span><a href="https://opencartforum.com/files/file/9168-one-page-checkout-prostoe-oformlenie-zakaza/" rel=""><span style="color:#0033ff;">One Page Checkout - Простое оформление заказа</span></a>, <u>Smart Checkout</u> шаблонов от <a href="https://market.octemplates.net/" rel=""><span style="color:#0033ff;">OCTemplates</span></a>, Simple checkout &amp; registration — максимальный функционал. Стандартное оформление заказов, Ajax Quick Checkout — только выбор города и отделения',
      'модули уведомлений: стандартный e-mail,<span>&nbsp;</span><a href="https://opencartforum.com/files/file/3550-smsfly-order" rel=""><span style="color:#0033ff;">SmsFly order</span></a>',
      'редакторы заказов:<span>&nbsp;</span><a href="https://opencartforum.com/ru/files/file/9279-menedzher-zamovlen-redaktor-zamovlen/" rel=""><span style="color:#0033ff;">Менеджер Заказов</span></a>',
    ],
    adaptNote:
      'Может потребоваться адаптация для конкретных версий. Адаптацию для других модулей и шаблонов выполним&nbsp;<span style="background-color:rgb(40,167,69);color:rgb(255,255,255);font-size:12px;padding:0.25em 0.4em;text-align:center;vertical-align:baseline;">по запросу за ДОПОЛНИТЕЛЬНУЮ ПЛАТУ</span>.',
    licenseItems: [
      'приобретая дополнение, вы получаете доступ к бесплатным обновлениям и технической поддержке в течение года',
      'лицензия действует на один домен и все его поддомены, включая тестовые сайты',
      'информация о получении лицензии доступна после установки модуля',
      'активация лицензии — автоматически или вручную в течение часа после покупки',
      'полный текст: <a href="https://oc-max.com/docs/meest/license.md" target="_blank">Лицензионный договор (license.md)</a>',
    ],
    licenseFooter: 'Дополнение является авторской разработкой и защищено соответствующими правами.',
    requirements: ['ionCube Loader версии 5.0 и выше', 'PHP библиотека cURL', 'PHP версии 5.6 и выше'],
    warning:
      'Перед установкой на работающем интернет-магазине рекомендуем выполнить установку и тестирование модуля на тестовом сайте или поддомене!',
    instructionNote:
      'Подробная инструкция по установке, настройке, обновлению и удалению модуля доступна в архиве в файле instruction.html',
  },
};

const adminItemsUk = [
  'підтримка мультимагазинів',
  'завантаження базових налаштувань',
  'експорт/імпорт налаштувань',
  'режим налагодження',
  `введення ${brandStrong('API token')} та ID контракту Meest ПОШТА`,
  'завантаження логотипу транспортної компанії та вибір місця відображення',
  'TLS-верифікація',
  'налаштування cURL тайм-ауту підключення та виконання',
  ['налаштування доставки у відділення, поштомат та кур\'єром:', ['увімкнення/вимкнення способу доставки', 'редагована та багатомовна назва доставки', 'вибір географічної зони', 'вибір податкового класу', 'мінімальна та максимальна сума замовлення, при якій доставка доступна', 'мінімальна сума замовлення для безкоштовної доставки та текст безкоштовної доставки', 'увімкнення/вимкнення розрахунку вартості доставки через API або тарифні таблиці', 'увімкнення/вимкнення розрахунку терміну доставки', 'фільтр відділень і поштоматів за вагою', 'вибір типу відділення', 'вибір статусу відділення']],
  ['налаштування тарифного розрахунку:', ['тарифні таблиці для посилок та накладеного платежу', 'знижка на доставку та комісія за оголошену вартість']],
  ['робота з базою:', ['оновлення довідників Meest ПОШТА', 'оновлення областей', 'оновлення міст', 'оновлення відділень']],
  'налаштування відправника: відправник, телефон, область, місто, відділення; для адресного забору — адреса, будинок, квартира, поверх, корпус',
  'налаштування отримувача через макроси замовлення: ПІБ, телефон, місто, відділення, адреса, вулиця, будинок, квартира',
  ['налаштування параметрів відправлення:', ['увімкнення/вимкнення врахування об\'єму та варіант розрахунку', 'складники оголошеної вартості, значення та мінімум за замовчуванням', 'опис відправлення за замовчуванням з макросами замовлення та товару', 'вага, габарити та допуски за замовчуванням', 'спосіб застосування параметрів за замовчуванням']],
  ['налаштування параметрів оплати:', ['платник доставки за замовчуванням', 'форма оплати за замовчуванням (готівка/безготівка)', 'метод оплати для накладеного платежу', 'налаштування розрахунку накладеного платежу', 'контроль оплати та його складові', '№ картки для повернення коштів']],
  [`налаштування інтеграції ${brandStrong('ТТН')}:`, ['увімкнення/вимкнення відображення всіх накладних акаунта', 'інтервал автоматичної синхронізації', 'інформація для відображення в списку накладних', 'налаштування друку (формат, тип шаблону, місце друку)', 'формати друку: накладна, стікер 100×100, стікер 100×100 А4, вантажна декларація, реєстри', 'сумісний спосіб доставки для інтеграції з замовленнями', 'увімкнення/вимкнення створення, редагування, видалення та присвоєння накладної в замовленні', 'багатомовні назви пунктів меню для роботи з накладними в замовленні']],
  [`задачі ${brandStrong('Cron')}:`, ['ключ безпеки для Cron', 'автоматичне оновлення бази даних модуля (довідники, області, міста, відділення)', 'автоматичне відстеження відправлень, зміна статусів замовлень та відправлення сповіщень', 'налаштування залежностей статусів відправлення та статусів замовлення', 'шаблони e-mail/SMS для адміністратора та покупця з макросами замовлення та накладної']],
  'та інші стандартні опції модуля доставки',
];

const adminItemsEn = [
  'multistore support',
  'loading basic settings',
  'export/import of settings',
  'debug mode',
  `Meest POSHTA ${brandStrong('API token')} and contract ID`,
  'carrier logo upload and display location',
  'TLS verification',
  'cURL connection and execution timeouts',
  ['delivery settings for department, parcel locker, and courier:', ['enable/disable the method', 'editable multilingual name', 'geo zone', 'tax class', 'min/max order amount', 'free shipping and its text', 'cost via API or tariff tables', 'delivery time', 'weight filter for departments and lockers', 'department type', 'department status']],
  ['tariff calculation settings:', ['parcel and cash-on-delivery tables', 'delivery discount', 'declared-value commission']],
  ['database maintenance:', ['update Meest POSHTA references', 'regions', 'cities', 'departments']],
  'sender settings: name, phone, region, city, department; for address pickup — address, building, apartment, floor, block',
  'recipient settings via order field macros: name, phone, city, department, address, street, building, apartment',
  ['default shipment parameters:', ['volume calculation enable/type', 'declared-value components, default and minimum', 'description with order and product macros', 'weight, dimensions, and tolerances', 'how defaults are applied']],
  ['payment settings:', ['default delivery payer', 'payment form (cash/non-cash)', 'cash-on-delivery method', 'COD calculation', 'payment control and its components', 'refund card number']],
  [`${brandStrong('CN')} integration settings:`, ['display all account CNs', 'sync interval', 'CN list columns', 'print (format, template, position)', 'print formats — CN, 100×100 sticker, 100×100 A4 sticker, cargo declaration, registries', 'compatible delivery method', 'create, edit, delete, and assign a CN on the order', 'multilingual menu labels']],
  [`${brandStrong('Cron')} jobs:`, ['security key', 'automatic database update (references, regions, cities, departments)', 'shipment tracking, order status changes, and notifications', 'mapping of shipment statuses to order statuses', 'e-mail/SMS templates with order and CN macros']],
  'and other standard shipping module options',
];

const adminItemsRu = [
  'поддержка мультимагазинов',
  'загрузка базовых настроек',
  'экспорт/импорт настроек',
  'режим отладки',
  `${brandStrong('API token')} и ID контракта Meest ПОШТА`,
  'загрузка логотипа перевозчика и выбор места отображения',
  'TLS-верификация',
  'настройка cURL тайм-аутов подключения и выполнения',
  ['настройка доставки в отделение, почтомат и курьером:', ['включение/отключение способа доставки', 'редактируемое и мультиязычное название', 'географическая зона', 'налоговый класс', 'минимальная и максимальная сумма заказа', 'бесплатная доставка и ее текст', 'расчет стоимости через API или тарифные таблицы', 'расчет срока доставки', 'фильтр отделений и почтоматов по весу', 'тип отделения', 'статус отделения']],
  ['настройка тарифного расчета:', ['тарифные таблицы для посылок и наложенного платежа', 'скидка на доставку', 'комиссия за объявленную стоимость']],
  ['работа с базой:', ['обновление справочников Meest ПОШТА', 'обновление областей', 'обновление городов', 'обновление отделений']],
  'настройка отправителя: отправитель, телефон, область, город, отделение; для адресного забора — адрес, дом, квартира, этаж, корпус',
  'настройка получателя через макросы заказа: ФИО, телефон, город, отделение, адрес, улица, дом, квартира',
  ['настройка параметров отправления:', ['учет объема и вариант расчета', 'составные объявленной стоимости, значение и минимум', 'описание отправления с макросами заказа и товара', 'вес, габариты и допуски', 'способ применения параметров по умолчанию']],
  ['настройка параметров оплаты:', ['плательщик доставки по умолчанию', 'форма оплаты (наличные/безнал)', 'метод оплаты для наложенного платежа', 'расчет наложенного платежа', 'контроль оплаты и его составные', '№ карты для возврата средств']],
  [`настройка интеграции ${brandStrong('ТТН')}:`, ['отображение всех накладных аккаунта', 'интервал автоматической синхронизации', 'информация для списка накладных', 'настройка печати (формат, тип шаблона, место печати)', 'форматы печати: накладная, стикер 100×100, стикер 100×100 A4, грузовая декларация, реестры', 'совместимый способ доставки', 'создание, редактирование, удаление и присвоение накладной в заказе', 'мультиязычные названия пунктов меню']],
  [`задачи ${brandStrong('Cron')}:`, ['ключ безопасности для Cron', 'автоматическое обновление базы модуля (справочники, области, города, отделения)', 'автоматическое отслеживание отправлений, смена статусов заказов и уведомления', 'настройка зависимостей статусов отправления и заказа', 'шаблоны e-mail/SMS с макросами заказа и накладной']],
  'и другие стандартные опции модуля доставки',
];

const cnItemsUk = [
  'створення, редагування та видалення накладної',
  'робота з реєстрами: перегляд за датою відправки, створення, редагування, друк',
  'налаштування друку накладних та маркувань',
  'завантаження накладних, маркувань і декларацій у PDF для одного або декількох замовлень',
  'друк у браузері накладної та маркувань',
  'список накладних з фільтрами та сортуванням',
  'реєстр, друк, синхронізація',
  'автозаповнення відправника, отримувача, параметрів відправлення та оплати з даних замовлення',
  'складники оголошеної вартості та контролю оплати',
  'валідація полів перед передачею в API Meest',
  'підсвітка роздрукованих та видалених накладних у списку',
];

const cnItemsEn = [
  'create, edit, and delete consignment notes',
  'registries: view by dispatch date, create, edit, print',
  'print setup for CNs and labels',
  'download CNs, labels, and declarations as PDF for one or several orders',
  'browser printing of CNs and labels',
  'CN list with filters and sorting',
  'registry, print, sync',
  'auto-fill sender, recipient, shipment, and payment from the order',
  'declared-value and payment-control components',
  'field validation before Meest API submission',
  'highlight printed and deleted CNs in the list',
];

const cnItemsRu = [
  'создание, редактирование и удаление накладной',
  'реестры: просмотр по дате отправки, создание, редактирование, печать',
  'настройка печати накладных и маркировок',
  'загрузка накладных, маркировок и деклараций в PDF для одного или нескольких заказов',
  'печать в браузере накладной и маркировок',
  'список накладных с фильтрами и сортировкой',
  'реестр, печать, синхронизация',
  'автозаполнение отправителя, получателя, параметров отправления и оплаты из данных заказа',
  'составные объявленной стоимости и контроля оплаты',
  'валидация полей перед отправкой в API Meest',
  'подсветка распечатанных и удаленных накладных в списке',
];

const clientItemsUk = [
  ['тип доставки:', ['відділення', 'поштомат', "кур'єр на адресу"]],
  'вибір міста (список або пошук за назвою)',
  'вибір відділення або поштомату (список або пошук)',
  'адресна доставка: населений пункт, вулиця, будинок, квартира',
  'вартість та термін доставки',
];

const clientItemsEn = [
  ['delivery type:', ['department', 'parcel locker', 'courier to address']],
  'city selection (list or search)',
  'department or locker selection (list or search)',
  'address delivery: locality, street, building, apartment',
  'delivery cost and time',
];

const clientItemsRu = [
  ['тип доставки:', ['отделение', 'почтомат', 'курьер на адрес']],
  'выбор города (список или поиск)',
  'выбор отделения или почтомата (список или поиск)',
  'адресная доставка: населенный пункт, улица, дом, квартира',
  'стоимость и срок доставки',
];

const demoUrls = [
  'https://shipping.oc-max.com/admin/index.php?route=extension/shipping/meest',
  'https://shipping.oc-max.com/admin/index.php?route=extension/shipping/meest/getCNForm&amp;order_id=1313',
  'https://shipping.oc-max.com/admin/index.php?route=extension/shipping/meest/getCNList',
  'https://shipping.oc-max.com/',
];

function buildIntro(loc) {
  const paras = loc.intro
    .map(
      (p) => `\t<p style="color:#212529;font-size:1.25rem;">\n\t\t${p}\n\t</p>`,
    )
    .join('\n\n');
  const buttons = loc.demoButtons
    .map(
      (label, i) => `\t<p style="font-size:1.25rem;text-align:center;">\n\t\t${i === 1 ? '<span style="font-size:1.25rem;">&nbsp;</span>' : i === 2 ? '<span>&nbsp;</span>' : ''}<a href="${demoUrls[i]}" rel="external nofollow noopener" style="background-color:#007bff;border:1px solid #007bff;color:#ffffff;font-size:1.25rem;padding:0.5rem 1rem;${i === 0 || i === 3 ? 'text-align:center;' : ''}vertical-align:middle;" target="_blank">${label}</a>\n\t</p>\n\n\t<p style="font-size:1.25rem;text-align:center;">\n\t\t&nbsp;\n\t</p>`,
    )
    .join('\n');
  return `<div style="background-color:#e9ecef;color:#212529;font-size:16px;padding:4rem 2rem;text-align:left;">
${paras}

\t<hr style="border-top-color:rgba(0,0,0,0.1);border-top-style:solid;border-width:1px 0px 0px;">
\t<p>
\t\t&nbsp;
\t</p>

\t<p>
\t\t${loc.demoIntro}<span>&nbsp;</span><span style="background-color:#868e96;color:#ffffff;font-size:12px;padding:0.25em 0.4em;text-align:center;vertical-align:baseline;">demo</span>
\t</p>

\t<p style="font-size:1.25rem;text-align:center;">
\t\t&nbsp;
\t</p>

${buttons}</div>`;
}

function buildSpoiler(loc, adminItems, cnItems, clientItems) {
  return `\t\t<div>
\t\t\t<div>
\t\t\t\t<div class="ipsSpoiler" data-ipsspoiler="">
\t\t\t\t\t<div class="ipsSpoiler_header">
\t\t\t\t\t\t<span>${loc.sections.spoiler}</span>
\t\t\t\t\t</div>

\t\t\t\t\t<div class="ipsSpoiler_contents ipsClearfix" data-gramm="false">
\t\t\t\t\t\t<p>
\t\t\t\t\t\t\t&nbsp;
\t\t\t\t\t\t</p>

${h6(loc.sections.admin)}

${ul(adminItems)}

${h6(loc.sections.cn)}

\t\t\t<p style="background-color:#f8f9fa;color:#212529;font-size:16px;">
\t\t\t\t${loc.cnParagraph}
\t\t\t</p>

${ul(cnItems)}

${h6(loc.sections.client)}

${ul(clientItems)}

\t\t\t\t\t\t<p>
\t\t\t\t\t\t\t&nbsp;
\t\t\t\t\t\t</p>
\t\t\t\t\t</div>
\t\t\t\t</div>

\t\t\t\t<p>
\t\t\t\t\t&nbsp;
\t\t\t\t</p>
\t\t\t</div>
\t\t</div>`;
}

function buildLocale(key, loc, adminItems, cnItems, clientItems) {
  const intro = buildIntro(loc);
  const opportunities = card(
    loc.sections.features,
    `${h6(loc.sections.main)}

${ul(loc.mainFeatures)}

${buildSpoiler(loc, adminItems, cnItems, clientItems)}`,
  );
  const languages = card(
    loc.sections.languages,
    `\t\t<ul>
${loc.langList.map((l) => `\t\t\t<li>\n\t\t\t\t${l}\n\t\t\t</li>`).join('\n')}
\t\t</ul>

\t\t<p>
\t\t\t&nbsp;
\t\t</p>

\t\t<p style="background-color:#f8f9fa;color:#212529;font-size:16px;">
\t\t\t${loc.langNote}
\t\t</p>

\t\t<p>
\t\t\t&nbsp;
\t\t</p>`,
  );
  const compatibility = card(
    loc.sections.compatibility,
    `\t\t<ul>
${loc.compatList.map((l) => `\t\t\t<li>\n\t\t\t\t${l}\n\t\t\t</li>`).join('\n')}
\t\t</ul>

\t\t<p>
\t\t\t&nbsp;
\t\t</p>

\t\t<p style="background-color:#f8f9fa;color:#212529;font-size:16px;">
\t\t\t${loc.adaptNote}
\t\t</p>

\t\t<p>
\t\t\t&nbsp;
\t\t</p>`,
  );
  const license = card(
    loc.sections.license,
    `\t\t<ul>
${loc.licenseItems.map((l) => `\t\t\t<li>\n\t\t\t\t<span>&nbsp;</span>${l}\n\t\t\t</li>`).join('\n')}
\t\t</ul>

\t\t<p>
\t\t\t&nbsp;
\t\t</p>

\t\t<p>
\t\t\t${loc.licenseFooter}
\t\t</p>`,
  );
  const requirements = card(
    loc.sections.requirements,
    `\t\t<ul>
${loc.requirements.map((l) => `\t\t\t<li>\n\t\t\t\t${l}\n\t\t\t</li>`).join('\n')}
\t\t</ul>`,
  );
  const footer = `<p style="color:#212529;text-align:left;">
\t&nbsp;
</p>

<p style="color:#212529;text-align:left;">
\t<strong style="color:rgb(255,0,0);">${loc.warning}</strong>
</p>

<p style="color:#212529;text-align:left;">
\t&nbsp;
</p>

<p>
\t<strong>${loc.instructionNote}</strong>
</p>
`;
  return [intro, opportunities, languages, compatibility, license, requirements, footer].join('\n\n');
}

const adminMap = { uk: adminItemsUk, en: adminItemsEn, ru: adminItemsRu };
const cnMap = { uk: cnItemsUk, en: cnItemsEn, ru: cnItemsRu };
const clientMap = { uk: clientItemsUk, en: clientItemsEn, ru: clientItemsRu };

for (const key of ['uk', 'en', 'ru']) {
  const loc = locales[key];
  const html = buildLocale(key, loc, adminMap[key], cnMap[key], clientMap[key]);
  const outPath = path.join(OUT_DIR, loc.out);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`written ${outPath} (${html.length} bytes)`);
}
