
  // Menu mobile
  const menuBtn = document.getElementById('menuBtn');
  const navRight = document.getElementById('navRight');
  menuBtn.addEventListener('click', () => {
    const opened = navRight.classList.toggle('mobile-open');
    menuBtn.classList.toggle('open', opened);
    menuBtn.setAttribute('aria-expanded', String(opened));
    menuBtn.setAttribute('aria-label', opened ? 'Fechar menu' : 'Abrir menu');
  });
  
  // Rotas de coleta
  const rotas = {
    1: {
      dia: 'Segundas e quintas',
      paradas: [
        { hora: '08h00', nome: 'Paço Municipal', desc: 'Rua Miguel Prisco, 288 — Centro. Recolhimento da coleta seletiva permanente de vidro, plástico, papel, eletrônicos e pilhas.', lat: -23.5505, lng: -46.6333 },
        { hora: '09h30', nome: 'Secretaria de Meio Ambiente', desc: 'Rua Felipe Sabbag, 200 — Shopping Garden, 2º andar. Coleta de pilhas e baterias entregues na secretaria.', lat: -23.5540, lng: -46.6290 },
        { hora: '11h00', nome: 'Cooperpires', desc: 'Rua Professor Renato Andregheto, 55 — Aliança. Transbordo do material recolhido no Centro para triagem e processamento pela cooperativa.', lat: -23.5480, lng: -46.6210 },
        { hora: '12h30', nome: 'Feira Coberta do Centro', desc: 'Praça das Bandeiras, s/n — Centro. Ponto extra de coleta de orgânicos das barracas de feira para compostagem.', lat: -23.5518, lng: -46.6355 }
      ]
    },
    2: {
      dia: 'Terças e sextas',
      paradas: [
        { hora: '08h30', nome: 'Ecoponto Pátio JB Duarte', desc: 'Avenida Capitão José Galo — Planalto Bela Vista. Recolhimento de resíduos volumosos de papel, plástico, vidro e metal (até 1m³/pessoa).', lat: -23.5610, lng: -46.6450 },
        { hora: '09h45', nome: 'Escola Municipal Vista Alegre', desc: 'Rua das Palmeiras, 410 — Planalto. Coleta educativa junto ao projeto de reciclagem dos alunos.', lat: -23.5585, lng: -46.6395 },
        { hora: '10h30', nome: 'Cooperpires', desc: 'Rua Professor Renato Andregheto, 55 — Aliança. Entrega dos recicláveis para separação e destinamento pelas equipes da cooperativa.', lat: -23.5480, lng: -46.6210 }
      ]
    },
    3: {
      dia: 'Quartas e sábados',
      paradas: [
        { hora: '09h00', nome: 'Posto Ipiranga — Centro Alto', desc: 'Avenida Santos André, 700 — Centro Alto. Recolhimento de pilhas e baterias do ponto fixo do posto.', lat: -23.5450, lng: -46.6380 },
        { hora: '10h15', nome: 'Secretaria de Meio Ambiente', desc: 'Rua Felipe Sabbag, 200 — Shopping Garden, 2º andar. Consolidação dos resíduos eletrônicos e pilhas para destinação ecológica.', lat: -23.5540, lng: -46.6290 }
      ]
    },
    4: {
      dia: 'Segundas e quartas (quinzenal)',
      paradas: [
        { hora: '08h00', nome: 'Ecoponto Jardim das Flores', desc: 'Rua das Acácias, 120 — Jardim das Flores. Novo ponto de coleta atendendo os bairros recém-integrados à rota.', lat: -23.5700, lng: -46.6200 },
        { hora: '09h30', nome: 'Associação de Catadores Vida Nova', desc: 'Rua Bom Retiro, 88 — Zona Sul. Parceria direta com catadores autônomos organizados em associação.', lat: -23.5750, lng: -46.6100 },
        { hora: '11h30', nome: 'Cooperpires', desc: 'Rua Professor Renato Andregheto, 55 — Aliança. Ponto final de transbordo de toda a Zona Sul.', lat: -23.5480, lng: -46.6210 }
      ]
    }
  };

  const rotaTrack = document.getElementById('rotaTrack');
  const rotaBtns = document.querySelectorAll('#rotaSelect button');

  function renderRota(id){
    const rota = rotas[id];
    rotaTrack.innerHTML = rota.paradas.map((p, i) => `
      <div class="rota-item">
        <div class="rota-marker">
          <div class="dot">${i + 1}</div>
          <div class="rota-line"></div>
        </div>
        <div class="rota-content">
          <span class="time">${p.hora}</span>
          <h4>${p.nome}</h4>
          <p>${p.desc}</p>
        </div>
      </div>
    `).join('');
  }

  rotaBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      rotaBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRota(btn.dataset.rota);
    });
  });

  // ---------- Mapa (Leaflet) + links diretos do Waze ----------
  // Observação: o Waze não oferece uma API pública para embutir rotas ou
  // trânsito em tempo real em sites de terceiros. O que existe são "deep
  // links" (waze.com/ul) que abrem o app/site do Waze já navegando até um
  // ponto — é isso que os botões abaixo fazem.
  function wazeLink(lat, lng){
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }

  function getPontosUnicos(){
    const mapa = new Map();
    Object.entries(rotas).forEach(([rotaId, rota]) => {
      rota.paradas.forEach(p => {
        if (p.lat == null || p.lng == null) return;
        if (!mapa.has(p.nome)) {
          mapa.set(p.nome, { ...p, rotasIds: [rotaId] });
        } else {
          mapa.get(p.nome).rotasIds.push(rotaId);
        }
      });
    });
    return Array.from(mapa.values());
  }

  function initMapa(){
    const mapaLista = document.getElementById('mapaLista');
    const pontos = getPontosUnicos();

    mapaLista.innerHTML = pontos.map(p => `
      <div class="mapa-ponto">
        <div>
          <h4>${p.nome}</h4>
          <p>Rota${p.rotasIds.length > 1 ? 's' : ''} ${p.rotasIds.join(', ')} · ${p.hora}</p>
        </div>
        <a class="waze-btn" href="${wazeLink(p.lat, p.lng)}" target="_blank" rel="noopener">Abrir no Waze</a>
      </div>
    `).join('');

    if (typeof L === 'undefined') {
      document.getElementById('mapaLeaflet').innerHTML =
        '<p style="padding:20px;color:var(--tinta-suave);font-size:0.85rem;">Não foi possível carregar o mapa agora. Use a lista ao lado para abrir cada ponto no Waze.</p>';
      return;
    }

    const leafletMap = L.map('mapaLeaflet', { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(leafletMap);

    const markers = pontos.map(p => {
      const marker = L.marker([p.lat, p.lng]).addTo(leafletMap);
      marker.bindPopup(`<b>${p.nome}</b><br>${p.desc.split(' — ')[0]}<br><a class="waze-btn" href="${wazeLink(p.lat, p.lng)}" target="_blank" rel="noopener">Abrir no Waze</a>`);
      return marker;
    });

    if (markers.length) {
      leafletMap.fitBounds(L.featureGroup(markers).getBounds().pad(0.25));
    } else {
      leafletMap.setView([-23.55, -46.63], 13);
    }
  }


  renderRota(1);
  initMapa();

  function closeMenu(){
    menuBtn.classList.remove('open');navRight.classList.remove('mobile-open');
    menuBtn.setAttribute('aria-expanded','false');menuBtn.setAttribute('aria-label','Abrir menu');
  }
  navRight.querySelectorAll('a').forEach(a => a.addEventListener('click',closeMenu));
  document.addEventListener('keydown', e => {if(e.key === 'Escape') closeMenu();});
  document.addEventListener('click', e => {if(!e.target.closest('header')) closeMenu();});
