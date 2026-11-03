<?php /* "Shipping Data Plus" - module for OpenCart | (c) 2015-2026 OC Max | MIT. Attribution required: Prorab337 / OC Max, https://oc-max.com */ ?>
<?php echo $header; ?><?php echo $column_left; ?>
<div id="content">
  <div class="page-header">
    <div class="container-fluid">
      <div class="pull-right">
        <button type="submit" form="form-shippingdata-plus" data-toggle="tooltip" title="<?php echo $button_save; ?>" class="btn btn-primary"><i class="fa fa-save"></i></button>
        <a href="<?php echo $cancel; ?>" data-toggle="tooltip" title="<?php echo $button_cancel; ?>" class="btn btn-default"><i class="fa fa-reply"></i></a>
      </div>
      <h1><i class="fa fa-truck"></i> <?php echo $heading_title; ?></h1>
      <ul class="breadcrumb">
        <?php foreach ($breadcrumbs as $breadcrumb) { ?>
        <li><a href="<?php echo $breadcrumb['href']; ?>"><?php echo $breadcrumb['text']; ?></a></li>
        <?php } ?>
      </ul>
    </div>
  </div>
  <div class="container-fluid">
    <?php if ($error_warning) { ?>
    <div class="alert alert-danger alert-dismissible"><i class="fa fa-exclamation-circle"></i> <?php echo $error_warning; ?>
      <button type="button" class="close" data-dismiss="alert">&times;</button>
    </div>
    <?php } ?>
    <div class="panel panel-default">
      <div class="panel-heading">
        <h3 class="panel-title"><i class="fa fa-pencil"></i> <?php echo $text_edit; ?></h3>
      </div>
      <div class="panel-body">
        <ul class="nav nav-tabs">
          <li class="active"><a href="#tab-general" data-toggle="tab"><?php echo $tab_general; ?></a></li>
          <li><a href="#tab-backup" data-toggle="tab"><?php echo $tab_backup; ?></a></li>
        </ul>
        <div class="tab-content">
          <div class="tab-pane active" id="tab-general">
            <form action="<?php echo $action; ?>" method="post" enctype="multipart/form-data" id="form-shippingdata-plus" class="form-horizontal">
              <?php
              $sdp_fields = array(
                array('shippingdata_plus_status', 'entry_status', '', 'input-status'),
                array('shippingdata_plus_navbar', 'entry_navbar', 'help_navbar', 'input-navbar'),
                array('shippingdata_plus_order_list', 'entry_order_list', 'help_order_list', 'input-order-list'),
                array('shippingdata_plus_order_info', 'entry_order_info', 'help_order_info', 'input-order-info'),
                array('shippingdata_plus_account', 'entry_account', 'help_account', 'input-account')
              );
              foreach ($sdp_fields as $sdp_field) {
                $sdp_key = $sdp_field[0];
                $sdp_on = !empty($$sdp_key);
              ?>
              <div class="form-group">
                <label class="col-sm-2 control-label"><?php echo ${$sdp_field[1]}; ?></label>
                <div class="col-sm-10">
                  <div class="btn-group" data-toggle="buttons">
                    <label class="btn btn-default<?php echo $sdp_on ? ' active' : ''; ?>">
                      <input type="radio" name="<?php echo $sdp_key; ?>" id="<?php echo $sdp_field[3]; ?>" value="1" autocomplete="off"<?php echo $sdp_on ? ' checked="checked"' : ''; ?>> <?php echo $text_enabled; ?>
                    </label>
                    <label class="btn btn-default<?php echo $sdp_on ? '' : ' active'; ?>">
                      <input type="radio" name="<?php echo $sdp_key; ?>" value="0" autocomplete="off"<?php echo $sdp_on ? '' : ' checked="checked"'; ?>> <?php echo $text_disabled; ?>
                    </label>
                  </div>
                  <?php if ($sdp_field[2] !== '') { ?>
                  <p class="help-block"><?php echo ${$sdp_field[2]}; ?></p>
                  <?php } ?>
                </div>
              </div>
              <?php } ?>
            </form>
          </div>
          <div class="tab-pane" id="tab-backup">
            <?php $sdp_i = 0; $sdp_count = count($carriers); ?>
            <?php foreach ($carriers as $carrier) { ?>
            <?php if ($sdp_i % 2 == 0) { ?>
            <div class="row">
            <?php } ?>
              <div class="col-sm-6">
                <div class="panel panel-default sdp-carrier-panel sdp-carrier-<?php echo $carrier['code']; ?>">
                  <div class="panel-heading">
                    <h3 class="panel-title"><i class="fa fa-database"></i> <?php echo $carrier['name']; ?> — <?php echo $text_backup; ?></h3>
                  </div>
                  <div class="panel-body">
                    <p><?php echo $text_last_backup; ?>: <strong id="sdp-backed-up-<?php echo $carrier['code']; ?>"><?php echo $carrier['backed_up'] ? $carrier['backed_up'] : $text_none; ?></strong></p>
                    <div class="table-responsive">
                      <table class="table table-bordered">
                        <thead>
                          <tr>
                            <td><?php echo $column_directory; ?></td>
                            <td class="text-right"><?php echo $column_live; ?></td>
                            <td class="text-right"><?php echo $column_spare; ?></td>
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
                            <td class="text-right" id="sdp-live-<?php echo $carrier['code']; ?>-<?php echo $row['name']; ?>"><?php echo $row['live']; ?></td>
                            <td class="text-right" id="sdp-spare-<?php echo $carrier['code']; ?>-<?php echo $row['name']; ?>"><?php echo $row['spare']; ?></td>
                          </tr>
                          <?php } ?>
                        </tbody>
                      </table>
                    </div>
                    <button type="button" class="btn btn-primary sdp-backup" data-carrier="<?php echo $carrier['code']; ?>"><i class="fa fa-download"></i> <?php echo $button_backup; ?></button>
                    <button type="button" class="btn btn-danger sdp-restore" data-carrier="<?php echo $carrier['code']; ?>"><i class="fa fa-undo"></i> <?php echo $button_restore; ?></button>
                  </div>
                </div>
              </div>
            <?php if ($sdp_i % 2 == 1 || $sdp_i == $sdp_count - 1) { ?>
            </div>
            <?php } ?>
            <?php $sdp_i++; ?>
            <?php } ?>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<style type="text/css">
