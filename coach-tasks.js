/**
 * Coach Tasks Management
 * Displays pending technique checks from clients and payment requests
 */

export class CoachTasks {
  constructor() {
    this.techniqueChecks = [];
    this.paymentRequests = [];
  }

  async init() {
    document.addEventListener('sessionReady', () => this.loadTasks());
    window.addEventListener('taskUpdated', () => this.loadTasks());
  }

  async loadTasks() {
    if (!window.session) return;
    try {
      this.techniqueChecks = await window.DB.getPendingTechniqueChecks(window.session.id);
      this.paymentRequests = await window.DB.getPendingPayments(window.session.id);
      this.updateTaskCount();
      this.renderTechniqueChecks();
      this.renderPaymentRequests();
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }

  updateTaskCount() {
    const total = this.techniqueChecks.length + this.paymentRequests.length;
    document.getElementById('tasks-count').textContent = total;
  }

  renderTechniqueChecks() {
    const container = document.getElementById('technique-checks-list');
    const noChecksEl = document.getElementById('no-technique-checks');

    if (this.techniqueChecks.length === 0) {
      container.innerHTML = '';
      noChecksEl.style.display = 'block';
      return;
    }

    noChecksEl.style.display = 'none';
    container.innerHTML = this.techniqueChecks.map(check => `
      <div class="task-card" onclick="reviewTechniqueCheck('${check.id}')">
        <div class="task-exercise-label">${check.clientName} · ${check.exercise}</div>
        <div class="task-client-info">
          <div class="task-client-name">${check.exercise}</div>
          <div class="task-time-submitted">${this.formatTimeAgo(check.submittedAt)}</div>
        </div>
      </div>
    `).join('');
  }

  renderPaymentRequests() {
    const container = document.getElementById('payment-requests-list');
    const noPaymentsEl = document.getElementById('no-payment-requests');

    if (this.paymentRequests.length === 0) {
      container.innerHTML = '';
      noPaymentsEl.style.display = 'block';
      return;
    }

    noPaymentsEl.style.display = 'none';
    container.innerHTML = this.paymentRequests.map(payment => `
      <div class="task-card">
        <div class="task-exercise-label" style="background: rgba(239, 68, 68, .15); color: var(--red)">Membership Renewal</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
          <div>
            <div class="task-client-name">${payment.clientName}</div>
            <div class="task-time-submitted">${this.formatCurrency(payment.amount)}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" onclick="declinePayment('${payment.id}')" style="padding:6px 12px;font-size:12px">Decline</button>
            <button class="btn btn-primary" onclick="acceptPayment('${payment.id}')" style="padding:6px 12px;font-size:12px">Accept</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  formatTimeAgo(date) {
    const now = new Date();
    const submitted = new Date(date);
    const minutes = Math.floor((now - submitted) / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  formatCurrency(amount) {
    return `$${amount.toFixed(2)}`;
  }
}

// Global functions for HTML onclick handlers
window.reviewTechniqueCheck = (checkId) => {
  if (!window.coachTasks) return;
  const check = window.coachTasks.techniqueChecks.find(c => c.id === checkId);
  if (!check) return;

  // Open technique review modal
  const modal = document.getElementById('modal-technique-review') || createTechniqueReviewModal();
  document.getElementById('technique-check-id').value = checkId;
  document.getElementById('technique-client-name').textContent = check.clientName;
  document.getElementById('technique-exercise').textContent = check.exercise;
  document.getElementById('technique-feedback').value = '';
  document.getElementById('technique-rating').value = '3';

  // Clear stars
  document.querySelectorAll('.star').forEach(star => star.classList.remove('active'));

  modal.classList.add('open');
};

window.submitTechniqueReview = async () => {
  const checkId = document.getElementById('technique-check-id').value;
  const feedback = document.getElementById('technique-feedback').value;
  const rating = parseInt(document.getElementById('technique-rating').value);

  if (!feedback.trim()) {
    window.toast('Please enter feedback', 'error');
    return;
  }

  try {
    // Send feedback to client
    await window.DB.submitTechniqueReview(checkId, feedback, rating);

    // Send feedback message to client
    const check = window.coachTasks.techniqueChecks.find(c => c.id === checkId);
    const message = `📝 Coach feedback on ${check.exercise}:\n\n${feedback}\n\nRating: ${'⭐'.repeat(rating)}`;
    await window.DB.sendAutoMessage(check.clientId, message, 'technique-feedback');

    window.toast('Feedback sent! 📨');
    window.closeModal('modal-technique-review');

    // Reload tasks
    if (window.coachTasks) {
      await window.coachTasks.loadTasks();
    }
  } catch (err) {
    console.error('Failed to submit review:', err);
    window.toast('Failed to submit review', 'error');
  }
};

window.rateStars = (rating) => {
  document.getElementById('technique-rating').value = rating;
  document.querySelectorAll('.star').forEach((star, idx) => {
    if (idx < rating) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
};

window.acceptPayment = async (paymentId) => {
  try {
    await window.DB.acceptPayment(paymentId);
    const payment = window.coachTasks.paymentRequests.find(p => p.id === paymentId);
    window.toast(`✅ Payment accepted from ${payment.clientName}`);
    if (window.coachTasks) {
      await window.coachTasks.loadTasks();
    }
  } catch (err) {
    console.error('Failed to accept payment:', err);
    window.toast('Failed to accept payment', 'error');
  }
};

window.declinePayment = async (paymentId) => {
  if (!confirm('Are you sure you want to decline this payment?')) return;

  try {
    await window.DB.declinePayment(paymentId);
    const payment = window.coachTasks.paymentRequests.find(p => p.id === paymentId);
    window.toast(`❌ Payment declined for ${payment.clientName}`);
    if (window.coachTasks) {
      await window.coachTasks.loadTasks();
    }
  } catch (err) {
    console.error('Failed to decline payment:', err);
    window.toast('Failed to decline payment', 'error');
  }
};

// Initialize on load
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CoachTasks };
}
