import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RiskService } from '../../risks/risk.service';
import { MasterDataService } from '../master-data.service';
import { AdminRiskRulesComponent } from './admin-risk-rules.component';

describe('AdminRiskRulesComponent', () => {
  let fixture: ComponentFixture<AdminRiskRulesComponent>;
  let component: AdminRiskRulesComponent;
  const rules = [
    { ruleCode: 'HEAT_CRASH', categoryId: null, enabled: true, thresholdJson: { slope7dThreshold: -0.4 } },
    {
      ruleCode: 'LOGISTICS_RISK', categoryId: null, enabled: true, maxPenalty: 10,
      thresholdJson: { conditions: ['FROZEN', 'FRAGILE'], fragilePoints: 3, coldChainPoints: 4, oversizedPoints: 3, meltableSummerPoints: 4 },
    },
    { ruleCode: 'INVENTORY_RISK', categoryId: 12, enabled: true, maxPenalty: 10, thresholdJson: { shelfLifeDaysThreshold: 10, shortShelfLifePoints: 4, seasonalPoints: 3, moqThreshold: 200, highMoqPoints: 3 } },
    { ruleCode: 'PENALTY_CAP', categoryId: null, enabled: true, thresholdJson: { penaltySubtotalThreshold: 20 } },
  ];
  const risks = { getRiskRules: vi.fn(), updateRuleThreshold: vi.fn() };
  const masterData = { categories: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    risks.getRiskRules.mockReturnValue(of({ rules: structuredClone(rules), recalculation: { running: false, progressPercent: 0 } }));
    risks.updateRuleThreshold.mockReturnValue(of({}));
    masterData.categories.mockReturnValue(of([{ id: 1, name: '食品', sortOrder: 0, children: [{ id: 12, name: '生鮮冷凍', sortOrder: 0, children: [] }] }]));
    await TestBed.configureTestingModule({
      imports: [AdminRiskRulesComponent],
      providers: [
        { provide: RiskService, useValue: risks },
        { provide: MasterDataService, useValue: masterData },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminRiskRulesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('splits penalty rules from alert rules and never renders raw JSON', () => {
    expect(component.penaltyDrafts().map((draft) => draft.rule.ruleCode)).toEqual(['LOGISTICS_RISK', 'INVENTORY_RISK', 'PENALTY_CAP']);
    expect(component.alertDrafts().map((draft) => draft.rule.ruleCode)).toEqual(['HEAT_CRASH']);
    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toContain('{');
    expect(text).toContain('僅「生鮮冷凍」');
    expect(text).toContain('冷凍');
  });

  it('saves the heat crash drop percentage as a negative slope', () => {
    const draft = component.alertDrafts()[0];
    expect(draft.values['slope7dThreshold']).toBe(40);
    draft.values['slope7dThreshold'] = 35;

    component.save(draft);

    expect(risks.updateRuleThreshold).toHaveBeenCalledWith('HEAT_CRASH', { slope7dThreshold: -0.35 }, null, undefined);
  });

  it('keeps fields the form does not edit, such as logistics conditions', () => {
    const draft = component.penaltyDrafts()[0];
    draft.values['fragilePoints'] = 5;
    draft.maxPenalty = 8;

    component.save(draft);

    expect(risks.updateRuleThreshold).toHaveBeenCalledWith(
      'LOGISTICS_RISK',
      expect.objectContaining({ conditions: ['FROZEN', 'FRAGILE'], fragilePoints: 5 }),
      null,
      8,
    );
  });

  it('does not save invalid or unchanged rules', () => {
    const draft = component.alertDrafts()[0];
    component.save(draft);
    draft.values['slope7dThreshold'] = 0;
    expect(component.hasErrors(draft)).toBe(true);
    component.save(draft);
    expect(risks.updateRuleThreshold).not.toHaveBeenCalled();
  });

  it('locks PENALTY_CAP', () => {
    expect(component.penaltyDrafts()[2].locked).toContain('不開放調整');
  });
});
