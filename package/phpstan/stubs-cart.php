<?php

namespace Cart {
    class Cart {
        public function clear() {}
        public function add($product_id, $quantity = 1) {}
        public function getProducts() {}
    }
    class Customer {}
    class Currency {
        public function format($number, $currency, $value = '', $format = true) {}
        public function getValue($currency) {}
    }
    class Tax {
        public function calculate($value, $tax_class_id, $calculate = true) {}
        public function setShippingAddress($country_id, $zone_id) {}
        public function setPaymentAddress($country_id, $zone_id) {}
        public function setStoreAddress($country_id, $zone_id) {}
    }
    class Weight {}
    class Length {}
    class User {
        public function login($username, $password) {}
        public function hasPermission($key, $value) {}
    }
}
