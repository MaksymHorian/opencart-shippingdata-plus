(function (data) {
  function setVal(name, value) {
    const el = document.querySelector('[name="' + name + '"]');
    if (!el) {
      return false;
    }
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function setEditor(name, html) {
    const ta = document.querySelector('textarea[name="' + name + '"]');
    if (!ta) {
      return 'missing';
    }
    ta.value = html;
    if (typeof CKEDITOR !== 'undefined') {
      for (const k in CKEDITOR.instances) {
        if (CKEDITOR.instances[k].element && CKEDITOR.instances[k].element.$ === ta) {
          CKEDITOR.instances[k].setData(html);
          return 'ck';
        }
      }
    }
    return 'ta';
  }

  function clickRadio(name, value) {
    const el = document.querySelector('[name="' + name + '"][value="' + value + '"]');
    if (el) {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  function clickCheckbox(name, value) {
    const el = document.querySelector('[name="' + name + '"][value="' + value + '"]');
    if (el) {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  const r = {};
  r.title5 = setVal('file_lang_title[5]', data.title5);
  r.title1 = setVal('file_lang_title[1]', data.title1);
  r.title2 = setVal('file_lang_title[2]', data.title2);
  r.short5 = setEditor('file_desc_short[5]', data.short5);
  r.short1 = setEditor('file_desc_short[1]', data.short1);
  r.short2 = setEditor('file_desc_short[2]', data.short2);
  r.desc5 = setEditor('file_description[5]', data.description5);
  clickRadio('file_cost_type', 'paid');
  r.priceUAH = setVal('file_cost[UAH]', '1300');
  r.priceUSD = setVal('file_cost[USD]', '');
  clickRadio('file_renewals', '0');

  const services = [
    { key: 'Встановлення та оновлення', uah: '400.00', usd: '9.00' },
    { key: 'Адаптація', uah: '600.00', usd: '13.49' },
    { key: 'Підтримати проект', uah: '300.00', usd: '6.75' },
  ];
  services.forEach(function (s, i) {
    setVal('service[' + i + '][key]', s.key);
    setVal('service[' + i + '][value][UAH]', s.uah);
    setVal('service[' + i + '][value][USD]', s.usd);
  });

  clickCheckbox('downloads_field_12_checkbox', '1');
  setVal('downloads_field_13', 'Да');
  ['Українська', 'Англійська', 'Російська'].forEach(function (v) {
    clickCheckbox('downloads_field_29[]', v);
  });
  ['Українська', 'Англійська', 'Російська'].forEach(function (v) {
    clickCheckbox('downloads_field_30[]', v);
  });
  ['3.0', '2.3', '2.2', '2.1', '2.0', '1.5.6.4', '1.5.6.3', '1.5.6.2', '1.5.6.1', '1.5.6', '1.5.5.1', '1.5.5', '1.5.4.1', '1.5.3.1'].forEach(function (v) {
    clickCheckbox('downloads_field_3[]', v);
  });
  ['3.0', '2.3.0.2.4', '2.3', '2.2', '2.1', '1.5.5.1.2', '1.5.5.1.1', '1.5.5.1', '1.5.4.1.2', '1.5.4.1.1', '1.5.4.1', '1.5.3.1', '1.5.2.1', '1.5.1.3'].forEach(function (v) {
    clickCheckbox('downloads_field_5[]', v);
  });
  ['Opencart.pro 2.3', 'Opencart.pro 2.1', 'OcShop 2.0.3.х', 'OcShop 1.5.6.4.х'].forEach(function (v) {
    clickCheckbox('downloads_field_9[]', v);
  });
  setVal('downloads_field_2', 'На один домен + його піддомен');
  setVal('downloads_field_4', 'PHP library CURL, PHP version 5.6 and higher');
  clickCheckbox('downloads_field_6[]', 'За запитом в приватні повідомлення');
  setVal('downloads_field_10', 'Так');
  setVal('downloads_field_16[1]', '1');
  setVal('downloads_field_20[0]', '1');
  setVal('downloads_field_26', 'Всі шаблони. Може знадобитись додаткова адаптація під модуль оформлення замовлень.');
  setVal('downloads_field_28', '0');

  const primary = document.querySelector('[name="file_primary_screenshot"]');
  if (primary) {
    primary.checked = true;
  }

  return JSON.stringify(r);
});
