const SUPABASE_URL = "https://doecoosuqibzdsyadsyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_-30z4xAhwJPYmy1bfSEjCw_loKUe8uL";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const PROFISSIONAL_PADRAO = "Jhulia Araujo";

let usuarioLogado = "";
let offsetSemana = 0;
let modoMensalistaAtivo = false;
let abaCatalogoAtual = "servico";
let catalogoCache = { servicos: [], produtos: [] };

function horaParaMinutos(horaStr) {
    const [h, m] = String(horaStr || "00:00").split(":").map(Number);
    return (h * 60) + (m || 0);
}

function minutosParaHora(totalMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function carregarCatalogoEstudio() {
    try {
        const { data, error } = await _supabase
            .from("jhulia_catalogo")
            .select("*")
            .eq("ativo", true)
            .order("nome", { ascending: true });

        if (error) throw error;

        const itens = data || [];
        catalogoCache = {
            servicos: itens.filter(i => i.tipo === "servico"),
            produtos: itens.filter(i => i.tipo === "produto")
        };
        return catalogoCache;
    } catch (err) {
        console.error("Erro ao carregar catálogo:", err);
        catalogoCache = { servicos: [], produtos: [] };
        return catalogoCache;
    }
}

function renderizarSeletorItens(containerId, listaItens, classeCheckbox, callbackMudanca, ehServico = true) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";
    container.className = "servicos-selector-grid";

    if (!listaItens || listaItens.length === 0) {
        container.innerHTML = `<p style="grid-column: 1 / -1; font-size: 0.75rem; color: #8C6A70; text-align: center; padding: 8px;">Nenhum ${ehServico ? "procedimento" : "produto"} cadastrado em "Serviços e Produtos".</p>`;
        return;
    }

    listaItens.forEach(item => {
        const preco = Number(item.preco || 0);
        const duracao = Number(item.duracao || 30);

        const pill = document.createElement("div");
        pill.className = "servico-pill";
        pill.innerHTML = `
            <span class="nome"><i class="fa-regular fa-square"></i> ${item.nome}</span>
            <span class="valor">R$ ${preco.toFixed(2).replace(".", ",")}${ehServico ? ` • ${duracao}m` : ""}</span>
            <input type="checkbox" class="${classeCheckbox}" value="${item.nome}" data-preco="${preco}" data-duracao="${duracao}" style="display: none;">
        `;

        pill.onclick = () => {
            const chk = pill.querySelector("input");
            chk.checked = !chk.checked;
            const icon = pill.querySelector("i");
            if (chk.checked) {
                pill.classList.add("selected");
                icon.className = "fa-solid fa-square-check";
            } else {
                pill.classList.remove("selected");
                icon.className = "fa-regular fa-square";
            }
            if (callbackMudanca) callbackMudanca();
        };

        container.appendChild(pill);
    });
}

function mostrarAlerta(mensagem, sucesso = true) {
    const tituloEl = document.getElementById("alerta-titulo");
    if (!tituloEl) return;
    tituloEl.textContent = sucesso ? "Sucesso!" : "Aviso!";
    document.getElementById("alerta-mensagem").textContent = mensagem;
    document.getElementById("modal-alerta").classList.add("active");
}

function fecharAlerta() {
    document.getElementById("modal-alerta").classList.remove("active");
}

function abrirModalConfirmacaoAcao(mensagem, callbackConfirmar) {
    document.getElementById("confirmacao-mensagem").textContent = mensagem;
    const btnConfirmar = document.getElementById("btn-confirmar-acao");

    const novoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(novoBtn, btnConfirmar);

    novoBtn.onclick = () => {
        fecharModalConfirmacaoAcao();
        callbackConfirmar();
    };

    document.getElementById("modal-confirmacao-acao").classList.add("active");
}

function fecharModalConfirmacaoAcao() {
    document.getElementById("modal-confirmacao-acao").classList.remove("active");
}

function diaDaSemana(dateString) {
    const [y, m, d] = dateString.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
}

function obterFimExpedienteMinutos(dataString) {
    const diaSem = diaDaSemana(dataString);
    if (diaSem === 0) return 0; // Domingo fechado
    if (diaSem === 6) return 16 * 60; // Sábado até 16:00
    return 19 * 60; // Segunda a Sexta até 19:00
}

function obterHorariosParaData(dataString) {
    if (!dataString) return [];
    const diaSem = diaDaSemana(dataString);
    if (diaSem === 0) return []; // Domingo fechado

    const horarios = [];
    let currentMin = 8 * 60; // Início às 08:00
    const endMin = (diaSem === 6) ? (15 * 60 + 30) : (18 * 60 + 30); // Último início possível

    while (currentMin <= endMin) {
        horarios.push(minutosParaHora(currentMin));
        currentMin += 30; // Grade de 30 em 30 minutos para encaixar qualquer duração
    }

    return horarios;
}

/* ==========================================
   GESTÃO DE SERVIÇOS E PRODUTOS (CATÁLOGO)
   ========================================== */
async function abrirModalCatalogo() {
    const modal = document.getElementById("modal-catalogo");
    if (!modal) return;
    resetarFormCatalogo();
    modal.classList.add("active");
    await carregarCatalogoEstudio();
    renderizarListaCatalogo();
}

function fecharModalCatalogo() {
    document.getElementById("modal-catalogo").classList.remove("active");
}

