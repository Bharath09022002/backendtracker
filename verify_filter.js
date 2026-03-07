const mongoose = require('mongoose');
const { handleSafetyCheck } = require('./src/utils/safetyFilter');
const User = require('./src/models/User');

async function runTests() {
    console.log('--- Starting Safety Filter Verification ---');

    // 1. Mock a User
    const userId = new mongoose.Types.ObjectId();
    let user = {
        _id: userId,
        strikeTimestamps: [],
        save: async function () {
            console.log(`[User Save] Strikes: ${this.strikeTimestamps.length}`);
            return this;
        }
    };

    // 2. Test Cases
    const testCases = [
        { name: 'Clean Content', content: 'Hello how are you?', expected: false },
        { name: 'Harmful English (kill)', content: 'I want to kill myself', expected: true },
        { name: 'Harmful Tamil (punda)', content: 'Nee oru punda', expected: true },
        { name: 'Harmful Mixed', content: 'You should go poi sethuru', expected: true },
    ];

    for (const tc of testCases) {
        console.log(`\nTesting: "${tc.name}" | Content: "${tc.content}"`);
        const result = await handleSafetyCheck(user, tc.content);

        if (result.isHarmful === tc.expected) {
            console.log(`✅ PASS: ${tc.name}`);
            if (result.isHarmful) {
                console.log(`   Message: ${result.error}`);
            }
        } else {
            console.log(`❌ FAIL: ${tc.name} | Expected harmful: ${tc.expected}, Got: ${result.isHarmful}`);
        }
    }

    // 3. Test Strike Increment and Deletion
    console.log('\n--- Testing Strike Cap ---');
    // Clear user strikes
    user.strikeTimestamps = [];

    // 4 Strikes
    for (let i = 1; i <= 4; i++) {
        const result = await handleSafetyCheck(user, 'punda');
        console.log(`Strike ${i}: ${result.strikes}/5`);
    }

    // 5th Strike (Should trigger deletion logic)
    console.log('\nTesting 5th Strike...');
    // We need to bypass actual DB call for deletion in this script or mock User.findByIdAndDelete
    const originalDeleteOne = User.findByIdAndDelete;
    User.findByIdAndDelete = async (id) => {
        console.log(`[DB MOCK] Deleting user ${id} due to 5th strike.`);
        return { _id: id };
    };

    const Habit = require('./src/models/Habit');
    const originalHabitDeleteMany = Habit.deleteMany;
    Habit.deleteMany = async (query) => {
        console.log(`[DB MOCK] Deleting habits for query: ${JSON.stringify(query)}`);
        return { deletedCount: 1 };
    };

    const finalResult = await handleSafetyCheck(user, 'punda');
    console.log(`Final Result: ${finalResult.error}`);

    if (finalResult.error.includes('ACCOUNT DELETED')) {
        console.log('✅ PASS: Account deletion triggered on 5th strike.');
    } else {
        console.log('❌ FAIL: Account deletion not triggered.');
    }

    // Restore
    User.findByIdAndDelete = originalDeleteOne;
    Habit.deleteMany = originalHabitDeleteMany;

    console.log('\n--- Verification Complete ---');

}

runTests().catch(err => {
    console.error('ERROR during verification:', err);
});
