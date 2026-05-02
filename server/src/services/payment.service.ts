export interface PaymentDetails {
    userName: string;
    userEmail: string;
    price: number;
}

// Swap this body for a real gateway (Stripe, PayPal, etc.) when ready.
//
// Rules that must always hold so the ACID transaction in ReservationService works:
//   - Resolve normally on success
//   - THROW an AppError (or any Error) on failure
//
// This runs inside AppDataSource.transaction(), so any thrown error rolls back
// the concert decrement and ticket insert automatically.
// If you charge the customer before the DB write fails, refund here before
// re-throwing so money and database stay in sync.
export async function processPayment(_details: PaymentDetails): Promise<void> {
    // TODO: replace with real gateway, e.g. Stripe:
    //
    // const intent = await stripe.paymentIntents.create({
    //     amount: Math.round(_details.price * 100),
    //     currency: "usd",
    //     receipt_email: _details.userEmail,
    // });
    // if (intent.status !== "succeeded") {
    //     throw new AppError(402, "Payment declined");
    // }
    //
    // Simulate a failure during development by uncommenting:
    // throw new AppError(402, "Payment declined");
}