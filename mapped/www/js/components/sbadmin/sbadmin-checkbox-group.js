export function load(ctx) {
  let componentName = 'sbadmin-checkbox-group';
  let count = -1;
  customElements.define(componentName, class sbadmin_checkbox_group extends HTMLElement {
    constructor() {
      super();
      count++;
      this.attachShadow({ mode: 'open' });
      const html = `
<style>

.form-check {
  display: block;
  min-height: 1.5rem;
  padding-left: 1.5em;
  margin-bottom: 0.125rem;
}
.form-check .form-check-input {
  float: left;
  margin-left: -1.5em;
}
.form-check-input {
  width: 1em;
  height: 1em;
  margin-top: 0.25em;
  vertical-align: top;
  background-color: #fff;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  border: 1px solid rgba(0, 0, 0, 0.25);
  -webkit-appearance: none;
     -moz-appearance: none;
          appearance: none;
  -webkit-print-color-adjust: exact;
          color-adjust: exact;
}
.form-check-input[type=checkbox] {
  border-radius: 0.25em;
}
.form-check-input[type=radio] {
  border-radius: 50%;
}
.form-check-input:active {
  filter: brightness(90%);
}
.form-check-input:focus {
  border-color: transparent;
  outline: 0;
  box-shadow: 0 0 0 0.25rem rgba(0, 97, 242, 0.25);
}
.form-check-input:checked {
  background-color: #0061f2;
  border-color: #0061f2;
}
.form-check-input:checked[type=checkbox] {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M6 10l3 3l6-6'/%3e%3c/svg%3e");
}
.form-check-input:checked[type=radio] {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='2' fill='%23fff'/%3e%3c/svg%3e");
}
.form-check-input[type=checkbox]:indeterminate {
  background-color: #0061f2;
  border-color: #0061f2;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M6 10h8'/%3e%3c/svg%3e");
}
.form-check-input:disabled {
  pointer-events: none;
  filter: none;
  opacity: 0.5;
}
.form-check-input[disabled] ~ .form-check-label, .form-check-input:disabled ~ .form-check-label {
  opacity: 0.5;
}
.form-check-inline {
  display: inline-block;
  margin-right: 1rem;
}
.form-switch {
  padding-left: 2.5em;
}
.form-switch .form-check-input {
  width: 2em;
  margin-left: -2.5em;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='rgba%280, 0, 0, 0.25%29'/%3e%3c/svg%3e");
  background-position: left center;
  border-radius: 2em;
  transition: background-position 0.15s ease-in-out;
}
@media (prefers-reduced-motion: reduce) {
  .form-switch .form-check-input {
    transition: none;
  }
}

.form-switch .form-check-input:checked {
  background-position: right center;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23fff'/%3e%3c/svg%3e");
}

.form-label {
    margin-bottom: 0.5rem;
}
label {
    display: inline-block;
}
.label-hidden {
    display: none;
}


*, ::before, ::after {
    box-sizing: border-box;
}
  
</style>

<div>
  <div golgi:prop="label"></div>
  <br golgi:prop="lnBreak" />
  <div golgi:prop="childrenTarget"></div>
</div>
  `;
      this.shadowRoot.innerHTML = `${html}`;
      this.name = componentName + '-' + count;
      
    }

    async setState(state) {
      if (state.name) {
        this.name = state.name;
        if (this.form) {
          this.form.fieldsByName.set(state.name, this);
        }
      }
      if (state.value) {
        // dynamically add a single checkbox
        let cb = await this.renderComponent('sbadmin-checkbox', this.childrenTarget, this.context);
        this.emit('cbReady', cb);
        cb.value = state.value;

        if (state.label) {
          cb.labelText = state.label;
        }
        if (typeof state.title === 'undefined') {
          this.label.className = 'label-hidden';
          this.lnBreak.className = 'label-hidden';
        }
        else {
          this.label.textContent = state.title;
        }
        if (state.switch) {
          cb.switch = true;
        }
        if (state.offValue) {
          this.offValue = state.offValue;
        }
        if (state.checked) {
          cb.check();
        }
        if (state.scale) {
          cb.checkbox.style.transform = 'scale(' + +state.scale + ')';
        }
        this.cb = cb;
        return;
      }
      if (state.label) {
        this.label.textContent = state.label;
      }
      if (state.style) {
        this.label.style = state.style;
      }
    }

    onBeforeState() {
      this.type = 'checkbox';
      this.valuesById = new Map();
      this.count = 0;
      this.checkboxes = [];
      this.form = this.getParentComponent('sbadmin-form');
      if (this.form) {
        this.form.fields.push(this);
      }
    }

    get checked() {
      if (this.count === 1) {
        let value = this.values();
        if (value) return true;
        return false;
      }
    }

    get value() {
      let values = [];
      this.valuesById.forEach(function(value) {
        values.push(value);
      });
      if (this.count === 1) {
        if (values.length === 1) {
          return values[0];
        }
        else {
          return this.offValue || false;
        }
      }
      else {
        return values;
      }
    }

    get values() {
      return this.value;
    }

    getCheckboxByValue(val) {
      let cb;
      for (cb of this.checkboxes) {
        if (cb.value === val) return cb;
      }
      return false;
    }

    checkByValue(val) {
      let cb = this.getCheckboxByValue(val);
      if (cb) cb.check();
    }

    uncheckByValue(val) {
      let cb = this.getCheckboxByValue(val);
      if (cb) cb.uncheck();
    }

    async renderCheckboxes(arr) {
      // [{value: 'red', label: 'Red', checked: true}, {value: 'green', label: 'green'}]
      // specify the method setState in the StateMap to get these applied automatically

      await this.renderComponentMap('sbadmin-checkbox', this.childrenTarget, this.context, arr, 'cb_items:setState');
    }

  
  });
};