.sdp-carrier-panel { border-left-width: 4px; border-left-style: solid; }
.sdp-carrier-novaposhta { border-left-color: #ff392e; }
.sdp-carrier-rozetka_delivery { border-left-color: #00A046; }
.sdp-carrier-ukrposhta { border-left-color: #ffce2f; }
.sdp-carrier-meest { border-left-color: #deebf5; }
</style>
<script type="text/javascript"><!--
var sdpToken = <?php echo json_encode($token); ?>;
var sdpNone = <?php echo json_encode($text_none); ?>;
var sdpFailed = <?php echo json_encode($error_failed); ?>;
var sdpConfirm = <?php echo json_encode($text_confirm_restore); ?>;
var sdpSuccessBackup = <?php echo json_encode($success_backup); ?>;
var sdpSuccessRestore = <?php echo json_encode($success_restore); ?>;

function sdpAlert(kind, message) {
  var $box = $('<div class="alert alert-dismissible">').addClass(kind === 'success' ? 'alert-success' : 'alert-danger');

  $box.append($('<i class="fa">').addClass(kind === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'));
  $box.append(document.createTextNode(' ' + message + ' '));
  $box.append('<button type="button" class="close" data-dismiss="alert">&times;</button>');
  $('#content > .container-fluid').prepend($box);
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
  var iconClass = '';

  $.ajax({
    url: 'index.php?route=extension/module/shippingdata_plus/' + action + '&token=' + encodeURIComponent(sdpToken),
    type: 'POST',
    data: { carrier: carrier },
    dataType: 'json',
    timeout: 0,
    beforeSend: function() {
      var $icon = $button.find('i');

      iconClass = $icon.attr('class');
      $button.prop('disabled', true);
      $icon.attr('class', 'fa fa-spinner fa-spin');
    },
    complete: function() {
      $button.prop('disabled', false);
      $button.find('i').attr('class', iconClass);
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

$('.sdp-backup').on('click', function() {
  sdpAction('backup', $(this).attr('data-carrier'), $(this));
});

$('.sdp-restore').on('click', function() {
  if (!confirm(sdpConfirm)) {
    return;
  }

  sdpAction('restore', $(this).attr('data-carrier'), $(this));
});
//--></script>
<?php echo $footer; ?>
