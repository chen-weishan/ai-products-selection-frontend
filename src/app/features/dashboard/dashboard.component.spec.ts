import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { DashboardControllerService } from '../../api/api/dashboardController.service';
import { signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockDashboardService: any;
  const currentUser = signal<any>({ roles: ['BUYER'] });

  beforeEach(async () => {
    currentUser.set({ roles: ['BUYER'] });
    mockDashboardService = {
      getSummary: vi.fn().mockReturnValue(of({
        kpi: {
          totalCandidates: 25,
          aGradeCount: 5,
          openRiskCount: 2,
          overdueFeedbackCount: 1
        },
        scoringExecuted: true
      })),
      getRankings: vi.fn().mockReturnValue(of({
        data: {
          viral: [
            { productId: 1, productName: '測試話題爆款商品', finalScore: 92, grade: 'A', sceneType: 'VIRAL', riskLevel: 'NONE' }
          ],
          festival: [
            { productId: 2, productName: '測試節慶商品', finalScore: 85, grade: 'B', sceneType: 'FESTIVAL', riskLevel: 'MEDIUM' }
          ],
          replenishment: [],
          seasonal: []
        }
      })),
      getSourcingSummary: vi.fn().mockReturnValue(of({
        data: {
          items: [
            { productId: 3, productName: '測試尋源商品', timeGapDays: 2 }
          ]
        }
      })),
      getTodos: vi.fn().mockReturnValue(of({
        data: {
          overdueCampaigns: [
            { productId: 4, productName: '測試逾期活動', overdueDays: 10 }
          ]
        }
      })),
      getHeatSources: vi.fn().mockReturnValue(of({
        data: {
          items: [
            { sourceCode: 'THREADS', availability: 'AVAILABLE', quotaUsed: 100, quotaLimit: 200 }
          ]
        }
      }))
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser, hasRole: (roles: string[]) => currentUser().roles.some((role: string) => roles.includes(role)) } },
        { provide: DashboardControllerService, useValue: mockDashboardService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('hides the quick heat-tag entry for a viewer', () => {
    expect(fixture.nativeElement.textContent).toContain('我看到一個');
    currentUser.set({ roles: ['VIEWER'] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('我看到一個');
  });

  it('should create and load initial dashboard data', () => {
    expect(component).toBeTruthy();
    expect(mockDashboardService.getSummary).toHaveBeenCalled();
    expect(mockDashboardService.getRankings).toHaveBeenCalled();
    expect(component.viralRankings.length).toBe(1);
    expect(component.viralRankings[0].productName).toBe('測試話題爆款商品');
    expect(component.dashboardSummary.totalCandidates).toBe(25);
  });

  it('should switch tabs smoothly and return corresponding rankings', () => {
    expect(component.activeTab).toBe('viral');
    expect(component.getRankingsForTab('viral').length).toBe(1);

    component.switchTab('festival');
    fixture.detectChanges();

    expect(component.activeTab).toBe('festival');
    expect(component.getRankingsForTab('festival').length).toBe(1);
    expect(component.getRankingsForTab('festival')[0].productName).toBe('測試節慶商品');
  });

  it('should switch track to B and reload data including sourcing summary', () => {
    component.switchTrack('B');
    fixture.detectChanges();

    expect(component.activeTrack).toBe('B');
    expect(mockDashboardService.getRankings).toHaveBeenCalledWith(
      expect.objectContaining({ track: 'B' }),
      'body',
      false,
      expect.objectContaining({ httpHeaderAccept: 'application/json' })
    );
    expect(mockDashboardService.getSourcingSummary).toHaveBeenCalled();
  });

  it('should switch period to lastWeek and reload rankings', () => {
    component.switchPeriod('lastWeek');
    fixture.detectChanges();

    expect(component.activePeriod).toBe('lastWeek');
    expect(mockDashboardService.getRankings).toHaveBeenCalled();
  });

  it('should handle Blob response and parse JSON asynchronously', async () => {
    const blobData = JSON.stringify({
      viral: [{ productId: 99, productName: 'Blob話題品項', finalScore: 90, grade: 'A', sceneType: 'VIRAL', riskLevel: 'NONE' }]
    });
    const blob = new Blob([blobData], { type: 'application/json' });
    mockDashboardService.getRankings.mockReturnValue(of(blob));

    component.reload();
    await new Promise(resolve => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(component.viralRankings.length).toBe(1);
    expect(component.viralRankings[0].productName).toBe('Blob話題品項');
  });
});
