'use strict';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// Conserva abiertos los detalles mientras se actualiza la ronda.
const expandedLaws = new Set();
let currentRound = null;

function element(tag, text, className) {
  const node = document.createElement(tag);

  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;

  return node;
}

/* =========================================================
   1. CANTIDAD DE PREGUNTAS
   ========================================================= */

export function syncQuestionLimit(input, available) {
  if (!input) return;

  const max = Number.isSafeInteger(available) && available > 0
    ? available
    : 0;

  input.min = '1';
  input.max = String(Math.max(1, max));
  input.disabled = max === 0;

  input.title = max
    ? `Entre 1 y ${max} preguntas. ↑ y ↓ cambian de 10 en 10.`
    : 'Selecciona un tema con preguntas';

  if (!max) {
    input.value = '';
    return;
  }

  const current = Number(input.value);

  if (!Number.isSafeInteger(current) || current < 1) {
    input.value = String(Math.min(10, max));
  } else if (current > max) {
    input.value = String(max);
  }
}

export function bindQuestionLimit(input) {
  if (!input) return;

  input.step = '1';

  input.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    if (input.disabled) return;

    event.preventDefault();

    const max = Number(input.max);

    if (!Number.isSafeInteger(max) || max < 1) return;

    const raw = Number(input.value);

    const current = Number.isSafeInteger(raw) && raw >= 1
      ? Math.min(raw, max)
      : 1;

    input.value = String(
      event.key === 'ArrowUp'
        ? Math.min(current + 10, max)
        : Math.max(current - 10, 1)
    );

    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  input.addEventListener('change', () => {
    syncQuestionLimit(input, Number(input.max));
  });
}

/* =========================================================
   2. CÁLCULO DE ESTADÍSTICAS
   ========================================================= */

function getPerformance(hits, answered) {
  if (!answered) {
    return {
      status: 'pending',
      label: 'Sin respuestas',
      percent: null
    };
  }

  const ratio = hits / answered;

  return {
    status: ratio >= .8 ? 'good' : ratio >= .6 ? 'medium' : 'weak',
    label: ratio >= .8 ? 'Bien' : ratio >= .6 ? 'Regular' : 'Por reforzar',
    percent: Math.round(ratio * 100)
  };
}

function collectLaws(state) {
  const laws = new Map();

  state.questions.forEach((question, index) => {
    const lawName = question.law || 'Ley 2196';

    if (!laws.has(lawName)) {
      laws.set(lawName, {
        law: lawName,
        total: 0,
        answered: 0,
        hits: 0,
        topics: new Map()
      });
    }

    const law = laws.get(lawName);

    if (!law.topics.has(question.topic)) {
      law.topics.set(question.topic, {
        topic: question.topic,
        total: 0,
        answered: 0,
        hits: 0,
        errors: []
      });
    }

    const topic = law.topics.get(question.topic);

    law.total++;
    topic.total++;

    const selected = state.answers[index];

    if (!Number.isInteger(selected)) return;

    law.answered++;
    topic.answered++;

    if (selected === question.answer) {
      law.hits++;
      topic.hits++;
    } else {
      topic.errors.push({
        number: index + 1,
        question,
        selected
      });
    }
  });

  // Orden estable por número de ley y nombre.
  return [...laws.values()].sort((a, b) =>
    a.law.localeCompare(b.law, 'es', {
      numeric: true,
      sensitivity: 'base'
    })
  );
}

function sortTopics(topics) {
  return [...topics].sort((a, b) => {
    const aErrors = a.answered - a.hits;
    const bErrors = b.answered - b.hits;

    // Primero los temas con errores, luego los respondidos sin errores,
    // y finalmente los pendientes.
    const aPriority = aErrors ? 0 : a.answered ? 1 : 2;
    const bPriority = bErrors ? 0 : b.answered ? 1 : 2;

    if (aPriority !== bPriority) return aPriority - bPriority;

    if (aPriority === 0) {
      const ratioDifference =
        a.hits / a.answered - b.hits / b.answered;

      if (ratioDifference) return ratioDifference;
      if (aErrors !== bErrors) return bErrors - aErrors;
    }

    return a.topic.localeCompare(b.topic, 'es', {
      numeric: true,
      sensitivity: 'base'
    });
  });
}

