<?php /* "Shipping Data Plus" - module for OpenCart | (c) 2015-2026 OC Max | MIT. Attribution required: Prorab337 / OC Max, https://oc-max.com */ ?>
<?php echo $header; ?>
<div id="content" class="sdp-page">
  <div class="breadcrumb">
    <?php foreach ($breadcrumbs as $breadcrumb) { ?>
    <?php echo $breadcrumb['separator']; ?><a href="<?php echo $breadcrumb['href']; ?>"><?php echo $breadcrumb['text']; ?></a>
    <?php } ?>
  </div>
  <div class="sdp-actions">
    <a onclick="$('#form-shippingdata-plus').submit();" class="sdp-btn sdp-btn-primary sdp-tip" data-sdp-tip="<?php echo htmlspecialchars($button_save, ENT_QUOTES, 'UTF-8'); ?>"><?php echo $button_save; ?></a>
    <a href="<?php echo $cancel; ?>" class="sdp-btn sdp-tip" data-sdp-tip="<?php echo htmlspecialchars($button_cancel, ENT_QUOTES, 'UTF-8'); ?>"><?php echo $button_cancel; ?></a>
  </div>
  <h1><?php echo $heading_title; ?></h1>
  <?php if ($error_warning) { ?>
  <div class="sdp-alert sdp-alert-danger"><?php echo $error_warning; ?> <button type="button" class="sdp-close">&times;</button></div>
  <?php } ?>
  <div class="sdp-panel">
    <div class="sdp-panel-head"><?php echo $text_edit; ?></div>
    <div class="sdp-panel-body">
      <ul class="sdp-tabs">
        <li class="active"><a href="#tab-general"><?php echo $tab_general; ?></a></li>
        <li><a href="#tab-backup"><?php echo $tab_backup; ?></a></li>
      </ul>
      <div class="sdp-tab active" id="tab-general">
        <form action="<?php echo $action; ?>" method="post" enctype="multipart/form-data" id="form-shippingdata-plus">
          <?php
          $sdp_fields = array(
            array('shippingdata_plus_status', 'entry_status', ''),
            array('shippingdata_plus_navbar', 'entry_navbar', 'help_navbar'),
            array('shippingdata_plus_order_list', 'entry_order_list', 'help_order_list'),
            array('shippingdata_plus_order_info', 'entry_order_info', 'help_order_info'),
            array('shippingdata_plus_account', 'entry_account', 'help_account')
          );
          foreach ($sdp_fields as $sdp_field) {
            $sdp_key = $sdp_field[0];
            $sdp_on = !empty($$sdp_key);
          ?>
          <div class="sdp-form-row">
            <div class="sdp-label"><?php echo ${$sdp_field[1]}; ?></div>
            <div class="sdp-field">
              <label class="sdp-choice<?php echo $sdp_on ? ' active' : ''; ?>"><input type="radio" name="<?php echo $sdp_key; ?>" value="1"<?php echo $sdp_on ? ' checked="checked"' : ''; ?> /> <?php echo $text_enabled; ?></label>
              <label class="sdp-choice<?php echo $sdp_on ? '' : ' active'; ?>"><input type="radio" name="<?php echo $sdp_key; ?>" value="0"<?php echo $sdp_on ? '' : ' checked="checked"'; ?> /> <?php echo $text_disabled; ?></label>
              <?php if ($sdp_field[2] !== '') { ?><p class="sdp-help"><?php echo ${$sdp_field[2]}; ?></p><?php } ?>
            </div>
          </div>
          <?php } ?>
        </form>
      </div>
      <div class="sdp-tab" id="tab-backup">
        <div class="sdp-cols">
          <?php foreach ($carriers as $carrier) { ?>
          <div class="sdp-col">
            <div class="sdp-panel sdp-carrier sdp-carrier-<?php echo $carrier['code']; ?>">
              <div class="sdp-panel-head"><?php echo $carrier['name']; ?> — <?php echo $text_backup; ?></div>
              <div class="sdp-panel-body">
                <p><?php echo $text_last_backup; ?>: <strong id="sdp-backed-up-<?php echo $carrier['code']; ?>"><?php echo $carrier['backed_up'] ? $carrier['backed_up'] : $text_none; ?></strong></p>
                <table class="sdp-table">
                  <thead>
                    <tr>
                      <td><?php echo $column_directory; ?></td>
                      <td class="sdp-right"><?php echo $column_live; ?></td>
                      <td class="sdp-right"><?php echo $column_spare; ?></td>
                    </tr>
                  </thead>
                  <tbody>
                    <?php foreach ($carrier['tables'] as $row) { ?>
                    <tr>
                      <td>
                        <?php if ($row['kind'] == 'cities') { ?><?php echo $text_cities; ?>
                        <?php } elseif ($row['kind'] == 'departments') { ?><?php echo $text_departments; ?>
                        <?php } elseif ($row['kind'] == 'regions') { ?><?php echo $text_regions; ?>
                        <?php } else { ?><?php echo $text_references; ?>
                        <?php } ?>
                      </td>
                      <td class="sdp-right" id="sdp-live-<?php echo $carrier['code']; ?>-<?php echo $row['name']; ?>"><?php echo (int)$row['live']; ?></td>
                      <td class="sdp-right" id="sdp-spare-<?php echo $carrier['code']; ?>-<?php echo $row['name']; ?>"><?php echo (int)$row['spare']; ?></td>
                    </tr>
                    <?php } ?>
                  </tbody>
                </table>
                <button type="button" class="sdp-btn sdp-btn-primary sdp-backup" data-carrier="<?php echo $carrier['code']; ?>"><?php echo $button_backup; ?></button>
                <button type="button" class="sdp-btn sdp-btn-danger sdp-restore" data-carrier="<?php echo $carrier['code']; ?>"><?php echo $button_restore; ?></button>
              </div>
            </div>
          </div>
          <?php } ?>
        </div>
      </div>
    </div>
  </div>
