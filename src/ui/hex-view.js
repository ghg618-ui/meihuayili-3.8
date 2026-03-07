/**
 * Hexagram Rendering View
 */
import { $ } from '../utils/dom.js';
import { getEnergyState } from '../core/bagua-data.js';
import GanzhiCalendar from '../core/ganzhi-calendar.js';

export function renderResultView(container, result, isNew = true) {
    if (!container) return;
    container.classList.remove('hidden');

    // Month info
    const mi = result.energy.monthInfo;
    const nextDateStr = mi.nextJieDate ? GanzhiCalendar.formatJieDate(mi.nextJieDate) : '';
    const monthLabel = $('#month-info-label');
    if (monthLabel) {
        monthLabel.textContent = `${mi.jieQi}后 · ${mi.branch}月(${mi.element})能量场${nextDateStr ? ' → ' + mi.nextJieQi + ' ' + nextDateStr : ''}`;
    }

    // Render Cards
    const monthElement = result.energy.monthInfo.element;
    renderHexCard('original', result.original, result.movingYao, monthElement, result.movingYao);
    renderHexCard('changed', result.changed, null, monthElement, result.movingYao);
    renderHexCard('opposite', result.opposite, null, monthElement, result.movingYao);

    if (isNew) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export function renderHexCard(type, hexData, movingYao, monthElement, originalMovingYao) {
    const cardEl = $(`#hex-${type}-card`);
    if (!cardEl) return;

    const uEnergy = getEnergyState(hexData.upperTrigram.element, monthElement);
    const lEnergy = getEnergyState(hexData.lowerTrigram.element, monthElement);
    const getEnergyClass = (e) => ({ '旺': 'energy-wang', '相': 'energy-xiang', '休': 'energy-xiu', '囚': 'energy-qiu', '死': 'energy-si' }[e] || '');

    let upperBadge = '';
    let lowerBadge = '';
    if (originalMovingYao) {
        if (originalMovingYao >= 4) {
            upperBadge = '<span class="tiyong-badge-mini ti-bg">体</span>';
            lowerBadge = '<span class="tiyong-badge-mini yong-bg">用</span>';
        } else {
            upperBadge = '<span class="tiyong-badge-mini yong-bg">用</span>';
            lowerBadge = '<span class="tiyong-badge-mini ti-bg">体</span>';
        }
    }

    cardEl.innerHTML = `
        <div class="hex-card-header">${type === 'original' ? '本卦' : type === 'changed' ? '变卦' : '对卦'}</div>
        <div class="hex-main-grid">
            <div class="trigram-info-left">
                <div class="tri-energy-group">
                    ${upperBadge}
                    <div class="tri-text-block">
                        <span class="tri-text">${hexData.upperTrigram.name}${hexData.upperTrigram.element}</span>
                        <span class="tri-energy-state ${getEnergyClass(uEnergy)}">${uEnergy}</span>
                    </div>
                </div>
                <div class="tri-energy-group">
                    ${lowerBadge}
                    <div class="tri-text-block">
                        <span class="tri-text">${hexData.lowerTrigram.name}${hexData.lowerTrigram.element}</span>
                        <span class="tri-energy-state ${getEnergyClass(lEnergy)}">${lEnergy}</span>
                    </div>
                </div>
            </div>
            <div class="hex-symbol" id="hex-${type}-symbol-inner"></div>
        </div>
        <div class="hex-name">${hexData.name}</div>
    `;

    const symbolInner = $(`#hex-${type}-symbol-inner`);
    if (!symbolInner) return;

    const lines = hexData.lines;
    for (let i = 5; i >= 0; i--) {
        const lineValue = lines[i];
        const div = document.createElement('div');
        div.className = 'yao-line ' + (lineValue === 1 ? 'yang' : 'yin');

        if (lineValue === 0) {
            const s1 = document.createElement('div'); s1.className = 'yin-segment';
            const s2 = document.createElement('div'); s2.className = 'yin-segment';
            div.appendChild(s1); div.appendChild(s2);
        }

        if (movingYao && i === (movingYao - 1)) {
            div.classList.add('is-moving');
            const marker = document.createElement('div');
            marker.className = 'moving-marker';
            div.appendChild(marker);
        }
        symbolInner.appendChild(div);
    }
}


