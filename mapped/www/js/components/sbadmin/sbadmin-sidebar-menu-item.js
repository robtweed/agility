export function load(ctx) {
  let componentName = 'sbadmin-sidebar-menu-item';
  let count = -1;
  customElements.define(componentName, class sbadmin_sidebar_menu_item extends HTMLElement {
    constructor() {
      super();
      count++;
      this.attachShadow({ mode: 'open' });
      const html = `
<style>

.nav-link.active {
  font-weight: 600;
  color: #0061f2;
}
.nav-link {
  color: #212832;
  display: flex;
  align-items: center;
  line-height: normal;
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
  position: relative;
  padding: 0.5rem 1rem;
  transition: color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out;
}
a {
  text-decoration: none;
  font-size: .9rem;
}
.nav-link.active .nav-link-icon {
    color: #0061f2;
}

.nav-link .nav-link-icon {
  color: #a7aeb8;
  margin-right: 0.5rem;
  font-size: .9rem;
  padding-right: 0.5rem;
  display: inline-flex;
}

.d-none {
  display: none !important;
}

*, ::before, ::after {
    box-sizing: border-box;
}
  
</style>

<a class="nav-link" golgi:prop="aTag" href="#" golgi:on_click="switchPage">
  <div golgi:prop="iconDiv" class="nav-link-icon">
    <i golgi:prop="iTag"></i>
  </div>
  <span golgi:prop="textTarget"></span>
</a>
  `;
      this.shadowRoot.innerHTML = `${html}`;
      this.name = componentName + '-' + count;
      
    }


    onBeforeState() {
      this.hasIcon = true;
    }

    setState(state) {
      if (state.name) {
        this.name = state.name;
      }
      if (state.contentPage) {
        if (this.contentPage !== state.contentPage) {
          this.contentPage = state.contentPage;
        }
      }
      if (state.text) {
        this.textTarget.textContent = state.text;
      }
      if (state.iconName) {
        if (this.iconName !== state.iconName) {
          this.iTag.setAttribute('data-feather', state.iconName);
          this.iconName = state.iconName;
          this.renderIcon();
        }
      }
      if (!state.iconName && this.iconDiv.parentNode) {
        this.aTag.removeChild(this.iconDiv);
        this.hasIcon = false;
      }
      if (state.href) {
        this.aTag.href = state.href;
      }
      if (state.active === true) {
        this.switchPage();
      }
    }

    set ContentPage(value) {
      this.contentPage = value;
    }

    set text(value) {
      this.textTarget.textContent = value;
    }

    set icon(value) {
      this.iTag.setAttribute('data-feather', value);
      this.iconName = value;
      this.renderIcon();
    }

    show() {
      this.rootElement.classList.remove('d-none');
    }

    hide() {
      this.rootElement.classList.add('d-none');
    }

    set isActive(active) {
      if (active) {
        this.aTag.classList.add('active');
      }
      else {
        this.aTag.classList.remove('active');
      }
    }

    setActive() {
      this.aTag.classList.add('active');
    }

    setInactive() {
      this.aTag.classList.remove('active');
    }

    switchToActive() {
      this.switchPage();
    }

    isParentMenuComponent(menuComponent) {
      let found = false;
      let ok = true;
      let thisMenuComponent = this;
      let parentMenuComponent;

      do {
        parentMenuComponent = thisMenuComponent.parentMenuComponent;
        if (!parentMenuComponent) {
          ok = false;
          return;
        }
        if (parentMenuComponent === menuComponent) {
          found = true;
          ok = false;
        }
        thisMenuComponent = parentMenuComponent;
      }
      while (ok);

      return found;
    }

    async switchPage() {
      let activeMenuComponent = this.rootMenu.getMenuItemActive();
      if (activeMenuComponent) {
        // if you've reclicked the active item, ignore
        if (activeMenuComponent === this) {
          if (this.rootComponent.shouldSidebarHide) {
            this.rootComponent.hideSideNav();
          }
          return;
        }

        if (activeMenuComponent.menuType === 'item') {
          activeMenuComponent.isActive = false;
        }
        else {

          // is the currently selected item a parent of this item?

          if (this.isParentMenuComponent(activeMenuComponent)) {
            // just remove the parent's selected highlight but leave expanded
            activeMenuComponent.highlight = false;
          }
          else {
            // deactivate and collapse previous menu option
            activeMenuComponent.isActive = false;
          }
        } 
      }
      // make this the currently active menu item
      this.isActive = true;
      // switch to this item's content page
      if (this.contentPage) {
        await this.rootMenu.switchToPage(this, this.contentPage);
      }
      // collapse the menu if the screen is too narrow
      if (this.rootComponent.shouldSidebarHide) {
        this.rootComponent.hideSideNav();
      }
      this.emit('menuItemSelected', {
        active: this,
        inactive: activeMenuComponent,
      });
    }

    renderIcon() {
      if (typeof feather !== 'undefined' && this.hasIcon) {
        this.rootComponent.toSVG(this.iTag);
      }
    }

    onBeforeState() {
      this.hasIcon = true;
      this.menuType = 'item';
      if (this.parentComponent.componentName === 'sbadmin-sidebar-menu') {
        this.rootMenu = this.parentComponent;
      }
      else {
        if (this.parentComponent.rootMenu) {
          this.rootMenu = this.parentComponent.rootMenu;
          this.parentMenuComponent = this.parentComponent;
        }
      }
    }

    onAfterHooks() {
      this.renderIcon();
    }

  
  });
};