import React, { useState, useEffect } from 'react';
import { Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title);

// Property tax calculation
const calculatePropertyTax = (propertyValue, mode, customAmount) => {
    if (propertyValue <= 0) return 0;

    if (mode === 'oslo') {
        const taxableBase = Math.max(0, (propertyValue * 0.7) - 4700000);
        return taxableBase * 0.00235;
    } else {
        return customAmount;
    }
};

// Main App Component
const App = () => {
    // State for calculation mode
    const [calculationMode, setCalculationMode] = useState('byPrice'); // 'byPayment' or 'byPrice'

    // Inputs
    const [loanType, setLoanType] = useState('annuity');
    const [interestRate, setInterestRate] = useState(5.2);
    const [loanTerm, setLoanTerm] = useState(25);
    const [downPayment1, setDownPayment1] = useState(1000000);
    const [downPayment2, setDownPayment2] = useState(0);
    const [ownershipSplit, setOwnershipSplit] = useState(100);
    const [municipalDues, setMunicipalDues] = useState(15000);
    const [homeInsurance, setHomeInsurance] = useState(0);
    const [hoa, setHoa] = useState(0);
    const [maintenance, setMaintenance] = useState(24000);
    const [annualAppreciation, setAnnualAppreciation] = useState(3.0);
    const [requiredReturn, setRequiredReturn] = useState(5.0);
    const [rentalIncome, setRentalIncome] = useState(0);

    // Property tax settings
    const [propertyTaxMode, setPropertyTaxMode] = useState('oslo'); // 'oslo' or 'custom'
    const [customPropertyTaxAmount, setCustomPropertyTaxAmount] = useState(5000);

    // Mode-specific inputs
    const [desiredMonthlyPayment, setDesiredMonthlyPayment] = useState(20000);
    const [propertyValue, setPropertyValue] = useState(5000000);

    // Calculated Outputs
    const [loanAmount, setLoanAmount] = useState(0);
    const [finalPropertyValue, setFinalPropertyValue] = useState(0);
    const [calculatedMonthlyPayment, setCalculatedMonthlyPayment] = useState(0);
    const [amortizationData, setAmortizationData] = useState([]);
    const [payoffDate, setPayoffDate] = useState('');
    const [totalMonthlyCost, setTotalMonthlyCost] = useState(0);
    const [netMonthlyCost, setNetMonthlyCost] = useState(0);
    const [totalInterest, setTotalInterest] = useState(0);
    const [loanDetails1, setLoanDetails1] = useState({ amount: 0, payment: 0 });
    const [loanDetails2, setLoanDetails2] = useState({ amount: 0, payment: 0 });
    const [propertyTax, setPropertyTax] = useState(0);

    // Effect to recalculate on input changes
    useEffect(() => {
        // FIX 3: Replaced the simple estimation with an iterative calculation for better accuracy
        const calculateAffordability = (totalDownPayment) => {
            if (desiredMonthlyPayment <= 0 || interestRate <= 0 || loanTerm <= 0) {
                return { maxLoan: 0, maxPropertyPrice: totalDownPayment };
            }

            const monthlyInterestRate = interestRate / 100 / 12;
            const numberOfPayments = loanTerm * 12;

            let estimatedPropertyValue = desiredMonthlyPayment * 200; // Start with a rough guess
            let maxLoan = 0;

            // Iterate a few times to find a stable property value
            for (let i = 0; i < 10; i++) {
                const estimatedPropertyTax = calculatePropertyTax(estimatedPropertyValue, propertyTaxMode, customPropertyTaxAmount);
                const otherCosts = (municipalDues / 12) + (homeInsurance / 12) + (estimatedPropertyTax / 12) + hoa;
                const pAndI = desiredMonthlyPayment + Number(rentalIncome) - otherCosts;

                if (pAndI <= 0) {
                    maxLoan = 0;
                    break;
                }

                if (loanType === 'annuity') {
                    maxLoan = pAndI * ((Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1) / (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)));
                } else { // Serial loan
                    maxLoan = pAndI / ((1 / numberOfPayments) + monthlyInterestRate);
                }

                const newEstimatedPropertyValue = maxLoan + totalDownPayment;
                // If the value has stabilized, break the loop
                if (Math.abs(newEstimatedPropertyValue - estimatedPropertyValue) < 1000) {
                    estimatedPropertyValue = newEstimatedPropertyValue;
                    break;
                }
                estimatedPropertyValue = newEstimatedPropertyValue;
            }

            maxLoan = maxLoan > 0 ? maxLoan : 0;
            return { maxLoan, maxPropertyPrice: maxLoan + totalDownPayment };
        };

        const calculateLoanDetails = (amount) => {
            if (amount <= 0) return { firstMonthPayment: 0, totalInterestPaid: 0, amortization: [] };

            const monthlyInterestRate = interestRate / 100 / 12;
            const numberOfPayments = loanTerm * 12;

            let balance = amount;
            const amortization = [];
            let totalInterestPaid = 0;
            let firstMonthPayment = 0;

            if (loanType === 'annuity') {
                const M = amount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) / (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
                firstMonthPayment = M;
                for (let i = 1; i <= numberOfPayments; i++) {
                    if (balance <= 0) break;
                    const interestPayment = balance * monthlyInterestRate;
                    const principalPayment = M - interestPayment;
                    balance -= principalPayment;
                    totalInterestPaid += interestPayment;
                    amortization.push({ month: i, principal: principalPayment, interest: interestPayment, balance: balance < 0 ? 0 : balance, totalPayment: M });
                }
            } else { // Serial Loan
                const principalPerMonth = amount / numberOfPayments;
                for (let i = 1; i <= numberOfPayments; i++) {
                    if (balance <= 0) break;
                    const interestPayment = balance * monthlyInterestRate;
                    const totalPaymentThisMonth = principalPerMonth + interestPayment;
                    if (i === 1) firstMonthPayment = totalPaymentThisMonth;
                    balance -= principalPerMonth;
                    totalInterestPaid += interestPayment;
                    amortization.push({ month: i, principal: principalPerMonth, interest: interestPayment, balance: balance < 0 ? 0 : balance, totalPayment: totalPaymentThisMonth });
                }
            }
            return { firstMonthPayment, totalInterestPaid, amortization };
        };

        const totalDownPayment = downPayment1 + downPayment2;
        let currentLoanAmount = 0;
        let currentPropertyValue = 0;

        if (calculationMode === 'byPayment') {
            const { maxLoan, maxPropertyPrice } = calculateAffordability(totalDownPayment);
            currentLoanAmount = maxLoan;
            currentPropertyValue = maxPropertyPrice;
        } else { // 'byPrice'
            currentPropertyValue = propertyValue;
            // The logic for splitting loans based on ownership is kept as per your model
            const ownershipValue1 = propertyValue * (ownershipSplit / 100);
            const loan1_needed = Math.max(0, ownershipValue1 - downPayment1);
            const ownershipValue2 = propertyValue * ((100 - ownershipSplit) / 100);
            const loan2_needed = Math.max(0, ownershipValue2 - downPayment2);
            currentLoanAmount = loan1_needed + loan2_needed;
        }

        setFinalPropertyValue(currentPropertyValue);

        const ownershipValue1 = currentPropertyValue * (ownershipSplit / 100);
        const ownershipValue2 = currentPropertyValue * ((100 - ownershipSplit) / 100);

        const finalLoan1 = Math.max(0, ownershipValue1 - downPayment1);
        const finalLoan2 = Math.max(0, ownershipValue2 - downPayment2);

        const totalLoanAmount = finalLoan1 + finalLoan2;
        setLoanAmount(totalLoanAmount);

        if (totalLoanAmount <= 0) {
            setCalculatedMonthlyPayment(0);
            setLoanDetails1({ amount: 0, payment: 0 });
            setLoanDetails2({ amount: 0, payment: 0 });
            setTotalInterest(0);
            setAmortizationData([]);
        } else {
            const details1 = calculateLoanDetails(finalLoan1);
            const details2 = calculateLoanDetails(finalLoan2);

            setLoanDetails1({ amount: finalLoan1, payment: details1.firstMonthPayment });
            setLoanDetails2({ amount: finalLoan2, payment: details2.firstMonthPayment });
            setTotalInterest(details1.totalInterestPaid + details2.totalInterestPaid);
            setCalculatedMonthlyPayment(details1.firstMonthPayment + details2.firstMonthPayment);

            // FIX 1: Create a combined amortization schedule that correctly reflects two separate loans
            const correctCombinedAmortization = [];
            const numberOfPayments = loanTerm * 12;
            for (let i = 0; i < numberOfPayments; i++) {
                const monthData1 = details1.amortization[i] || { balance: 0, principal: 0, interest: 0, totalPayment: 0 };
                const monthData2 = details2.amortization[i] || { balance: 0, principal: 0, interest: 0, totalPayment: 0 };

                correctCombinedAmortization.push({
                    month: i + 1,
                    balance: monthData1.balance + monthData2.balance,
                    principal: monthData1.principal + monthData2.principal,
                    interest: monthData1.interest + monthData2.interest,
                    totalPayment: monthData1.totalPayment + monthData2.totalPayment,
                });
            }
            setAmortizationData(correctCombinedAmortization);
        }

        const calculatedPropertyTax = calculatePropertyTax(currentPropertyValue, propertyTaxMode, customPropertyTaxAmount);
        setPropertyTax(calculatedPropertyTax);

    }, [calculationMode, desiredMonthlyPayment, propertyValue, interestRate, loanTerm, downPayment1, downPayment2, municipalDues, homeInsurance, hoa, maintenance, annualAppreciation, requiredReturn, rentalIncome, loanType, ownershipSplit, propertyTaxMode, customPropertyTaxAmount]);

    useEffect(() => {
        const monthlyFixedCosts = (municipalDues / 12) + (homeInsurance / 12) + (propertyTax / 12) + (maintenance / 12) + hoa;
        const totalCost = calculatedMonthlyPayment + monthlyFixedCosts;
        setTotalMonthlyCost(totalCost);
        setNetMonthlyCost(totalCost - rentalIncome);

        if (loanAmount > 0 && amortizationData.length > 0) {
            const payoff = new Date();
            payoff.setMonth(payoff.getMonth() + amortizationData.length);
            setPayoffDate(payoff.toLocaleDateString('nb-NO', { year: 'numeric', month: 'long' }));
        } else {
            setPayoffDate('N/A');
        }

    }, [calculatedMonthlyPayment, municipalDues, homeInsurance, hoa, maintenance, rentalIncome, loanAmount, amortizationData, propertyTax]);

    const totalDownPayment = downPayment1 + downPayment2;
    const downPaymentPercentage1 = totalDownPayment > 0 ? (downPayment1 / totalDownPayment) * 100 : 0;
    const downPaymentPercentage2 = totalDownPayment > 0 ? (downPayment2 / totalDownPayment) * 100 : 0;

    const yearsToPayoff = amortizationData.length > 0 ? amortizationData.length / 12 : loanTerm;
    const futurePropertyValue = finalPropertyValue * Math.pow(1 + (annualAppreciation / 100), yearsToPayoff);
    const totalEquityGain = futurePropertyValue - finalPropertyValue;

    // FIX 2: Complete rewrite of NPV and related financial metrics for correctness
    const calculateAdvancedMetrics = () => {
        if (yearsToPayoff <= 0 || !amortizationData || amortizationData.length === 0) {
            return { netPresentValue: 0, returnOnEquity: 0 };
        }

        const annualCosts = municipalDues + homeInsurance + propertyTax + maintenance + (hoa * 12);
        const annualRentalIncome = rentalIncome * 12;

        let presentValueOfAllCashFlows = 0;
        for (let year = 1; year <= yearsToPayoff; year++) {
            const startMonth = (year - 1) * 12;
            const endMonth = year * 12;
            const annualLoanPayment = amortizationData.slice(startMonth, endMonth).reduce((sum, month) => sum + month.totalPayment, 0);

            const netCashFlowForYear = annualRentalIncome - annualCosts - annualLoanPayment;

            presentValueOfAllCashFlows += netCashFlowForYear / Math.pow(1 + (requiredReturn / 100), year);
        }

        const presentValueOfFutureSale = futurePropertyValue / Math.pow(1 + (requiredReturn / 100), yearsToPayoff);
        const netPresentValue = presentValueOfAllCashFlows + presentValueOfFutureSale - totalDownPayment;

        const totalOtherCostsPaid = (annualCosts - annualRentalIncome) * yearsToPayoff;
        const netProfit = futurePropertyValue - totalDownPayment - totalInterest - totalOtherCostsPaid;
        const returnOnEquity = totalDownPayment > 0
            ? (Math.pow((totalDownPayment + netProfit) / totalDownPayment, 1 / yearsToPayoff) - 1) * 100
            : 0;

        // Total return comparisons - what you end up with after the investment period
        const totalPropertyReturn = futurePropertyValue - loanAmount + (annualRentalIncome * yearsToPayoff) - (annualCosts * yearsToPayoff) - totalInterest;
        const totalAlternativeReturn = totalDownPayment * Math.pow(1 + (requiredReturn / 100), yearsToPayoff);
        const investmentAdvantage = totalPropertyReturn - totalAlternativeReturn;

        // Separate present value components for detailed breakdown
        let presentValueOfCosts = 0;
        let presentValueOfRentalIncome = 0;
        
        for (let year = 1; year <= yearsToPayoff; year++) {
            const startMonth = (year - 1) * 12;
            const endMonth = year * 12;
            const annualLoanPayment = amortizationData.slice(startMonth, endMonth).reduce((sum, month) => sum + month.totalPayment, 0);
            const totalAnnualCosts = annualCosts + annualLoanPayment;
            
            presentValueOfCosts += totalAnnualCosts / Math.pow(1 + (requiredReturn / 100), year);
            presentValueOfRentalIncome += annualRentalIncome / Math.pow(1 + (requiredReturn / 100), year);
        }

        // Present value comparisons - what both investments are worth in today's money
        const presentValueOfPropertyInvestment = presentValueOfAllCashFlows + presentValueOfFutureSale;
        const presentValueOfAlternativeInvestment = totalDownPayment; // Since invested today
        const presentValueDifference = presentValueOfPropertyInvestment - presentValueOfAlternativeInvestment;

        return { 
            netPresentValue, 
            returnOnEquity, 
            totalPropertyReturn, 
            totalAlternativeReturn, 
            investmentAdvantage,
            presentValueOfPropertyInvestment,
            presentValueOfAlternativeInvestment,
            presentValueDifference,
            presentValueOfFutureSale,
            presentValueOfRentalIncome,
            presentValueOfCosts
        };
    };

    const { 
        netPresentValue, 
        returnOnEquity, 
        totalPropertyReturn, 
        totalAlternativeReturn, 
        investmentAdvantage,
        presentValueOfPropertyInvestment,
        presentValueOfAlternativeInvestment,
        presentValueDifference,
        presentValueOfFutureSale,
        presentValueOfRentalIncome,
        presentValueOfCosts
    } = calculateAdvancedMetrics();
    const isGoodInvestment = returnOnEquity >= requiredReturn && netPresentValue > 0;

    // Chart Data
    const amortizationChartData = {
        labels: amortizationData.map(d => `Måned ${d.month}`),
        datasets: [{ label: 'Gjenværende Lånebalanse', data: amortizationData.map(d => d.balance), borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.2)', fill: true, tension: 0.1, }],
    };
    const paymentBreakdownChartData = {
        labels: ['Avdrag & Renter', 'Kommunale Avgifter', 'Eiendomsskatt', 'Boligforsikring', 'Vedlikehold', 'Felleskostnader'],
        datasets: [ { data: [ calculatedMonthlyPayment, (municipalDues / 12), (propertyTax / 12), (homeInsurance / 12), (maintenance / 12), hoa ].map(v => v > 0 ? v : 0), backgroundColor: ['#4CAF50', '#FFC107', '#FF5722', '#9C27B0', '#FF9800', '#2196F3'], hoverBackgroundColor: ['#66BB6A', '#FFCA28', '#FF7043', '#BA68C8', '#FFB74D', '#42A5F5'],}],
    };

    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 text-center">
                    <h1 className="text-4xl font-bold text-gray-800">Avansert Lånekalkulator</h1>
                    <p className="text-lg text-gray-600 mt-2">Se hva dere har råd til og hvordan kostnadene fordeles.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-3">Kalkuleringsmåte</h2>
                        <div className="flex rounded-md shadow-sm mb-6">
                            <button onClick={() => setCalculationMode('byPayment')} className={`flex-1 p-2 text-sm rounded-l-md ${calculationMode === 'byPayment' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Finn boligpris fra månedsbeløp</button>
                            <button onClick={() => setCalculationMode('byPrice')} className={`flex-1 p-2 text-sm rounded-r-md ${calculationMode === 'byPrice' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Finn månedsbeløp fra boligpris</button>
                        </div>

                        {calculationMode === 'byPayment' ? (
                            <div>
                                <InputSlider label="Ønsket Månedlig Betaling (Totalt)" value={desiredMonthlyPayment} onChange={e => setDesiredMonthlyPayment(Number(e.target.value))} min={1000} max={100000} step={1000} format="currency" />
                                <div className="mt-6 pt-6 border-t">
                                    <SummaryBox label="Maksimal Boligpris" value={finalPropertyValue} format="currency" color="text-purple-600" isLarge={true} />
                                    <SummaryBox label="Tilhørende Lånebeløp" value={loanAmount} format="currency" color="text-indigo-600" isLarge={true} />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <InputSlider label="Ønsket Boligpris" value={propertyValue} onChange={e => setPropertyValue(Number(e.target.value))} min={500000} max={30000000} step={50000} format="currency" />
                                <div className="mt-6 pt-6 border-t">
                                    <SummaryBox label="Nødvendig Månedlig Betaling" value={calculatedMonthlyPayment} format="currency" color="text-purple-600" isLarge={true} />
                                    <SummaryBox label="Nødvendig Lånebeløp" value={loanAmount} format="currency" color="text-indigo-600" isLarge={true} />
                                </div>
                            </div>
                        )}

                        <h3 className="text-xl font-semibold text-gray-700 mt-8 mb-4 border-b pb-2">Lånebetingelser</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Lånetype</label>
                            <div className="flex rounded-md shadow-sm">
                                <button onClick={() => setLoanType('annuity')} className={`flex-1 p-2 rounded-l-md ${loanType === 'annuity' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Annuitetslån</button>
                                <button onClick={() => setLoanType('serial')} className={`flex-1 p-2 rounded-r-md ${loanType === 'serial' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Serielån</button>
                            </div>
                        </div>
                        <InputSlider label="Rente (%)" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} min={0.1} max={20} step={0.01} format="percent" />
                        <InputSlider label="Løpetid (År)" value={loanTerm} onChange={e => setLoanTerm(Number(e.target.value))} min={1} max={40} step={1} format="years" />

                        <h3 className="text-xl font-semibold text-gray-700 mt-8 mb-4 border-b pb-2">Fordeling</h3>
                        <InputSlider label="Din Egenkapital" value={downPayment1} onChange={e => setDownPayment1(Number(e.target.value))} min={0} max={17500000} step={10000} format="currency" />
                        <InputSlider label="Medlåntakers Egenkapital" value={downPayment2} onChange={e => setDownPayment2(Number(e.target.value))} min={0} max={17500000} step={10000} format="currency" />
                        <InputSlider label="Ønsket Eierandel (Din andel %)" value={ownershipSplit} onChange={e => setOwnershipSplit(Number(e.target.value))} min={0} max={100} step={1} format="percent" />

                        <h3 className="text-xl font-semibold text-gray-700 mt-8 mb-4 border-b pb-2">Faste Kostnader & Inntekt</h3>
                        <InputSlider label="Kommunale Avgifter (kr/år)" value={municipalDues} onChange={e => setMunicipalDues(Number(e.target.value))} min={0} max={100000} step={1000} format="currency" />
                        <InputSlider label="Vedlikehold (kr/år)" value={maintenance} onChange={e => setMaintenance(Number(e.target.value))} min={0} max={100000} step={1000} format="currency" />
                        <InputSlider label="Boligforsikring (kr/år)" value={homeInsurance} onChange={e => setHomeInsurance(Number(e.target.value))} min={0} max={50000} step={500} format="currency" />
                        <InputSlider label="Felleskostnader (kr/mnd)" value={hoa} onChange={e => setHoa(Number(e.target.value))} min={0} max={20000} step={250} format="currency" />
                        <InputSlider label="Forventet prisendring (% per år)" value={annualAppreciation} onChange={e => setAnnualAppreciation(Number(e.target.value))} min={-10} max={15} step={0.1} format="percent" />
                        <InputSlider label="Avkastningskrav (% per år)" value={requiredReturn} onChange={e => setRequiredReturn(Number(e.target.value))} min={1} max={15} step={0.1} format="percent" />
                        <InputSlider label="Utleieinntekt (kr/mnd)" value={rentalIncome} onChange={e => setRentalIncome(Number(e.target.value))} min={0} max={30000} step={500} format="currency" />

                        <h3 className="text-xl font-semibold text-gray-700 mt-8 mb-4 border-b pb-2">Eiendomsskatt</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Kommune</label>
                            <div className="flex rounded-md shadow-sm mb-4">
                                <button onClick={() => setPropertyTaxMode('oslo')} className={`flex-1 p-2 text-sm rounded-l-md ${propertyTaxMode === 'oslo' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Oslo (2,35‰)</button>
                                <button onClick={() => setPropertyTaxMode('custom')} className={`flex-1 p-2 text-sm rounded-r-md ${propertyTaxMode === 'custom' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Annen kommune</button>
                            </div>
                        </div>
                        {propertyTaxMode === 'custom' && (
                            <InputSlider label="Årlig eiendomsskatt (kr)" value={customPropertyTaxAmount} onChange={e => setCustomPropertyTaxAmount(Number(e.target.value))} min={0} max={100000} step={1000} format="currency" />
                        )}
                        <div className="bg-gray-100 p-3 rounded-lg">
                            <p className="text-sm text-gray-600">Beregnet årlig eiendomsskatt</p>
                            <p className="font-bold text-lg text-gray-800">{formatCurrency(propertyTax)}</p>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white p-6 rounded-xl shadow-lg">
                            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Individuell Fordeling</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-bold text-lg text-gray-800">Låntaker 1 (Deg)</h3>
                                    <p className="text-sm text-gray-600">Egenkapital: <span className="font-semibold">{formatCurrency(downPayment1)} ({downPaymentPercentage1.toFixed(0)}%)</span></p>
                                    <p className="text-sm text-gray-600">Eierandel: <span className="font-semibold">{ownershipSplit}%</span></p>
                                    <SummaryBox label="Ditt Lånebeløp" value={loanDetails1.amount} format="currency" color="text-blue-600" isLarge={true} />
                                    <SummaryBox label="Din Månedlige Betaling (1. mnd)" value={loanDetails1.payment} format="currency" color="text-blue-600" isLarge={true} />
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-bold text-lg text-gray-800">Låntaker 2</h3>
                                    <p className="text-sm text-gray-600">Egenkapital: <span className="font-semibold">{formatCurrency(downPayment2)} ({downPaymentPercentage2.toFixed(0)}%)</span></p>
                                    <p className="text-sm text-gray-600">Eierandel: <span className="font-semibold">{100 - ownershipSplit}%</span></p>
                                    <SummaryBox label="Deres Lånebeløp" value={loanDetails2.amount} format="currency" color="text-green-600" isLarge={true} />
                                    <SummaryBox label="Deres Månedlige Betaling (1. mnd)" value={loanDetails2.payment} format="currency" color="text-green-600" isLarge={true} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-lg">
                            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Totalsammendrag</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                                <SummaryBox label="Total Månedlig Kostnad (1. mnd)" value={totalMonthlyCost} format="currency" />
                                <SummaryBox label="Netto Månedlig Kostnad (1. mnd)" value={netMonthlyCost} format="currency" />
                                <SummaryBox label="Total Rentekostnad" value={totalInterest} format="currency" />
                                <SummaryBox label="Total Lånekostnad" value={loanAmount + totalInterest} format="currency" />
                                <SummaryBox label="Nedbetalingsdato" value={payoffDate} />
                                <SummaryBox label="Total Egenkapitalandel" value={finalPropertyValue > 0 ? `${((totalDownPayment / finalPropertyValue) * 100).toFixed(1)}%` : '0%'} />
                                <SummaryBox label="Boligverdi ved nedbetaling" value={futurePropertyValue} format="currency" />
                                <SummaryBox label="Forventet egenkapitalgevinst" value={totalEquityGain} format="currency" />
                                <SummaryBox
                                    label="Avkastning på egenkapital (RoE)"
                                    value={`${returnOnEquity.toFixed(1)}%`}
                                    color={returnOnEquity >= requiredReturn ? "text-green-600" : "text-red-600"}
                                />
                                
                                <div className="col-span-full">
                                    <h4 className="text-lg font-semibold text-gray-700 mt-6 mb-3 border-b pb-2">Del 1: Nåverdi-analyse (Er det en god deal i dag?)</h4>
                                </div>
                                
                                <SummaryBox
                                    label="Nåverdi av boligsalg"
                                    value={presentValueOfFutureSale}
                                    format="currency"
                                />
                                <SummaryBox
                                    label="Nåverdi av utleieinntekter"
                                    value={presentValueOfRentalIncome}
                                    format="currency"
                                />
                                <SummaryBox
                                    label="Nåverdi av kostnader"
                                    value={-presentValueOfCosts}
                                    format="currency"
                                    color="text-red-600"
                                />
                                <SummaryBox
                                    label="(=) Nåverdi av boligprosjektet"
                                    value={presentValueOfPropertyInvestment}
                                    format="currency"
                                />
                                <SummaryBox
                                    label="(-) Startkostnad (din egenkapital)"
                                    value={-totalDownPayment}
                                    format="currency"
                                    color="text-red-600"
                                />
                                <SummaryBox
                                    label="(=) Netto nåverdi (NPV)"
                                    value={netPresentValue}
                                    format="currency"
                                    color={netPresentValue > 0 ? "text-green-600" : "text-red-600"}
                                />
                                
                                <div className="col-span-full">
                                    <h4 className="text-lg font-semibold text-gray-700 mt-6 mb-3 border-b pb-2">Del 2: Sluttverdi-analyse (Hvem har mest penger om {yearsToPayoff} år?)</h4>
                                </div>
                                
                                <SummaryBox
                                    label="Sluttverdi fra boliginvestering"
                                    value={totalPropertyReturn}
                                    format="currency"
                                />
                                <SummaryBox
                                    label={`Sluttverdi fra alternativ (${requiredReturn}%)`}
                                    value={totalAlternativeReturn}
                                    format="currency"
                                />
                                <SummaryBox
                                    label="(=) Økonomisk fordel fra bolig"
                                    value={investmentAdvantage}
                                    format="currency"
                                    color={investmentAdvantage > 0 ? "text-green-600" : "text-red-600"}
                                />
                                
                                <div className="col-span-full">
                                    <SummaryBox
                                    label="Investeringsvurdering"
                                    value={isGoodInvestment ? "Anbefalt" : "Ikke anbefalt"}
                                    color={isGoodInvestment ? "text-green-600" : "text-red-600"}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white p-6 rounded-xl shadow-lg">
                                <h3 className="text-xl font-semibold text-gray-700 mb-4">Lånebalanse over tid (Totalt)</h3>
                                <Line data={amortizationChartData} options={{ responsive: true, plugins: { legend: { display: false }}}} />
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-lg">
                                <h3 className="text-xl font-semibold text-gray-700 mb-4">Månedlig Betalingsfordeling (Totalt, 1. mnd)</h3>
                                <div className="h-64 flex items-center justify-center">
                                    <Pie data={paymentBreakdownChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper component for input sliders with both slider and number input
const InputSlider = ({ label, value, onChange, min, max, step, format }) => {
    const handleNumberChange = (e) => {
        const newValue = Number(e.target.value);
        if (!isNaN(newValue)) {
            onChange({ target: { value: newValue } });
        }
    };

    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className="flex items-center space-x-4">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={onChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleNumberChange}
                    className="w-32 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
    );
};

// Helper component for summary boxes
const SummaryBox = ({ label, value, format, color = 'text-gray-800', isLarge = false }) => (
    <div className="bg-gray-100 p-3 rounded-lg mt-2">
        <p className="text-sm text-gray-600">{label}</p>
        <p className={`font-bold ${isLarge ? 'text-2xl' : 'text-xl'} ${color}`}>
            {format === 'currency' ? formatCurrency(value) : value}
        </p>
    </div>
);

// Currency formatting utility for Norwegian Krone (NOK)
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', minimumFractionDigits: 0, maximumFractionDigits: 0, }).format(amount || 0);
};

export default App;