/* =========================================================
   3. GRÁFICO POR LEY
   ========================================================= */

function createCircle(className) {
  const circle = document.createElementNS(SVG_NAMESPACE, 'circle');

  circle.setAttribute('cx', '60');
  circle.setAttribute('cy', '60');
  circle.setAttribute('r', '46');
  circle.setAttribute('class', className);

  return circle;
}

function createDonut(law) {
  const chart = element('span', undefined, 'law-chart');
  chart.setAttribute('aria-hidden', 'true');

  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');

  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'law-chart-svg');
  svg.setAttribute('focusable', 'false');

  svg.append(createCircle('law-chart-background'));

  let offset = 0;

  [
    { count: law.hits, className: 'law-chart-hits' },
    {
      count: law.answered - law.hits,
      className: 'law-chart-errors'
    }
  ].forEach(segment => {
    if (!segment.count) return;

    const size = segment.count / law.total * 100;
    const circle = createCircle(segment.className);

    circle.setAttribute('pathLength', '100');
    circle.setAttribute('stroke-dasharray', `${size} ${100 - size}`);
    circle.setAttribute('stroke-dashoffset', String(-offset));
    circle.setAttribute('transform', 'rotate(-90 60 60)');

    svg.append(circle);
    offset += size;
  });

  const performance = getPerformance(law.hits, law.answered);
  const center = element('span', undefined, 'law-chart-center');

  center.append(
    element(
      'strong',
      performance.percent === null ? '—' : `${performance.percent}%`
    ),
    element('small', 'aciertos')
  );

  chart.append(svg, center);

  return chart;
}

function createLegend(law) {
  const legend = element('span', undefined, 'law-summary-counts');

  [
    ['hits', 'aciertos', law.hits],
    ['errors', 'errores', law.answered - law.hits],
    ['pending', 'pendientes', law.total - law.answered]
  ].forEach(([type, label, count]) => {
    const item = element('span', undefined, 'law-summary-count');
    const dot = element('span', undefined, `law-dot law-dot-${type}`);

    dot.setAttribute('aria-hidden', 'true');

    item.append(dot, element('span', `${count} ${label}`));
    legend.append(item);
  });

  return legend;
}

/* =========================================================
   4. DETALLE DE TEMAS Y ERRORES
   ========================================================= */

function createErrorReview(error) {
  const { question, selected, number } = error;
  const details = element('details', undefined, 'law-error-review');

  details.append(element(
    'summary',
    `Pregunta ${number}: ${question.question}`
  ));

  const content = element('div', undefined, 'law-error-content');

  content.append(
    element(
      'p',
      `Tu respuesta: ${question.options[selected]}`,
      'law-error-selected'
    ),
    element(
      'p',
      `Respuesta correcta: ${question.options[question.answer]}`,
      'law-error-correct'
    ),
    element('p', question.explanation),
    element('p', question.reference, 'law-error-reference')
  );

  details.append(content);

  return details;
}

function createTopicRow(topic) {
  const errors = topic.answered - topic.hits;
  const pending = topic.total - topic.answered;
  const performance = getPerformance(topic.hits, topic.answered);

  const row = element('article', undefined, 'law-topic-row');
  const heading = element('div', undefined, 'law-topic-heading');

  heading.append(
    element('h5', topic.topic.replace(/^Normativa · /, '')),
    element(
      'span',
      performance.percent === null
        ? 'Pendiente'
        : `${performance.label} · ${performance.percent}%`,
      `law-badge law-badge-${performance.status}`
    )
  );

  row.append(
    heading,
    element(
      'p',
      `${topic.hits} aciertos · ${errors} errores · ` +
      `${pending} pendientes`,
      'law-topic-stats'
    )
  );

  if (!topic.answered) {
    row.append(element(
      'p',
      'Responde preguntas de este tema para conocer tu desempeño.',
      'law-topic-note'
    ));
  } else if (topic.answered < 3) {
    row.append(element(
      'p',
      'Resultado preliminar: aún hay pocas respuestas.',
      'law-topic-note'
    ));
  }

  if (errors) {
    row.append(element(
      'p',
      'Revisa estos casos para identificar qué debes reforzar:',
      'law-topic-guidance'
    ));

    topic.errors.forEach(error => {
      row.append(createErrorReview(error));
    });
  }

  return row;
}