</div>
<script type="text/javascript"><!--
var sdpToken = <?php echo json_encode($token); ?>;
var sdpNone = <?php echo json_encode($text_none); ?>;
var sdpFailed = <?php echo json_encode($error_failed); ?>;
var sdpConfirm = <?php echo json_encode($text_confirm_restore); ?>;
var sdpSuccessBackup = <?php echo json_encode($success_backup); ?>;
var sdpSuccessRestore = <?php echo json_encode($success_restore); ?>;

$('.sdp-tabs a').click(function(e) {
  e.preventDefault();
  $('.sdp-tabs li').removeClass('active');
  $(this).parent().addClass('active');
  $('.sdp-tab').removeClass('active');
  $($(this).attr('href')).addClass('active');
});

$('.sdp-choice input').change(function() {
  var name = $(this).attr('name');
  $('input[name="' + name + '"]').each(function() {
    $(this).parent().toggleClass('active', this.checked);
  });
});

$('.sdp-close').click(function() {
  $(this).parent().remove();
});

function sdpAlert(kind, message) {
  var box = $('<div class="sdp-alert">').addClass(kind === 'success' ? 'sdp-alert-success' : 'sdp-alert-danger');
  box.append(document.createTextNode(message + ' '));
  box.append('<button type="button" class="sdp-close">&times;</button>');
  box.find('.sdp-close').click(function() { $(this).parent().remove(); });
  $('#content').prepend(box);
}

function sdpApply(carrier, json) {
  if (!json.tables) {
    return;
  }
  $.each(json.tables, function(_, row) {
    $('#sdp-live-' + carrier + '-' + row.name).text(row.live);
    $('#sdp-spare-' + carrier + '-' + row.name).text(row.spare);
  });
  $('#sdp-backed-up-' + carrier).text(json.backed_up ? json.backed_up : sdpNone);
}

function sdpAction(action, carrier, $button) {
  var label = $button.text();
  $.ajax({
    url: 'index.php?route=module/shippingdata_plus/' + action + '&token=' + encodeURIComponent(sdpToken),
    type: 'POST',
    data: { carrier: carrier },
    dataType: 'json',
    timeout: 0,
    beforeSend: function() {
      $button.attr('disabled', 'disabled').text('...');
    },
    complete: function() {
      $button.removeAttr('disabled').text(label);
    },
    success: function(json) {
      if (!json || json.error) {
        sdpAlert('danger', json && json.error ? json.error : sdpFailed);
        return;
      }
      sdpApply(carrier, json);
      sdpAlert('success', action === 'restore' ? sdpSuccessRestore : sdpSuccessBackup);
    },
    error: function() {
      sdpAlert('danger', sdpFailed);
    }
  });
}

$('.sdp-backup').click(function() {
  sdpAction('backup', $(this).attr('data-carrier'), $(this));
});

$('.sdp-restore').click(function() {
  if (!confirm(sdpConfirm)) {
    return;
  }
  sdpAction('restore', $(this).attr('data-carrier'), $(this));
});
//--></script>
<?php echo $footer; ?>