function alternarAbaCatalogo(tipo) {
    abaCatalogoAtual = tipo;
    resetarFormCatalogo();

    document.getElementById("tab-cat-servico").classList.toggle("active", tipo === "servico");
    document.getElementById("tab-cat-produto").classList.toggle("active", tipo === "produto");

    const grupoDuracao = document.getElementById("grupo-catalogo-duracao");
    const inputDuracao = document.getElementById("catalogo-duracao");
    const labelNome = document.getElementById("label-catalogo-nome");
    const inputNome = document.getElementById("catalogo-nome");

    if (tipo === "servico") {
        grupoDuracao.style.display = "block";
        inputDuracao.required = true;
        labelNome.textContent = "Nome do Procedimento / Serviço:";
        inputNome.placeholder = "Ex: Alongamento em Fibra de Vidro";
    } else {
        grupoDuracao.style.display = "none";
        inputDuracao.required = false;
        labelNome.textContent = "Nome do Produto:";
        inputNome.placeholder = "Ex: Óleo Hidratante de Cutículas";
    }

    renderizarListaCatalogo();
}

function resetarFormCatalogo() {
    document.getElementById("catalogo-edit-id").value = "";
    document.getElementById("catalogo-tipo").value = abaCatalogoAtual;
    document.getElementById("catalogo-nome").value = "";
    document.getElementById("catalogo-preco").value = "";
    document.getElementById("catalogo-duracao").value = "60";
    document.getElementById("btn-salvar-catalogo").innerHTML = `<i class="fa-solid fa-check"></i> Cadastrar`;
    document.getElementById("btn-cancelar-edicao-catalogo").style.display = "none";
}