function createLawDetails(law) {
  const content = element('div', undefined, 'law-detail-content');
  const topics = sortTopics(law.topics.values());

  const failedTopics = topics.filter(
    topic => topic.answered > topic.hits
  );

  content.append(element('h4', 'Dónde reforzar'));

  if (failedTopics.length) {
    const totalErrors = law.answered - law.hits;

    content.append(element(
      'p',
      `${totalErrors} errores en ${failedTopics.length} ` +
      `${failedTopics.length === 1 ? 'tema' : 'temas'}. ` +
      'Los temas con errores aparecen primero. Abre cada caso para repasar.',
      'law-detail-intro'
    ));
  } else {
    content.append(element(
      'p',
      law.answered
        ? 'No tienes errores en esta ley hasta ahora.'
        : 'Todavía no has respondido preguntas de esta ley.',
      'law-detail-intro'
    ));
  }

  topics.forEach(topic => {
    content.append(createTopicRow(topic));
  });

  return content;
}

/* =========================================================
   5. PANEL PRINCIPAL
   ========================================================= */

export function renderTopicIndicators(state, container) {
  if (!container) return;

  // Cada nueva ronda comienza con los detalles cerrados.
  if (currentRound !== state.questions) {
    expandedLaws.clear();
    currentRound = state.questions;
  }

  container.replaceChildren();

  if (!state.questions.length) return;

  const panel = element('section', undefined, 'law-performance');
  const heading = element('div', undefined, 'law-performance-heading');

  heading.append(
    element('h3', 'Tu desempeño por ley'),
    element(
      'p',
      'Abre una ley para ver los temas que debes reforzar.',
      'law-performance-note'
    )
  );

  panel.append(heading);

  if (state.mode === 'exam' && !state.finished) {
    panel.append(element(
      'p',
      'Los resultados estarán disponibles al terminar el simulacro.',
      'law-exam-message'
    ));

    container.append(panel);
    return;
  }

  const laws = collectLaws(state);

  panel.append(element(
    'p',
    'El aro representa aciertos, errores y pendientes de esta ronda. ' +
    'El porcentaje se calcula sobre las respuestas registradas.',
    'law-performance-note'
  ));

  const list = element('div', undefined, 'law-performance-list');

  laws.forEach(law => {
    const performance = getPerformance(law.hits, law.answered);
    const details = element('details', undefined, 'law-card');

    details.open = expandedLaws.has(law.law);

    const summary = element('summary', undefined, 'law-card-summary');
    const info = element('span', undefined, 'law-summary-info');
    const title = element('span', undefined, 'law-summary-title');

    title.append(
      element('strong', law.law),
      element(
        'span',
        performance.label,
        `law-badge law-badge-${performance.status}`
      )
    );

    info.append(
      title,
      element(
        'span',
        `${law.answered} de ${law.total} preguntas respondidas`,
        'law-summary-progress'
      ),
      createLegend(law)
    );

    const affordance = element('span', undefined, 'law-summary-action');
    affordance.setAttribute('aria-hidden', 'true');

    affordance.append(
      element('span', 'Ver temas', 'law-action-closed'),
      element('span', 'Ocultar temas', 'law-action-open'),
      element('span', '⌄', 'law-chevron')
    );

    summary.append(createDonut(law), info, affordance);
    details.append(summary, createLawDetails(law));

    details.addEventListener('toggle', () => {
      // Ignora eventos de tarjetas que ya fueron reemplazadas.
      if (!details.isConnected) return;

      if (details.open) expandedLaws.add(law.law);
      else expandedLaws.delete(law.law);
    });

    list.append(details);
  });

  panel.append(
    list,
    element(
      'p',
      'Bien: ≥ 80 % · Regular: 60–79 % · Por reforzar: < 60 %. ' +
      'Los resultados con menos de 3 respuestas por tema son preliminares.',
      'law-performance-footer'
    )
  );

  container.append(panel);
}