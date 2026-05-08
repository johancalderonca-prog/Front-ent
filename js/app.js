/*
  Cliente frontend en JavaScript puro.

  Este archivo consume el backend REST que corre en http://localhost:9090.
  No usa frameworks. Solo fetch, DOM y un poco de lógica para:
  - consultar salud del backend
  - crear usuarios y productos
  - listar, actualizar y eliminar usuarios y productos
  - rellenar formularios de edición desde el id de la URL

  La idea es mantenerlo entendible para un estudiante, por eso la lógica
  está dividida en funciones pequeñas y con comentarios directos.
*/

(function () {
  const API_BASE = '';

  function $(selector, scope = document) {
    return scope.querySelector(selector);
  }

  function $all(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  }

  function getPageName() {
    const path = window.location.pathname.split('/').pop().toLowerCase();
    return path || 'index.html';
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      mode: 'cors',
      headers: {
        Accept: 'application/json',
        ...options.headers
      },
      ...options
    });

    const contentType = response.headers.get('content-type') || '';
    let data = null;

    if (response.status !== 204) {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    }

    if (!response.ok) {
      const message = data && typeof data === 'object' ? (data.mensaje || data.message || JSON.stringify(data)) : String(data || `Error HTTP ${response.status}`);
      throw new Error(message);
    }

    return data;
  }

  function setMessage(target, text, kind = 'info') {
    if (!target) {
      return;
    }

    target.textContent = text;
    target.dataset.kind = kind;
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function productImageFor(product) {
    const name = String(product.nombre || '').toLowerCase();

    if (name.includes('guayo')) return 'img/guayo.png';
    if (name.includes('balón') || name.includes('balon')) return 'img/balonA.png';
    if (name.includes('uniforme')) return 'img/uniforme.png';
    if (name.includes('media')) return 'img/medias.png';
    if (name.includes('termo')) return 'img/termo.png';

    return 'img/crear.png';
  }

  function renderUsers(users, tbody) {
    if (!tbody) {
      return;
    }

    tbody.innerHTML = users.map((user) => `
      <tr>
        <td>${escapeHtml(user.nombre)}</td>
        <td>${escapeHtml(user.numeroDeTelefono)}</td>
        <td>${escapeHtml(user.edad)}</td>
        <td>${escapeHtml(user.contraseña)}</td>
        <td>${escapeHtml(user.correo)}</td>
        <td class="acciones">
          <form action="putuser.html" method="get">
            <input type="hidden" name="id" value="${user.id}">
            <button class="btn-put" type="submit">Actualizar</button>
          </form>
          <button class="btn-delete" data-user-id="${user.id}">Eliminar</button>
        </td>
      </tr>
    `).join('');

    $all('[data-user-id]', tbody).forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.getAttribute('data-user-id');

        if (!window.confirm('¿Estas seguro de eliminar este usuario?')) {
          return;
        }

        try {
          await request(`/api/usuarios/${id}`, { method: 'DELETE' });
          await loadUsersPage();
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function renderProducts(products, tbody) {
    if (!tbody) {
      return;
    }

    tbody.innerHTML = products.map((product) => `
      <tr>
        <td><img src="${productImageFor(product)}" alt="${escapeHtml(product.nombre)}" width="100" height="100"></td>
        <td>${escapeHtml(product.nombre)}</td>
        <td>${escapeHtml(product.categoria)}</td>
        <td>${escapeHtml(product.stock)}</td>
        <td>${escapeHtml(product.descripcion)}</td>
        <td>$${toNumber(product.precio).toFixed(2)}</td>
        <td class="acciones">
          <form action="actualizar.html" method="get">
            <input type="hidden" name="id" value="${product.id}">
            <button class="btn-put" type="submit">Actualizar</button>
          </form>
          <button class="btn-delete" data-product-id="${product.id}">Eliminar</button>
        </td>
      </tr>
    `).join('');

    $all('[data-product-id]', tbody).forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.getAttribute('data-product-id');

        if (!window.confirm('¿Estas seguro de eliminar este producto?')) {
          return;
        }

        try {
          await request(`/api/productos/${id}`, { method: 'DELETE' });
          await loadProductsPage();
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  function getFormValue(form, selector) {
    const field = $(selector, form);
    return field ? field.value.trim() : '';
  }

  async function loadUsersPage() {
    const tbody = $('#usersTableBody');
    const status = $('#usersStatus');

    if (!tbody) {
      return;
    }

    try {
      setMessage(status, 'Cargando usuarios desde el backend...', 'info');
      const users = await request('/api/usuarios');
      renderUsers(users, tbody);
      setMessage(status, `Usuarios cargados: ${users.length}`, 'success');
    } catch (error) {
      tbody.innerHTML = '';
      setMessage(status, `No se pudieron cargar los usuarios: ${error.message}`, 'error');
    }
  }

  async function loadProductsPage() {
    const tbody = $('#productsTableBody');
    const status = $('#productsStatus');

    if (!tbody) {
      return;
    }

    try {
      setMessage(status, 'Cargando productos desde el backend...', 'info');
      const products = await request('/api/productos');
      renderProducts(products, tbody);
      setMessage(status, `Productos cargados: ${products.length}`, 'success');
    } catch (error) {
      tbody.innerHTML = '';
      setMessage(status, `No se pudieron cargar los productos: ${error.message}`, 'error');
    }
  }

  async function submitUserForm(form, id) {
    const payload = {
      nombre: getFormValue(form, '#userName'),
      correo: getFormValue(form, '#userEmail'),
      edad: toNumber(getFormValue(form, '#userAge')),
      numeroDeTelefono: getFormValue(form, '#userPhone'),
      contraseña: getFormValue(form, '#userPassword')
    };

    const confirmPassword = getFormValue(form, '#userPasswordConfirm');

    if (payload.contraseña !== confirmPassword) {
      throw new Error('Las contraseñas no coinciden.');
    }

    const path = id ? `/api/usuarios/${id}` : '/api/usuarios';
    const method = id ? 'PUT' : 'POST';
    return request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async function submitProductForm(form, id) {
    const payload = {
      nombre: getFormValue(form, '#productName'),
      precio: toNumber(getFormValue(form, '#productPrice')),
      stock: Math.trunc(toNumber(getFormValue(form, '#productStock'))),
      categoria: getFormValue(form, '#productCategory'),
      descripcion: getFormValue(form, '#productDescription')
    };

    const path = id ? `/api/productos/${id}` : '/api/productos';
    const method = id ? 'PUT' : 'POST';
    return request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async function fillUserFormIfNeeded() {
    const form = $('#userForm');
    if (!form) {
      return;
    }

    const status = $('#userFormStatus');
    const id = new URLSearchParams(window.location.search).get('id');

    if (!id) {
      return;
    }

    try {
      setMessage(status, 'Cargando usuario...', 'info');
      const user = await request(`/api/usuarios/${id}`);
      $('#userName').value = user.nombre || '';
      $('#userAge').value = user.edad ?? '';
      $('#userPhone').value = user.numeroDeTelefono || '';
      $('#userEmail').value = user.correo || '';
      $('#userPassword').value = user.contraseña || '';
      $('#userPasswordConfirm').value = user.contraseña || '';
      setMessage(status, `Editando usuario #${id}`, 'success');
    } catch (error) {
      setMessage(status, `No se pudo cargar el usuario: ${error.message}`, 'error');
    }
  }

  async function fillProductFormIfNeeded() {
    const form = $('#productForm');
    if (!form) {
      return;
    }

    const status = $('#productFormStatus');
    const id = new URLSearchParams(window.location.search).get('id');

    if (!id) {
      return;
    }

    try {
      setMessage(status, 'Cargando producto...', 'info');
      const product = await request(`/api/productos/${id}`);
      $('#productName').value = product.nombre || '';
      $('#productCategory').value = product.categoria || '';
      $('#productPrice').value = product.precio ?? '';
      $('#productStock').value = product.stock ?? '';
      $('#productDescription').value = product.descripcion || '';
      setMessage(status, `Editando producto #${id}`, 'success');
    } catch (error) {
      setMessage(status, `No se pudo cargar el producto: ${error.message}`, 'error');
    }
  }

  function bindUserForm() {
    const form = $('#userForm');
    if (!form) {
      return;
    }

    const status = $('#userFormStatus');
    const id = new URLSearchParams(window.location.search).get('id');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        setMessage(status, id ? 'Actualizando usuario...' : 'Registrando usuario...', 'info');
        await submitUserForm(form, id);
        setMessage(status, 'Usuario guardado correctamente.', 'success');
        window.location.href = 'usuarios.html';
      } catch (error) {
        setMessage(status, `Error: ${error.message}`, 'error');
      }
    });
  }

  function bindProductForm() {
    const form = $('#productForm');
    if (!form) {
      return;
    }

    const status = $('#productFormStatus');
    const id = new URLSearchParams(window.location.search).get('id');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        setMessage(status, id ? 'Actualizando producto...' : 'Guardando producto...', 'info');
        await submitProductForm(form, id);
        setMessage(status, 'Producto guardado correctamente.', 'success');
        window.location.href = 'visualizar.html';
      } catch (error) {
        setMessage(status, `Error: ${error.message}`, 'error');
      }
    });
  }

  function bindLoginForm() {
    const form = $('#loginForm');
    if (!form) {
      return;
    }

    const status = $('#loginStatus');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const email = ($('#loginEmail') && $('#loginEmail').value) ? $('#loginEmail').value.trim() : '';
      const pwd = ($('#password') && $('#password').value) ? $('#password').value : '';

      if (!email || !pwd) {
        setMessage(status, 'Ingresa email y contraseña.', 'error');
        return;
      }

      try {
        setMessage(status, 'Comprobando credenciales...', 'info');

        // Enviar credenciales al backend para autenticación
        const payload = { correo: email, contraseña: pwd };
        const resp = await request('/api/usuarios/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (resp && resp.exitoso) {
          try { localStorage.setItem('johanSession', JSON.stringify({ userId: resp.usuario.id, email: resp.usuario.correo })); } catch {}
          setMessage(status, 'Autenticación correcta. Redirigiendo...', 'success');
          window.location.href = 'dashboard.html';
          return;
        }

        setMessage(status, resp && resp.mensaje ? String(resp.mensaje) : 'Credenciales inválidas.', 'error');
      } catch (error) {
        setMessage(status, `No se pudo conectar con el backend: ${error.message}`, 'error');
      }
    });
  }

  async function loadDashboard() {
    const status = $('#dashboardStatus');

    try {
      setMessage(status, 'Consultando backend...', 'info');

      const [health, users, products] = await Promise.all([
        request('/health'),
        request('/api/usuarios'),
        request('/api/productos')
      ]);

      const totalStock = products.reduce((sum, product) => sum + toNumber(product.stock), 0);
      const featured = products[0] || null;

      $('#salesValue').textContent = String(users.length);
      $('#stockValue').textContent = String(totalStock);
      $('#featuredTitle').textContent = featured ? featured.nombre : 'Sin productos';
      $('#featuredDescription').textContent = featured ? featured.descripcion : 'No hay productos disponibles todavía.';
      $('#featuredPrice').textContent = featured ? `Precio: ${featured.precio}` : 'Precio: -';

      setMessage(status, `Backend ${health.estado}. Usuarios: ${users.length}. Productos: ${products.length}.`, 'success');
    } catch (error) {
      setMessage(status, `No se pudo consultar el backend: ${error.message}`, 'error');
    }
  }

  function bindCancelButtons() {
    $all('.cancelar').forEach((button) => {
      button.addEventListener('click', () => {
        const page = getPageName();

        if (page === 'registro.html' || page === 'putuser.html') {
          window.location.href = 'usuarios.html';
        } else if (page === 'crear.html' || page === 'actualizar.html') {
          window.location.href = 'visualizar.html';
        }
      });
    });
  }

  async function init() {
    const page = getPageName();

    bindLoginForm();
    bindUserForm();
    bindProductForm();
    bindCancelButtons();

    if (page === 'dashboard.html') {
      await loadDashboard();
    }

    if (page === 'usuarios.html') {
      await loadUsersPage();
    }

    if (page === 'visualizar.html') {
      await loadProductsPage();
    }

    if (page === 'registro.html' || page === 'putuser.html') {
      await fillUserFormIfNeeded();
    }

    if (page === 'crear.html' || page === 'actualizar.html') {
      await fillProductFormIfNeeded();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();