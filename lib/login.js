var LoginStep = class {
  constructor(classes=[]) {
    this.element = document.createElement('div');
    this.element.classList.add('login-step');
    this.element.classList.add('native-key-bindings');
    //classes.forEach((c) => this.element.classList.add(c));

    let copy = document.createElement('div');
    let paragraph = document.createElement('p');
    paragraph.textContent = "Sign in with your login info.";
    copy.appendChild(paragraph);
    this.element.appendChild(copy);

    this.emailInput = document.createElement('input');
    this.emailInput.mini = '';
    //this.emailInput.type = 'text';
    this.emailInput.name = 'email';
    this.emailInput.placeholder = 'Email';
    this.emailInput.tabIndex = 1;
    this.element.appendChild(this.emailInput);

    this.passwordInput = document.createElement('input');
    this.emailInput.mini = '';
    //this.passwordInput.type = 'password';
    this.passwordInput.name = 'password';
    this.passwordInput.placeholder = 'Password';
    this.passwordInput.tabIndex = 2;
    this.element.appendChild(this.passwordInput);

    this.submitBtn = document.createElement('button');
    this.submitBtn.classList.add('cta-btn');
    this.submitBtn.textContent = "Sign in";
    this.element.appendChild(this.submitBtn);

    //utils.bindEnterToClick(this.emailInput, this.submitBtn);
    //utils.bindEnterToClick(this.passwordInput, this.submitBtn);

    let links = document.createElement('div');
    links.classList.add('secondary-cta-section');
    this.element.appendChild(links);

    this.cancelLink = document.createElement('a');
    this.cancelLink.textContent = "Cancel";
    links.appendChild(this.cancelLink);

    this.resetLink = document.createElement('a');
    this.resetLink.textContent = "Forgot password";
    links.appendChild(this.resetLink);
  }

  destroy() {
    this.element.remove();
  }

  hide() {
    this.hideStatus();
    this.element.classList.add('hidden');
  }

  show() {
    this.element.classList.remove('hidden');
    this.emailInput.focus();
    this.emailInput.setSelectionRange(0, this.emailInput.value.length);
  }

  setEmail(email) {
    this.emailInput.value = email;
  }

  showStatus(text) {
    this.status.textContent = text;
    this.status.classList.remove('error');
    this.status.classList.remove('hidden');
  }

  hideStatus() {
    this.status.textContent = "";
    this.status.classList.remove('error');
    this.status.classList.add('hidden');
  }

  showError(text) {
    this.status.textContent = text;
    this.status.classList.add('error');
    this.status.classList.remove('hidden');
  }

  hideError() {
    this.hideStatus();
  }

  onSubmit(func) {
    this.submitBtn.onclick = func;
  }

  onCancel(func) {
    this.cancelLink.onclick = func;
  }

  onReset(func) {
    this.resetLink.onclick = func;
  }

  get email() {
    return this.emailInput.value;
  }

  get password() {
    return this.passwordInput.value;
  }
};

module.exports = LoginStep;
