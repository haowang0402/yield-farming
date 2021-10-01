const { expect } = require("chai");
const { ethers } = require("hardhat");
const { SignerWithAddress } = require("@nomiclabs/hardhat-ethers/signers");
const {network} = require("hardhat");

describe("farmContract", () => {
    
    let owner;
    let user;
    let farmContract;
    let tokenContract;
    let usdcContract;
    // user gets 200 USDC for testing
    const InitalAmount = ethers.utils.parseEther("200");

    beforeEach(async() => {
        const FarmCoinFactory = await ethers.getContractFactory("FarmCoinFactory");
        const FarmCoin = await ethers.getContractFactory("FarmCoin");
        const testUSDC = await ethers.getContractFactory("USDCoin");
        usdcContract = await testUSDC.deploy();
        [owner, user] = await ethers.getSigners();
        await Promise.all([
          usdcContract.mint(owner.address, InitalAmount),
          usdcContract.mint(user.address, InitalAmount),
        ]);
        tokenContract = await FarmCoin.deploy();
        farmContract = await FarmCoinFactory.deploy(usdcContract.address, tokenContract.address);
        await tokenContract.connect(owner).transferOwner(farmContract.address);
    })

    describe("Stake", async() => {
      it("simple stake", async() => {
        let transfer_amt = ethers.utils.parseEther("100");
        await usdcContract.connect(user).approve(farmContract.address, transfer_amt);
        await farmContract.connect(user).stake(transfer_amt, 0);
        expect(await farmContract.isStaked(user.address)).to.eq(true);
        expect(await farmContract.stakingBalance(user.address)).to.eq(ethers.utils.parseEther("100"))
        expect(await usdcContract.balanceOf(user.address)).to.eq(ethers.utils.parseEther("100"))
      })

      it("stake beyond balance", async() => {
        let transfer_amt = ethers.utils.parseEther("30000");
        await usdcContract.connect(user).approve(farmContract.address, transfer_amt);
        await expect(farmContract.connect(user).stake(transfer_amt, 0)).to.be.revertedWith("staking amount could not be zero or insufficient usdc balance");
      })
    })

    describe("unstake", async() => {
      it("unstake without lockdown period", async() => {
        let transfer_amt = ethers.utils.parseEther("100");
        await usdcContract.connect(user).approve(farmContract.address, transfer_amt);
        await farmContract.connect(user).stake(transfer_amt, 0);
        expect(await farmContract.stakingBalance(user.address)).to.eq(ethers.utils.parseEther("100"));
        expect(await farmContract.isStaked(user.address)).to.eq(true);
        // fast forward time to generate interest. 
        await network.provider.send("evm_increaseTime", [86400 * 30]);
        await network.provider.send("evm_mine");
        await farmContract.connect(user).unstake(transfer_amt);
        await farmContract.connect(user).withdrawYield();
        expect(await farmContract.isStaked(user.address)).to.eq(false);
        // check interest returned; 
        let res = ethers.utils.formatEther(await tokenContract.balanceOf(user.address));
        res = Math.round(res * 1e4) / 1e4;
        expect(res).to.eq(0.8219);
        // check usdc balance
        expect(await usdcContract.balanceOf(user.address)).to.eq(ethers.utils.parseEther("200"));
      })

      it("unstake with lockdown period (a year) without penality", async()=> {
        let transfer_amt = ethers.utils.parseEther("100");
        await usdcContract.connect(user).approve(farmContract.address, transfer_amt);
        await farmContract.connect(user).stake(transfer_amt, 86400 * 365);
        expect(await farmContract.stakingBalance(user.address)).to.eq(ethers.utils.parseEther("100"));
        expect(await farmContract.isStaked(user.address)).to.eq(true);
        await network.provider.send("evm_increaseTime", [86400 * 365]);
        await network.provider.send("evm_mine");
        await farmContract.connect(user).unstake(transfer_amt);
        await farmContract.connect(user).withdrawYield();
        // check interest returned; 
        let res = ethers.utils.formatEther(await tokenContract.balanceOf(user.address));
        res = Math.round(res * 1e4) / 1e4;
        expect(res).to.eq(30.00);
        expect(await farmContract.isStaked(user.address)).to.eq(false);
        // check usdc balance
        expect (await usdcContract.balanceOf(user.address)).to.eq(ethers.utils.parseEther("200"));
      })

      it("unstake with lockdown period (a year) with penality", async()=> {
        let transfer_amt = ethers.utils.parseEther("100");
        await usdcContract.connect(user).approve(farmContract.address, transfer_amt);
        await farmContract.connect(user).stake(transfer_amt, 86400 * 365);
        expect(await farmContract.stakingBalance(user.address)).to.eq(ethers.utils.parseEther("100"));
        expect(await farmContract.isStaked(user.address)).to.eq(true);
        await network.provider.send("evm_increaseTime", [86400 * 180]);
        await network.provider.send("evm_mine");
        await farmContract.connect(user).unstake(transfer_amt);
        await farmContract.connect(user).withdrawYield();
        // check interest returned; 
        let res = ethers.utils.formatEther(await tokenContract.balanceOf(user.address));
        res = Math.round(res * 1e4) / 1e4;
        expect(res).to.eq(14.7945);
        expect(await farmContract.isStaked(user.address)).to.eq(false);
        expect(await farmContract.isStaked(user.address)).to.eq(false);
        // check usdc balance
        expect (await usdcContract.balanceOf(user.address)).to.eq(ethers.utils.parseEther("190"));
      })

      it("unstake with lockdown period (6 months)", async() => {
        let transfer_amt = ethers.utils.parseEther("100");
        await usdcContract.connect(user).approve(farmContract.address, transfer_amt);
        await farmContract.connect(user).stake(transfer_amt, 86400 * 180);
        expect(await farmContract.stakingBalance(user.address)).to.eq(ethers.utils.parseEther("100"));
        expect(await farmContract.isStaked(user.address)).to.eq(true);
        await network.provider.send("evm_increaseTime", [86400 * 180]);
        await network.provider.send("evm_mine");
        await farmContract.connect(user).unstake(transfer_amt);
        await farmContract.connect(user).withdrawYield();
        // check interest returned; 
        let res = ethers.utils.formatEther(await tokenContract.balanceOf(user.address));
        res = Math.round(res * 1e4) / 1e4;
        expect(res).to.eq(9.863);
        expect(await farmContract.isStaked(user.address)).to.eq(false);
        expect(await farmContract.isStaked(user.address)).to.eq(false);
        // check usdc balance
        expect (await usdcContract.balanceOf(user.address)).to.eq(ethers.utils.parseEther("200"));
      })

      it("partial unstake with lockdown period (6 months)", async() => {
        let transfer_amt = ethers.utils.parseEther("100");
        await usdcContract.connect(user).approve(farmContract.address, transfer_amt);
        await farmContract.connect(user).stake(transfer_amt, 86400 * 180);
        expect(await farmContract.stakingBalance(user.address)).to.eq(ethers.utils.parseEther("100"));
        expect(await farmContract.isStaked(user.address)).to.eq(true);
        await network.provider.send("evm_increaseTime", [86400 * 180]);
        await network.provider.send("evm_mine");
        let unstake_amt = ethers.utils.parseEther("50");
        await farmContract.connect(user).unstake(unstake_amt);
        await farmContract.connect(user).withdrawYield();
        // check interest returned; 
        let res = ethers.utils.formatEther(await tokenContract.balanceOf(user.address));
        res = Math.round(res * 1e4) / 1e4;
        expect(res).to.eq(4.9315);
        expect(await farmContract.isStaked(user.address)).to.eq(true);
         // check usdc balance
        expect (await usdcContract.balanceOf(user.address)).to.eq(ethers.utils.parseEther("150"));
      })

      it("stake twice and unstake", async() => {
        let transfer_amt = ethers.utils.parseEther("100");
        await usdcContract.connect(user).approve(farmContract.address, transfer_amt);
        await farmContract.connect(user).stake(transfer_amt, 86400 * 180);
        await network.provider.send("evm_increaseTime", [86400 * 180]);
        await network.provider.send("evm_mine");
        await usdcContract.connect(user).approve(farmContract.address, transfer_amt);
        await farmContract.connect(user).stake(transfer_amt, 86400 * 180);
        await network.provider.send("evm_increaseTime", [86400 * 180]);
        await network.provider.send("evm_mine");
        let unstake_amt = ethers.utils.parseEther("200");
        await farmContract.connect(user).unstake(unstake_amt);
        await farmContract.connect(user).withdrawYield();
        // check interest returned;         
        let res = ethers.utils.formatEther(await tokenContract.balanceOf(user.address));
        res = Math.round(res * 1e4) / 1e4;
        expect(res).to.eq(29.5890);
        expect(await farmContract.isStaked(user.address)).to.eq(false);
         // check usdc balance
        expect (await usdcContract.balanceOf(user.address)).to.eq(ethers.utils.parseEther("200"));
      })
    })
})