import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VolunteerDeliveryService, Volunteer, MealTask } from './volunteer-delivery.service';

@Component({
  selector: 'app-volunteer-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './volunteer-selector.component.html',
  styleUrls: ['./volunteer-selector.component.css'],
})
export class VolunteerSelectorComponent {
  @Input() date: string = '';
  @Input() volunteers: Volunteer[] = [];
  @Input() tasks: MealTask[] = [];

  @Output() selectVolunteer = new EventEmitter<string>();
  @Output() goBack = new EventEmitter<void>();

  constructor(private deliveryService: VolunteerDeliveryService) {}

  getRouteGroups() {
    return this.deliveryService.getAllVolunteerRouteGroups(
      this.date,
      this.tasks,
      this.volunteers,
    );
  }

  getProgressPct(taskCount: number, completedCount: number): number {
    if (taskCount === 0) return 0;
    return Math.round((completedCount / taskCount) * 100);
  }

  onSelectVolunteer(volunteerId: string) {
    this.selectVolunteer.emit(volunteerId);
  }

  onGoBack() {
    this.goBack.emit();
  }
}