function renderizarListaCatalogo() {
    const container = document.getElementById("lista-catalogo-container");
    if (!container) return;

    const lista = abaCatalogoAtual === "servico" ? catalogoCache.servicos : catalogoCache.produtos;
    container.innerHTML = "";

    if (!lista || lista.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: #8C6A70; font-size: 0.82rem; padding: 14px;">Nenhum ${abaCatalogoAtual === "servico" ? "serviço" : "produto"} cadastrado ainda.</p>`;
        return;
    }

    lista.forEach(item => {
        const row = document.createElement("div");
        row.className = "catalogo-item-row";
        row.innerHTML = `
            <div>
                <strong style="font-size: 0.86rem; color: #3D262B; display: block;">${item.nome}</strong>
                <span style="font-size: 0.76rem; color: #8A4651; font-weight: bold;">
                    R$ ${Number(item.preco).toFixed(2).replace(".", ",")}
                    ${item.tipo === "servico" ? ` • <i class="fa-regular fa-clock"></i> ${item.duracao} min` : ""}
                </span>
            </div>
            <div style="display: flex; gap: 5px;">
                <button type="button" onclick="editarItemCatalogo('${item.id}')" style="background: #FAF0EF; color: #8A4651; border: 1px solid #E5CECD; padding: 6px 9px; border-radius: 6px; font-size: 0.74rem; font-weight: bold; cursor: pointer;" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button type="button" onclick="excluirItemCatalogo('${item.id}', '${item.nome.replace(/'/g, "\\'")}')" style="background: #FFF5F5; color: #D9534F; border: 1px solid #E7A19E; padding: 6px 9px; border-radius: 6px; font-size: 0.74rem; font-weight: bold; cursor: pointer;" title="Excluir">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
    });
}

function editarItemCatalogo(id) {
    const lista = abaCatalogoAtual === "servico" ? catalogoCache.servicos : catalogoCache.produtos;
    const item = lista.find(i => i.id === id);
    if (!item) return;

    document.getElementById("catalogo-edit-id").value = item.id;
    document.getElementById("catalogo-nome").value = item.nome;
    document.getElementById("catalogo-preco").value = Number(item.preco).toFixed(2);
    if (item.tipo === "servico") {
        document.getElementById("catalogo-duracao").value = item.duracao;
    }

    document.getElementById("btn-salvar-catalogo").innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar Alteração`;
    document.getElementById("btn-cancelar-edicao-catalogo").style.display = "inline-block";
}

async function salvarItemCatalogo(event) {
    if (event) event.preventDefault();

    const editId = document.getElementById("catalogo-edit-id").value;
    const tipo = abaCatalogoAtual;
    const nome = document.getElementById("catalogo-nome").value.trim();
    const preco = parseFloat(document.getElementById("catalogo-preco").value);
    const duracao = tipo === "servico" ? (parseInt(document.getElementById("catalogo-duracao").value, 10) || 60) : 0;

    if (!nome || isNaN(preco) || preco < 0) {
        mostrarAlerta("Informe um nome válido e um valor maior ou igual a zero.", false);
        return;
    }

    try {
        if (editId) {
            const { error } = await _supabase
                .from("jhulia_catalogo")
                .update({ nome, preco, duracao })
                .eq("id", editId);
            if (error) throw error;
        } else {
            const { error } = await _supabase
                .from("jhulia_catalogo")
                .insert([{ tipo, nome, preco, duracao, ativo: true }]);
            if (error) throw error;
        }

        resetarFormCatalogo();
        await carregarCatalogoEstudio();
        renderizarListaCatalogo();
    } catch (err) {
        mostrarAlerta("Erro ao salvar no catálogo: " + err.message, false);
    }
}

function excluirItemCatalogo(id, nome) {
    abrirModalConfirmacaoAcao(`Deseja realmente remover "${nome}" do catálogo?`, async () => {
        try {
            const { error } = await _supabase
                .from("jhulia_catalogo")
                .update({ ativo: false })
                .eq("id", id);

            if (error) throw error;
            await carregarCatalogoEstudio();
            renderizarListaCatalogo();
        } catch (err) {
            mostrarAlerta("Erro ao remover item: " + err.message, false);
        }
    });
}

/* ==========================================
   AUTENTICAÇÃO E AGENDA SEMANAL
   ========================================== */
async function fazerLogin() {
    const usuarioInput = document.getElementById("login-usuario").value.trim().toLowerCase();
    const senhaInput = document.getElementById("login-senha").value.trim();

    if (!usuarioInput || !senhaInput) {
        mostrarAlerta("Preencha o login e a senha.", false);
        return;
    }

    if ((usuarioInput === 'jhulia' && senhaInput === 'jhulia123') || (usuarioInput === 'joao' && senhaInput === 'admin123')) {
        usuarioLogado = PROFISSIONAL_PADRAO;

        document.getElementById("login-section").style.display = "none";
        document.getElementById("dashboard-barbeiro").style.display = "block";
        document.getElementById("titulo-agenda-barbeiro").textContent = "Agenda • Jhulia Araujo";

        offsetSemana = 0;
        await carregarCatalogoEstudio();
        carregarAgendaSemanal();
    } else if (usuarioInput === 'admin' && senhaInput === 'admin123') {
        usuarioLogado = "Admin";
        document.getElementById("login-section").style.display = "none";
        document.getElementById("dashboard-admin").style.display = "block";
        carregarResumoAdmin();
    } else {
        mostrarAlerta("Login ou senha incorretos!", false);
    }
}

function fazerLogout() {
    usuarioLogado = "";
    document.getElementById("dashboard-barbeiro").style.display = "none";
    document.getElementById("dashboard-admin").style.display = "none";
    document.getElementById("login-section").style.display = "flex";
}

function mudarSemana(direcao) {
    offsetSemana += direcao;
    carregarAgendaSemanal();
}

function obterDiasDaSemana(offset) {
    const dias = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diaSemana = hoje.getDay();
    const diffParaSegunda = (diaSemana === 0 ? -6 : 1) - diaSemana + (offset * 7);
    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() + diffParaSegunda);

    for (let i = 0; i < 6; i++) {
        const d = new Date(segunda);
        d.setDate(segunda.getDate() + i);
        const isoString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const formatada = d.toLocaleDateString("pt-BR", { weekday: 'short', day: '2-digit', month: '2-digit' });
        dias.push({ iso: isoString, label: formatada });
    }
    return dias;
}

async function carregarAgendaSemanal() {
    const container = document.getElementById("grade-semanal-container");
    const lblPeriodo = document.getElementById("label-periodo-semana");
    if (!container) return;

    container.innerHTML = "<p style='color: #8C6A70; text-align: center; width: 100%; font-size: 0.72rem;'>Carregando agenda...</p>";

    const diasSemana = obterDiasDaSemana(offsetSemana);
    lblPeriodo.textContent = `${diasSemana[0].label} até ${diasSemana[5].label}`;

    try {
        const { data: agendamentos } = await _supabase
            .from("jhulia_agendamentos")
            .select("*")
            .eq("profissional", PROFISSIONAL_PADRAO)
            .gte("data", diasSemana[0].iso)
            .lte("data", diasSemana[5].iso);

        const { data: bloqueios } = await _supabase
            .from("jhulia_bloqueios")
            .select("*")
            .eq("profissional", PROFISSIONAL_PADRAO)
            .gte("data", diasSemana[0].iso)
            .lte("data", diasSemana[5].iso);

        let qtdConcluidos = 0;
        let qtdEncaixes = 0;
        let faturamentoTotal = 0;

        (agendamentos || []).forEach(a => {
            if (a.status === 'concluido') {
                qtdConcluidos++;
                faturamentoTotal += Number(a.preco_total || 0);
            }
            if (a.servico && a.servico.includes("[ENCAIXE]")) {
                qtdEncaixes++;
            }
        });

        document.getElementById("barber-total-atendidos").textContent = qtdConcluidos;
        document.getElementById("barber-total-encaixes").textContent = qtdEncaixes;
        document.getElementById("barber-total-faturamento").textContent = `R$ ${faturamentoTotal.toFixed(2).replace(".", ",")}`;

        container.innerHTML = "";

        diasSemana.forEach(dia => {
            const coluna = document.createElement("div");
            coluna.className = "day-column";
            const blqDia = (bloqueios || []).find(b => b.data === dia.iso && b.horario === 'TODOS');

            coluna.innerHTML = `
                <div class="day-header">
                    <span>${dia.label}</span>
                    <button onclick="alternarBloqueioDia('${dia.iso}', ${!!blqDia})" style="background: ${blqDia ? '#FFF5F5' : '#FFF'}; color: ${blqDia ? '#D9534F' : '#5C4348'}; border: 1px solid ${blqDia ? '#E7A19E' : '#E5CECD'}; padding: 2px; border-radius: 4px; font-size: 0.52rem; cursor: pointer;">
                        ${blqDia ? 'Desbl' : 'Bloq'}
                    </button>
                </div>
            `;

            const slotsDiv = document.createElement("div");
            slotsDiv.style.cssText = "display: flex; flex-direction: column; gap: 3px;";

            if (blqDia) {
                slotsDiv.innerHTML = `<div style="color: #D9534F; text-align: center; font-size: 0.58rem; padding: 12px 0; font-weight: bold;">Bloq</div>`;
            } else {
                const horariosDia = obterHorariosParaData(dia.iso);
                const agendamentosDia = (agendamentos || []).filter(a => a.data === dia.iso && a.status !== 'cancelado');
                const bloqueiosDia = (bloqueios || []).filter(b => b.data === dia.iso && b.horario !== 'TODOS');

                const itensRenderizacao = [];

                horariosDia.forEach(h => {
                    const slotMin = horaParaMinutos(h);
                    const agsNoHorario = agendamentosDia.filter(a => String(a.horario).substring(0, 5) === h);
                    const agEmAndamento = agendamentosDia.find(a => {
                        const ini = horaParaMinutos(String(a.horario).substring(0, 5));
                        const fim = ini + Number(a.duracao_total || 30);
                        return slotMin > ini && slotMin < fim;
                    });
                    const blq = bloqueiosDia.find(b => String(b.horario).substring(0, 5) === h);

                    if (agsNoHorario.length > 0) {
                        agsNoHorario.forEach(ag => itensRenderizacao.push({ tipo: 'agendamento', horario: h, dado: ag }));
                    } else if (agEmAndamento) {
                        itensRenderizacao.push({ tipo: 'continuacao', horario: h, dado: agEmAndamento });
                    } else if (blq) {
                        itensRenderizacao.push({ tipo: 'bloqueio', horario: h, dado: blq });
                    } else {
                        itensRenderizacao.push({ tipo: 'vazio', horario: h });
                    }
                });

                agendamentosDia.forEach(a => {
                    const horaA = String(a.horario).substring(0, 5);
                    if (!horariosDia.includes(horaA)) {
                        itensRenderizacao.push({ tipo: 'agendamento', horario: horaA, dado: a });
                    }
                });

                itensRenderizacao.sort((a, b) => a.horario.localeCompare(b.horario));

                itensRenderizacao.forEach(item => {
                    const itemSlot = document.createElement("div");

                    if (item.tipo === 'bloqueio') {
                        itemSlot.className = "slot-item blocked";
                        itemSlot.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight:bold;">${item.horario}</span>
                                <button onclick="alternarBloqueioHorario('${dia.iso}', '${item.horario}', true)" style="background: #FFF5F5; color: #D9534F; border: 1px solid #E7A19E; padding: 1px 3px; font-size: 0.48rem; cursor: pointer;">X</button>
                            </div>
                        `;
                    } else if (item.tipo === 'continuacao') {
                        const ag = item.dado;
                        itemSlot.className = "slot-item continuation";
                        itemSlot.onclick = () => abrirGerenciadorAgendamento(ag.id);
                        itemSlot.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color:#8C6A70;">${item.horario}</span>
                                <span style="font-size: 0.48rem; color: #B76E79;">↳</span>
                            </div>
                            <div style="font-size: 0.55rem; color: #7D6368; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${ag.cliente}
                            </div>
                        `;
                    } else if (item.tipo === 'agendamento') {
                        const ag = item.dado;
                        const isConcluido = ag.status === 'concluido';
                        const isEncaixe = ag.servico && ag.servico.includes("[ENCAIXE]");
                        const isMensalista = ag.recorrente === true || (ag.servico && ag.servico.includes("[FIXA]"));

                        if (isMensalista) {
                            itemSlot.className = "slot-item mensalista";
                        } else {
                            itemSlot.className = isConcluido ? "slot-item concluded" : "slot-item booked";
                        }

                        itemSlot.onclick = () => abrirGerenciadorAgendamento(ag.id);
                        itemSlot.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight:bold;">${item.horario}</span>
                                <span style="font-size: 0.5rem; color: ${isMensalista ? '#9B59B6' : (isConcluido ? '#25D366' : '#B76E79')}; font-weight: bold;">
                                    ${isMensalista ? 'FIXA' : (isConcluido ? 'OK' : (isEncaixe ? 'ENC' : `${ag.duracao_total || 30}m`))}
                                </span>
                            </div>
                            <div style="font-weight: 600; color: #3D262B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${ag.cliente}">
                                ${ag.cliente}
                            </div>
                        `;
                    } else {
                        itemSlot.className = "slot-item available";
                        itemSlot.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <span style="color:#8C6A70;">${item.horario}</span>
                                <button onclick="alternarBloqueioHorario('${dia.iso}', '${item.horario}', false)" style="background: #FCF7F6; color: #6B4E54; border: 1px solid #E5CECD; padding: 0px 3px; font-size: 0.48rem; cursor: pointer;">Bloq</button>
                            </div>
                        `;
                    }
                    slotsDiv.appendChild(itemSlot);
                });
            }
            coluna.appendChild(slotsDiv);
            container.appendChild(coluna);
        });
    } catch (err) {
        console.error("Erro agenda:", err);
    }
}

async function alternarBloqueioDia(dataIso, estaBloqueado) {
    try {
        if (estaBloqueado) {
            await _supabase.from("jhulia_bloqueios").delete().eq("profissional", PROFISSIONAL_PADRAO).eq("data", dataIso).eq("horario", "TODOS");
        } else {
            await _supabase.from("jhulia_bloqueios").insert([{ profissional: PROFISSIONAL_PADRAO, data: dataIso, horario: "TODOS", tipo: "dia_todo" }]);
        }
        carregarAgendaSemanal();
    } catch (err) {
        mostrarAlerta("Erro ao alterar bloqueio.", false);
    }
}

async function alternarBloqueioHorario(dataIso, horario, estaBloqueado) {
    try {
        if (estaBloqueado) {
            await _supabase.from("jhulia_bloqueios").delete().eq("profissional", PROFISSIONAL_PADRAO).eq("data", dataIso).eq("horario", horario);
        } else {
            await _supabase.from("jhulia_bloqueios").insert([{ profissional: PROFISSIONAL_PADRAO, data: dataIso, horario: horario, tipo: "horario" }]);
        }
        carregarAgendaSemanal();
    } catch (err) {
        mostrarAlerta("Erro ao alterar bloqueio.", false);
    }
}

/* ==========================================
   AGENDAMENTO MANUAL E CLIENTES FIXAS
   ========================================== */
async function abrirModalAgendamentoManual() {
    modoMensalistaAtivo = false;
    document.getElementById("titulo-modal-manual").textContent = "Novo Agendamento";
    document.getElementById("bloco-mensalista-opcoes").style.display = "none";
    document.getElementById("bloco-encaixe-check").style.display = "block";

    const hoje = new Date();
    document.getElementById("manual-data").value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    document.getElementById("manual-cliente").value = "";
    document.getElementById("manual-telefone").value = "";
    document.getElementById("manual-encaixe").checked = false;

    document.getElementById("container-input-horario").innerHTML = `<select id="manual-horario"><option value="">Selecione a data primeiro</option></select>`;
    document.getElementById("label-horario-manual").textContent = "Horário:";

    await carregarCatalogoEstudio();
    renderizarSeletorItens("manual-servicos-container", catalogoCache.servicos, "manual-servico-chk", () => {
        if (!document.getElementById("manual-encaixe").checked) atualizarHorariosManuaisDisponiveis();
    }, true);

    atualizarHorariosManuaisDisponiveis();
    document.getElementById("modal-agendamento-manual").classList.add("active");
}

async function abrirModalMensalista() {
    const modalMensalista = document.getElementById("modal-gerenciar-mensalistas");
    if (!modalMensalista) return;

    modalMensalista.classList.add("active");
    carregarListaMensalistasAtivos();
}

function fecharModalMensalistas() {
    document.getElementById("modal-gerenciar-mensalistas").classList.remove("active");
}

async function abrirFormNovoMensalista() {
    fecharModalMensalistas();
    modoMensalistaAtivo = true;
    document.getElementById("titulo-modal-manual").textContent = "Cadastrar Cliente Fixa";
    document.getElementById("bloco-mensalista-opcoes").style.display = "block";
    document.getElementById("bloco-encaixe-check").style.display = "none";

    const hoje = new Date();
    document.getElementById("manual-data").value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    document.getElementById("manual-cliente").value = "";
    document.getElementById("manual-telefone").value = "";

    document.getElementById("label-horario-manual").textContent = "Horário Fixo:";
    document.getElementById("container-input-horario").innerHTML = `<input type="time" id="manual-horario" value="10:00" style="width: 100%; padding: 10px; background: #FFF; border: 1px solid #9B59B6; border-radius: 8px;">`;

    await carregarCatalogoEstudio();
    renderizarSeletorItens("manual-servicos-container", catalogoCache.servicos, "manual-servico-chk", null, true);
    document.getElementById("modal-agendamento-manual").classList.add("active");
}

async function carregarListaMensalistasAtivos() {
    const container = document.getElementById("lista-mensalistas-container");
    if (!container) return;

    container.innerHTML = "<p style='color: #8C6A70; text-align: center;'>Carregando clientes fixas...</p>";

    try {
        const { data, error } = await _supabase
            .from("jhulia_agendamentos")
            .select("*")
            .eq("profissional", PROFISSIONAL_PADRAO)
            .eq("recorrente", true)
            .eq("status", "ativo")
            .order("data", { ascending: true });

        if (error) throw error;

        container.innerHTML = "";
        if (!data || data.length === 0) {
            container.innerHTML = "<p style='color: #8C6A70; text-align: center;'>Nenhuma cliente fixa ativa no momento.</p>";
            return;
        }

        const agrupados = {};
        data.forEach(item => {
            const chave = `${item.cliente}-${item.telefone}`;
            if (!agrupados[chave]) agrupados[chave] = item;
        });

        Object.values(agrupados).forEach(item => {
            const card = document.createElement("div");
            card.style.cssText = "background: #FAF5FF; border: 1px solid #9B59B6; border-radius: 8px; padding: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;";

            card.innerHTML = `
                <div style="text-align: left;">
                    <strong style="color: #3D262B; font-size: 0.85rem;"><i class="fa-solid fa-star" style="color: #9B59B6;"></i> ${item.cliente} (${item.telefone})</strong><br>
                    <span style="font-size: 0.75rem; color: #6B4E54;">Próximo: ${item.data.split("-").reverse().join("/")} às ${item.horario}</span>
                </div>
                <button onclick="cancelarMensalista('${item.cliente.replace(/'/g, "\\'")}', '${item.telefone}')" style="background: #FFF5F5; color: #D9534F; border: 1px solid #E7A19E; padding: 6px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">Cancelar</button>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = "<p style='color: #D9534F; text-align: center;'>Erro ao carregar clientes fixas.</p>";
    }
}

function cancelarMensalista(cliente, telefone) {
    abrirModalConfirmacaoAcao(`Deseja realmente cancelar TODAS as marcações futuras de ${cliente}?`, async () => {
        try {
            const { error } = await _supabase
                .from("jhulia_agendamentos")
                .update({ status: 'cancelado' })
                .eq('profissional', PROFISSIONAL_PADRAO)
                .eq('recorrente', true)
                .eq('cliente', cliente)
                .eq('telefone', telefone);

            if (error) throw error;
            carregarListaMensalistasAtivos();
            carregarAgendaSemanal();
        } catch (err) {
            mostrarAlerta("Erro ao cancelar cliente fixa.", false);
        }
    });
}

function alternarModoEncaixe() {
    const chk = document.getElementById("manual-encaixe");
    const containerHorario = document.getElementById("container-input-horario");
    const labelHorario = document.getElementById("label-horario-manual");

    if (chk.checked) {
        labelHorario.textContent = "Horário do Encaixe (Livre):";
        containerHorario.innerHTML = `<input type="time" id="manual-horario" value="10:00" style="width: 100%; padding: 10px; background: #FFF; border: 1px solid #B76E79; border-radius: 8px;">`;
    } else {
        labelHorario.textContent = "Horário:";
        containerHorario.innerHTML = `<select id="manual-horario"><option value="">Carregando...</option></select>`;
        atualizarHorariosManuaisDisponiveis();
    }
}

async function atualizarHorariosManuaisDisponiveis() {
    if (modoMensalistaAtivo || document.getElementById("manual-encaixe").checked) return;
    const dataSel = document.getElementById("manual-data").value;
    const horarioSelect = document.getElementById("manual-horario");
    if (!dataSel || !horarioSelect) return;

    const horarios = obterHorariosParaData(dataSel);
    horarioSelect.innerHTML = "";
    if (horarios.length === 0) {
        horarioSelect.innerHTML = "<option value=''>Estúdio fechado neste dia</option>";
        return;
    }
    horarios.forEach(h => {
        const opt = document.createElement("option");
        opt.value = h;
        opt.textContent = h;
        horarioSelect.appendChild(opt);
    });
}

function fecharModalAgendamentoManual() {
    document.getElementById("modal-agendamento-manual").classList.remove("active");
}

async function salvarAgendamentoManual(event) {
    if (event) event.preventDefault();

    const cliente = document.getElementById("manual-cliente").value.trim();
    const telefone = document.getElementById("manual-telefone").value.trim();
    const dataBaseStr = document.getElementById("manual-data").value;
    const horario = document.getElementById("manual-horario")?.value;
    const ehEncaixe = !modoMensalistaAtivo && document.getElementById("manual-encaixe").checked;

    const servicosSelecionados = [];
    let precoTotal = 0;
    let duracaoTotal = 0;

    document.querySelectorAll(".manual-servico-chk:checked").forEach(chk => {
        servicosSelecionados.push(chk.value);
        precoTotal += Number(chk.dataset.preco || 0);
        duracaoTotal += Number(chk.dataset.duracao || 30);
    });

    if (!cliente || !dataBaseStr || !horario || servicosSelecionados.length === 0) {
        mostrarAlerta("Preencha o nome da cliente, data, horário e selecione ao menos um procedimento.", false);
        return;
    }

    try {
        const agendamentosArray = [];

        if (modoMensalistaAtivo) {
            const frequenciaEscolha = document.getElementById("manual-frequencia").value;
            const duracaoMeses = parseInt(document.getElementById("manual-duracao-meses").value, 10) || 1;
            const frequenciaDias = (frequenciaEscolha === "4") ? 7 : (frequenciaEscolha === "3" ? 21 : 14);

            const dataFim = new Date(dataBaseStr + "T00:00:00");
            dataFim.setMonth(dataFim.getMonth() + duracaoMeses);

            const dataAtual = new Date(dataBaseStr + "T00:00:00");

            while (dataAtual <= dataFim) {
                const dataIso = dataAtual.toISOString().split("T")[0];
                const servicoFinal = `[FIXA] ${servicosSelecionados.join(", ")}`;

                agendamentosArray.push({
                    profissional: PROFISSIONAL_PADRAO,
                    cliente: cliente,
                    telefone: telefone || "Presencial",
                    servico: servicoFinal,
                    preco_total: precoTotal,
                    duracao_total: duracaoTotal > 0 ? duracaoTotal : 30,
                    data: dataIso,
                    horario: horario,
                    status: 'ativo',
                    recorrente: true
                });

                dataAtual.setDate(dataAtual.getDate() + frequenciaDias);
            }
        } else {
            let servicoFinal = servicosSelecionados.join(", ");
            if (ehEncaixe) {
                servicoFinal = `[ENCAIXE] ${servicoFinal}`;
            }

            agendamentosArray.push({
                profissional: PROFISSIONAL_PADRAO,
                cliente: cliente,
                telefone: telefone || "Presencial",
                servico: servicoFinal,
                preco_total: precoTotal,
                duracao_total: duracaoTotal > 0 ? duracaoTotal : 30,
                data: dataBaseStr,
                horario: horario,
                status: 'ativo',
                recorrente: false
            });
        }

        const { error } = await _supabase.from("jhulia_agendamentos").insert(agendamentosArray);
        if (error) throw error;

        fecharModalAgendamentoManual();
        mostrarAlerta(modoMensalistaAtivo ? "Cliente fixa cadastrada com sucesso!" : "Agendamento salvo com sucesso!", true);
        carregarAgendaSemanal();
    } catch (err) {
        mostrarAlerta("Erro ao salvar: " + err.message, false);
    }
}

function enviarLembreteClienteWhatsApp(agendamento) {
    const telLimpo = String(agendamento.telefone || "").replace(/\D/g, "");
    if (telLimpo.length < 10) {
        mostrarAlerta("Esta cliente não possui um número de WhatsApp válido cadastrado.", false);
        return;
    }

    const telFinal = telLimpo.startsWith("55") ? telLimpo : `55${telLimpo}`;
    const dataFormatada = agendamento.data.split("-").reverse().join("/");
    const horaFormatada = String(agendamento.horario).substring(0, 5);

    const textoLembrete = encodeURIComponent(
        `Olá ${agendamento.cliente}! Tudo bem? ✨\n\n` +
        `Passando para lembrar do seu horário agendado no estúdio *Jhulia Araujo | Unhas*:\n` +
        `📅 *Data:* ${dataFormatada}\n` +
        `⏰ *Horário:* ${horaFormatada}\n` +
        `💅 *Procedimento(s):* ${agendamento.servico}\n\n` +
        `Qualquer imprevisto, por favor me avise com antecedência. Te aguardo!`
    );

    window.open(`https://wa.me/${telFinal}?text=${textoLembrete}`, "_blank");
}

async function abrirGerenciadorAgendamento(id) {
    try {
        const { data } = await _supabase.from("jhulia_agendamentos").select("*").eq("id", id).single();
        if (!data) return;

        await carregarCatalogoEstudio();

        const modal = document.getElementById("custom-action-modal");
        const detailsBox = document.getElementById("action-modal-details");
        const paymentBox = document.getElementById("payment-box");
        const rescheduleBox = document.getElementById("reschedule-box");
        const buttonsBox = document.getElementById("action-modal-buttons");

        const precoOriginal = Number(data.preco_total || 0);
        detailsBox.innerHTML = `
            <strong>Cliente:</strong> ${data.cliente}<br>
            <strong>WhatsApp:</strong> ${data.telefone || 'Não informado'}<br>
            <strong>Procedimentos:</strong> ${data.servico}<br>
            <strong>Duração:</strong> ${data.duracao_total || 30} min<br>
            <strong>Valor Base:</strong> R$ ${precoOriginal.toFixed(2).replace(".", ",")}<br>
            <strong>Data/Hora:</strong> ${data.data.split("-").reverse().join("/")} às ${data.horario}
        `;

        paymentBox.style.display = "none";
        rescheduleBox.style.display = "none";

        let produtosWrapper = document.getElementById("extras-produtos-wrapper");
        if (!produtosWrapper) {
            produtosWrapper = document.createElement("div");
            produtosWrapper.id = "extras-produtos-wrapper";
            produtosWrapper.style.cssText = "margin-top: 12px; margin-bottom: 12px;";
            produtosWrapper.innerHTML = `
                <label style="display: block; font-size: 0.8rem; font-weight: bold; color: #3D262B; margin-bottom: 6px;">
                    <i class="fa-solid fa-bag-shopping"></i> Produtos Vendidos (Opcional):
                </label>
                <div id="extras-produtos-container"></div>
            `;
            const servicosContainer = document.getElementById("extras-servicos-container");
            if (servicosContainer && servicosContainer.parentNode) {
                servicosContainer.parentNode.insertBefore(produtosWrapper, servicosContainer.nextSibling);
            } else {
                paymentBox.insertBefore(produtosWrapper, paymentBox.firstChild);
            }
        }

        function atualizarValorTotalDinamico() {
            let acrescimo = 0;
            document.querySelectorAll(".extra-servico-chk:checked, .extra-produto-chk:checked").forEach(chk => {
                acrescimo += Number(chk.dataset.preco || 0);
            });
            const totalFinal = precoOriginal + acrescimo;
            const totalEl = document.getElementById("valor-total-atualizado");
            if (totalEl) totalEl.textContent = `R$ ${totalFinal.toFixed(2).replace(".", ",")}`;
        }

        renderizarSeletorItens("extras-servicos-container", catalogoCache.servicos, "extra-servico-chk", atualizarValorTotalDinamico, true);
        renderizarSeletorItens("extras-produtos-container", catalogoCache.produtos, "extra-produto-chk", atualizarValorTotalDinamico, false);
        atualizarValorTotalDinamico();

        function renderizarBotoesPrincipais() {
            buttonsBox.innerHTML = "";

            if (data.status !== 'concluido') {
                const btnAtendido = document.createElement("button");
                btnAtendido.className = "custom-modal-btn btn-modal-atendido";
                btnAtendido.textContent = "Concluir e Confirmar Pgto";
                btnAtendido.onclick = () => {
                    paymentBox.style.display = "block";
                    rescheduleBox.style.display = "none";
                    buttonsBox.innerHTML = "";

                    const btnSalvarPg = document.createElement("button");
                    btnSalvarPg.className = "custom-modal-btn btn-modal-confirmar";
                    btnSalvarPg.textContent = "Salvar Atendimento e Pgto";
                    btnSalvarPg.onclick = async () => {
                        const formaPgto = document.getElementById("select-forma-pagamento").value;
                        const servicosList = data.servico ? data.servico.split(",").map(s => s.trim()) : [];
                        let acrescimo = 0;

                        document.querySelectorAll(".extra-servico-chk:checked").forEach(chk => {
                            const nomeServ = chk.value;
                            const pServ = Number(chk.dataset.preco || 0);
                            if (!servicosList.includes(nomeServ)) {
                                servicosList.push(nomeServ);
                                acrescimo += pServ;
                            }
                        });

                        document.querySelectorAll(".extra-produto-chk:checked").forEach(chk => {
                            const nomeProd = chk.value;
                            const pProd = Number(chk.dataset.preco || 0);
                            servicosList.push(`Produto: ${nomeProd}`);
                            acrescimo += pProd;
                        });

                        const novoPrecoTotal = precoOriginal + acrescimo;

                        try {
                            const { error } = await _supabase.from("jhulia_agendamentos").update({
                                status: 'concluido',
                                pagamentos: formaPgto,
                                servico: servicosList.join(", "),
                                preco_total: novoPrecoTotal
                            }).eq('id', data.id);

                            if (error) throw error;
                            modal.classList.remove("active");
                            carregarAgendaSemanal();
                        } catch (err) {
                            mostrarAlerta("Erro ao concluir: " + err.message, false);
                        }
                    };

                    const btnVoltar = document.createElement("button");
                    btnVoltar.className = "custom-modal-btn btn-modal-cancelar";
                    btnVoltar.textContent = "Voltar";
                    btnVoltar.onclick = () => {
                        paymentBox.style.display = "none";
                        renderizarBotoesPrincipais();
                    };

                    buttonsBox.appendChild(btnSalvarPg);
                    buttonsBox.appendChild(btnVoltar);
                };

                const btnLembrete = document.createElement("button");
                btnLembrete.className = "custom-modal-btn";
                btnLembrete.style.cssText = "background-color: #25D366; color: #FFFFFF; border: none;";
                btnLembrete.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Enviar Lembrete à Cliente`;
                btnLembrete.onclick = () => enviarLembreteClienteWhatsApp(data);

                const btnReagendar = document.createElement("button");
                btnReagendar.className = "custom-modal-btn btn-modal-editar";
                btnReagendar.textContent = "Reagendar";
                btnReagendar.onclick = () => {
                    rescheduleBox.style.display = "block";
                    paymentBox.style.display = "none";
                    document.getElementById("new-reschedule-date").value = data.data;
                    document.getElementById("new-reschedule-time").value = data.horario;
                    buttonsBox.innerHTML = "";

                    const btnSalvarReag = document.createElement("button");
                    btnSalvarReag.className = "custom-modal-btn btn-modal-confirmar";
                    btnSalvarReag.textContent = "Confirmar Reagendamento";
                    btnSalvarReag.onclick = async () => {
                        try {
                            const { error } = await _supabase.from("jhulia_agendamentos").update({
                                data: document.getElementById("new-reschedule-date").value,
                                horario: document.getElementById("new-reschedule-time").value
                            }).eq('id', data.id);

                            if (error) throw error;
                            modal.classList.remove("active");
                            carregarAgendaSemanal();
                        } catch (err) {
                            mostrarAlerta("Erro ao reagendar.", false);
                        }
                    };

                    const btnVoltarReag = document.createElement("button");
                    btnVoltarReag.className = "custom-modal-btn btn-modal-cancelar";
                    btnVoltarReag.textContent = "Voltar";
                    btnVoltarReag.onclick = () => {
                        rescheduleBox.style.display = "none";
                        renderizarBotoesPrincipais();
                    };

                    buttonsBox.appendChild(btnSalvarReag);
                    buttonsBox.appendChild(btnVoltarReag);
                };

                const btnCancelar = document.createElement("button");
                btnCancelar.className = "custom-modal-btn btn-modal-excluir";
                btnCancelar.textContent = "Cancelar Agendamento";
                btnCancelar.onclick = async () => {
                    try {
                        await _supabase.from("jhulia_agendamentos").update({ status: 'cancelado' }).eq('id', data.id);
                        modal.classList.remove("active");
                        carregarAgendaSemanal();
                    } catch (err) {
                        mostrarAlerta("Erro ao cancelar.", false);
                    }
                };

                buttonsBox.appendChild(btnAtendido);
                buttonsBox.appendChild(btnLembrete);
                buttonsBox.appendChild(btnReagendar);
                buttonsBox.appendChild(btnCancelar);
            }

            const btnFechar = document.createElement("button");
            btnFechar.className = "custom-modal-btn btn-modal-cancelar";
            btnFechar.textContent = "Fechar";
            btnFechar.onclick = () => modal.classList.remove("active");
            buttonsBox.appendChild(btnFechar);
        }

        renderizarBotoesPrincipais();
        modal.classList.add("active");
    } catch (err) {
        console.error(err);
    }
}

async function carregarResumoAdmin() {
    const dataFiltro = document.getElementById("filter-date-admin").value;
    const container = document.getElementById("agendamentos-list-admin");
    if (!dataFiltro || !container) return;

    container.innerHTML = "<p style='color: #8C6A70; text-align: center;'>Carregando...</p>";

    try {
        const { data } = await _supabase
            .from("jhulia_agendamentos")
            .select("*")
            .eq("data", dataFiltro)
            .order("horario", { ascending: true });

        container.innerHTML = "";
        const ativos = (data || []).filter(a => a.status !== 'cancelado');

        if (ativos.length === 0) {
            container.innerHTML = "<p style='color: #8C6A70; text-align: center;'>Nenhum agendamento nesta data.</p>";
            return;
        }

        ativos.forEach(item => {
            const card = document.createElement("div");
            card.style.cssText = "background: #FCF7F6; padding: 12px; border-radius: 8px; border: 1px solid #EEDCDD;";
            card.innerHTML = `<strong>${item.horario} (${item.duracao_total || 30} min) - ${item.cliente}</strong><br>${item.servico} • R$ ${Number(item.preco_total || 0).toFixed(2).replace(".", ",")}`;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = "<p style='color: #D9534F; text-align: center;'>Erro ao carregar.</p>";
    }
}